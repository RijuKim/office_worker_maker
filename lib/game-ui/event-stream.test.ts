import { describe, expect, it, vi } from "vitest";

import {
  NEXT_EVENT_STREAM_RETRY_MESSAGE,
  createGameApiClient,
  parseSseBlocks,
} from "./event-stream";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function streamResponse(chunks: string[], status = 200) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status,
    headers: { "Content-Type": "text/event-stream; charset=utf-8" },
  });
}

function byteStreamResponse(chunks: Uint8Array[], status = 200) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status,
    headers: { "Content-Type": "text/event-stream; charset=utf-8" },
  });
}

function findByteSequence(haystack: Uint8Array, needle: Uint8Array) {
  outer: for (let index = 0; index <= haystack.length - needle.length; index += 1) {
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[index + offset] !== needle[offset]) continue outer;
    }
    return index;
  }
  return -1;
}

describe("game-ui event transport", () => {
  it("serializes JSON requests and merges host headers", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("Content-Type")).toBe("application/json");
      expect(headers.get("Authorization")).toBe("Bearer token-1");
      expect(headers.get("X-Host")).toBe("toss");
      expect(init?.credentials).toBe("omit");
      expect(init?.body).toBe(JSON.stringify({ hello: "world" }));
      return jsonResponse({ ok: true }, 201);
    });

    const client = createGameApiClient({
      baseUrl: "https://api.example.com",
      headers: () => ({ Authorization: "Bearer token-1", "X-Host": "toss" }),
      fetchImpl: fetchImpl as typeof fetch,
    });

    await expect(client.requestJson<{ ok: boolean }>("/api/echo", {
      method: "POST",
      body: { hello: "world" },
    })).resolves.toEqual({
      ok: true,
      status: 201,
      data: { ok: true },
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(String(fetchImpl.mock.calls[0][0])).toBe("https://api.example.com/api/echo");
  });

  it("parses SSE blocks with comments, CRLF, and multiline data", () => {
    expect(parseSseBlocks([
      ": keep-alive",
      "event: status",
      "data: line one",
      "data: line two",
      "",
      "event: event",
      "data: {\"event\":{\"id\":\"event-1\"}}",
      "",
    ].join("\r\n"))).toEqual([
      {
        event: "status",
        data: "line one\nline two",
        fields: {
          event: ["status"],
          data: ["line one", "line two"],
        },
      },
      {
        event: "event",
        data: "{\"event\":{\"id\":\"event-1\"}}",
        fields: {
          event: ["event"],
          data: ["{\"event\":{\"id\":\"event-1\"}}"],
        },
      },
    ]);
  });

  it("parses a final SSE block without a trailing blank line", () => {
    expect(parseSseBlocks([
      "event: event",
      "data: {\"event\":{\"id\":\"event-1\"}}",
    ].join("\n"))).toEqual([
      {
        event: "event",
        data: "{\"event\":{\"id\":\"event-1\"}}",
        fields: {
          event: ["event"],
          data: ["{\"event\":{\"id\":\"event-1\"}}"],
        },
      },
    ]);
  });

  it("returns the final event from one stream POST without polling recovery", async () => {
    const event = {
      id: "event-1",
      title: "도착한 사건",
      body: "스트림이 그대로 확정되었습니다.",
      source: "AI",
      choices: [],
    };
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe("/api/characters/run-1/events/next/stream");
      expect(init?.method).toBe("POST");
      const headers = new Headers(init?.headers);
      expect(headers.get("Accept")).toBe("text/event-stream");
      expect(headers.get("Authorization")).toBe("Bearer token-1");
      return streamResponse([
        'event: status\ndata: {"message":"선택의 시간이 다가오고 있습니다..."}\n\n',
        `event: event\ndata: ${JSON.stringify({ event })}`,
      ]);
    });

    const client = createGameApiClient({
      baseUrl: "https://api.example.com",
      headers: () => ({ Authorization: "Bearer token-1" }),
      fetchImpl: fetchImpl as typeof fetch,
    });

    await expect(client.nextEventStream<typeof event>("run-1")).resolves.toEqual({
      ok: true,
      status: 200,
      data: { event },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("preserves a multibyte character in the final event payload split across bytes at EOF", async () => {
    const encoder = new TextEncoder();
    const event = {
      id: "event-utf8",
      title: "마지막🙂",
      body: "스트림의 마지막 글자도 그대로 와야 합니다.",
      source: "AI",
      choices: [],
    };
    const responseText = `event: event\ndata: ${JSON.stringify({ event })}`;
    const encoded = encoder.encode(responseText);
    const emojiBytes = encoder.encode("🙂");
    const splitAt = findByteSequence(encoded, emojiBytes);
    expect(splitAt).toBeGreaterThanOrEqual(0);

    let recoveryFetches = 0;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe("/api/characters/run-1/events/next/stream");
      expect(url.origin).toBe("https://api.example.com");
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get("Accept")).toBe("text/event-stream");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer token-1");

      if (url.pathname === "/api/characters/run-1/events/next/stream") {
        return byteStreamResponse([
          encoded.slice(0, splitAt + 2),
          encoded.slice(splitAt + 2),
        ]);
      }
      recoveryFetches += 1;
      throw new Error(`unexpected recovery request: ${url.pathname}`);
    });
    const client = createGameApiClient({
      baseUrl: "https://api.example.com",
      headers: () => ({ Authorization: "Bearer token-1" }),
      fetchImpl: fetchImpl as typeof fetch,
    });

    await expect(client.nextEventStream<typeof event>("run-1")).resolves.toEqual({
      ok: true,
      status: 200,
      data: { event },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(recoveryFetches).toBe(0);
  });

  it.each([
    ["non-OK response", () => new Response("upstream failed", { status: 500 })],
    ["missing body", () => new Response(null, { status: 200 })],
    ["malformed JSON", () => streamResponse(['event: event\ndata: not-json\n\n'])],
    ["error frame", () => streamResponse(['event: error\ndata: {"error":"boom"}\n\n'])],
    ["premature EOF", () => streamResponse(['event: status\ndata: {"message":"waiting"}\n\n'])],
  ])("recovers from %s by polling the committed event exactly once per 600ms tick", async (_label, makeFailureResponse) => {
    const committedEvent = {
      id: "event-2",
      title: "복구된 사건",
      body: "서버에 이미 확정된 사건을 읽어왔습니다.",
      source: "STATIC",
      choices: [],
    };
    const sleeps: number[] = [];
    let clock = 0;
    let committedChecks = 0;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/events/next/stream")) {
        expect(init?.method).toBe("POST");
        return makeFailureResponse();
      }
      committedChecks += 1;
      if (committedChecks < 3) {
        return jsonResponse({ currentEvent: null });
      }
      return jsonResponse({ currentEvent: committedEvent });
    });
    const client = createGameApiClient({
      baseUrl: "https://api.example.com",
      headers: () => ({ Authorization: "Bearer token-1" }),
      fetchImpl: fetchImpl as typeof fetch,
      now: () => clock,
      sleep: async (ms) => {
        sleeps.push(ms);
        clock += ms;
      },
    });

    await expect(client.nextEventStream<typeof committedEvent>("run-1")).resolves.toEqual({
      ok: true,
      status: 200,
      data: { event: committedEvent },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(sleeps).toEqual([600, 600, 600]);
    expect(committedChecks).toBe(3);
  });

  it("returns the terminal Korean retry message when recovery exhausts its 12 second window", async () => {
    const sleeps: number[] = [];
    let clock = 0;
    let committedChecks = 0;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/events/next/stream")) {
        return streamResponse(['event: status\ndata: {"message":"waiting"}\n\n']);
      }
      committedChecks += 1;
      return jsonResponse({ currentEvent: null });
    });
    const client = createGameApiClient({
      baseUrl: "https://api.example.com",
      fetchImpl: fetchImpl as typeof fetch,
      now: () => clock,
      sleep: async (ms) => {
        sleeps.push(ms);
        clock += ms;
      },
    });

    await expect(client.nextEventStream("run-1")).resolves.toEqual({
      ok: false,
      status: 504,
      data: { error: NEXT_EVENT_STREAM_RETRY_MESSAGE },
      error: NEXT_EVENT_STREAM_RETRY_MESSAGE,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(21);
    expect(committedChecks).toBe(20);
    expect(sleeps).toEqual(Array.from({ length: 20 }, () => 600));
  });

  it("sends exactly one stream POST and does not issue a second generation request on recovery", async () => {
    const committedEvent = {
      id: "event-one-post",
      title: "한 번의 POST로 확정된 사건",
      body: "클라이언트는 정확히 하나의 스트림 POST만 보내야 합니다.",
      source: "STATIC",
      choices: [],
    };
    let streamPosts = 0;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/events/next/stream")) {
        streamPosts += 1;
        expect(init?.method).toBe("POST");
        return streamResponse([
          'event: status\ndata: {"message":"선택의 시간이 다가오고 있습니다..."}\n\n',
          `event: event\ndata: ${JSON.stringify({ event: committedEvent })}`,
        ]);
      }
      return jsonResponse({ currentEvent: null });
    });
    const client = createGameApiClient({
      baseUrl: "https://api.example.com",
      headers: () => ({ Authorization: "Bearer token-1" }),
      fetchImpl: fetchImpl as typeof fetch,
    });

    await expect(client.nextEventStream<typeof committedEvent>("run-1")).resolves.toEqual({
      ok: true,
      status: 200,
      data: { event: committedEvent },
    });
    expect(streamPosts).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("returns immediately after the final SSE frame even if the body stays open", async () => {
    vi.useFakeTimers();
    try {
      const event = {
        id: "event-open",
        title: "완결된 사건",
        body: "최종 프레임이 도착하면 소켓 종료를 기다리지 않습니다.",
        source: "AI",
        choices: [],
      };
      const encoder = new TextEncoder();
      let recoveryChecks = 0;

      const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith("/events/next/stream")) {
          expect(init?.method).toBe("POST");
          const stream = new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(encoder.encode([
                'event: status\ndata: {"message":"선택의 시간이 다가오고 있습니다..."}\n\n',
                `event: event\ndata: ${JSON.stringify({ event })}\n\n`,
              ].join("")));
              setTimeout(() => controller.close(), 250);
            },
          });
          return new Response(stream, {
            status: 200,
            headers: { "Content-Type": "text/event-stream; charset=utf-8" },
          });
        }

        recoveryChecks += 1;
        return jsonResponse({ currentEvent: null });
      });

      const client = createGameApiClient({
        baseUrl: "https://api.example.com",
        fetchImpl: fetchImpl as typeof fetch,
        now: () => 0,
        sleep: async () => undefined,
      });

      await expect(client.nextEventStream<typeof event>("run-1")).resolves.toEqual({
        ok: true,
        status: 200,
        data: { event },
      });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(recoveryChecks).toBe(0);

      await vi.advanceTimersByTimeAsync(250);
    } finally {
      vi.useRealTimers();
    }
  });
});
