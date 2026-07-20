import { afterEach, describe, expect, it, vi } from "vitest";

import {
  generateAiEvent,
  generateAiEventStream,
  getOpenRouterTimeoutMs,
  parseAiEventContentDetailed,
} from "@/lib/game/openrouter";

const body = "당신은 늦은 오후 도서관 창가에서 오래 미뤄 둔 지원서를 펼쳤다. 빗소리가 유리창을 두드리고, 낯선 제안이 도착한다. 선택에는 분명한 비용과 다음 장면으로 이어질 약속이 함께 놓여 있다.";
const validEvent = {
  title: "비 오는 날의 제안",
  body,
  tags: ["진로"],
  choices: [
    { id: "a", label: "제안을 검토한다", summary: "당신은 제안을 검토했다.", statDelta: { mental: -1 } },
    { id: "b", label: "다른 길을 찾는다", summary: "당신은 다른 길을 찾았다.", statDelta: { wealth: -1 } },
  ],
};

describe("AI event diagnostics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OLLAMA_API_KEY;
    delete process.env.OPENROUTER_TIMEOUT_MS;
    vi.useRealTimers();
  });

  it.each([
    [undefined, 30_000],
    ["abc", 30_000],
    ["4999", 30_000],
    ["120001", 30_000],
    ["45000", 45_000],
    ["5000", 5_000],
    ["120000", 120_000],
  ])("parses timeout %s as %i ms", (raw, expected) => {
    expect(getOpenRouterTimeoutMs(raw)).toBe(expected);
  });

  it("classifies malformed JSON separately", () => {
    expect(parseAiEventContentDetailed("{broken")).toEqual({
      success: false,
      reason: "malformed_json",
      issues: ["json"],
    });
  });

  it.each([
    [{ ...validEvent, title: undefined }, "narrative_schema"],
    [{ ...validEvent, tags: undefined }, "narrative_schema"],
    [{ ...validEvent, choices: [] }, "choice_count"],
    [{ ...validEvent, body: "짧다" }, "narrative_schema"],
    [{ ...validEvent, choices: [validEvent.choices[0]] }, "choice_count"],
    [{ ...validEvent, choices: [...validEvent.choices, validEvent.choices[0], validEvent.choices[1], validEvent.choices[0]] }, "choice_count"],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], id: undefined }, validEvent.choices[1]] }, "choice_field"],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], id: 42 }, validEvent.choices[1]] }, "choice_field"],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], label: undefined }, validEvent.choices[1]] }, "choice_field"],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], label: 42 }, validEvent.choices[1]] }, "choice_field"],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], summary: undefined }, validEvent.choices[1]] }, "choice_field"],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], summary: 42 }, validEvent.choices[1]] }, "choice_field"],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], statDelta: undefined }, validEvent.choices[1]] }, "choice_schema"],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], statDelta: "bad" }, validEvent.choices[1]] }, "choice_schema"],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], statDelta: { mental: "bad" } }, validEvent.choices[1]] }, "choice_schema"],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], statDelta: { secretStat: -1 } }, validEvent.choices[1]] }, "choice_schema"],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], label: "x".repeat(201) }, validEvent.choices[1]] }, "choice_field"],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], statDelta: { mental: -15, health: -1 } }, validEvent.choices[1]] }, null],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], statDelta: { mental: 15, health: 15 } }, validEvent.choices[1]] }, null],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], statDelta: { mental: -16 } }, validEvent.choices[1]] }, "choice_stat_range"],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], statDelta: { mental: 16 } }, validEvent.choices[1]] }, "choice_stat_range"],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], statDelta: { health: -2 } }, validEvent.choices[1]] }, "choice_stat_range"],
  ])("returns the diagnostic reason %s", (candidate, reason) => {
    const result = parseAiEventContentDetailed(JSON.stringify(candidate));
    if (reason === null) expect(result).toMatchObject({ success: true });
    else expect(result).toMatchObject({ success: false, reason });
  });

  it("accepts a slow successful provider response without fallback or a second call", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(12_001)
      .mockReturnValue(12_001);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(validEvent) } }],
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const result = await generateAiEvent({
      name: "서윤", major: "문학", gradeYear: 2, age: 21, coreEventCount: 4,
      recentSummaries: [], usedEventTitles: [], stats: {}, relationships: [], storyArc: {},
    }, { skipPrimary: true });

    expect(result).toMatchObject({ success: true, slow: true, totalElapsedMs: 12_001, providerElapsedMs: 12_001, providerFailures: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("aborts at the configured timeout and returns bounded timeout telemetry", async () => {
    vi.useFakeTimers();
    process.env.OPENROUTER_API_KEY = "test-key";
    process.env.OPENROUTER_TIMEOUT_MS = "5000";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }));

    const pending = generateAiEvent({
      name: "서윤", major: "문학", gradeYear: 2, age: 21, coreEventCount: 4,
      recentSummaries: [], usedEventTitles: [], stats: {}, relationships: [], storyArc: {},
    }, { skipPrimary: true });
    await vi.advanceTimersByTimeAsync(5_000);
    const result = await pending;

    expect(result).toMatchObject({
      success: false, reason: "timeout", providerId: "openrouter",
      providerElapsedMs: 5_000, totalElapsedMs: 5_000, slow: false,
      providerFailures: [{ providerId: "openrouter", stage: "provider", reason: "timeout", providerElapsedMs: 5_000 }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it("shares one total timeout budget across primary and secondary providers", async () => {
    vi.useFakeTimers();
    process.env.OLLAMA_API_KEY = "primary-key";
    process.env.OPENROUTER_API_KEY = "secondary-key";
    process.env.OPENROUTER_TIMEOUT_MS = "5000";
    let call = 0;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      call += 1;
      if (call === 1) {
        return new Promise((resolve) => setTimeout(() => resolve(new Response("rate limited", { status: 429 })), 4_000));
      }
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    });

    const pending = generateAiEvent({
      name: "서윤", major: "문학", gradeYear: 2, age: 21, coreEventCount: 4,
      recentSummaries: [], usedEventTitles: [], stats: {}, relationships: [], storyArc: {},
    });
    await vi.advanceTimersByTimeAsync(4_000);
    await vi.advanceTimersByTimeAsync(1_000);
    const result = await pending;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ success: false, reason: "timeout", totalElapsedMs: 5_000 });
    expect(result.providerFailures).toEqual([
      expect.objectContaining({ providerId: "ollama", reason: "rate_limited", providerElapsedMs: 4_000 }),
      expect.objectContaining({ providerId: "openrouter", reason: "timeout", providerElapsedMs: 1_000 }),
    ]);
  });

  it("retains safe primary failure telemetry when the secondary provider succeeds", async () => {
    process.env.OLLAMA_API_KEY = "primary-secret";
    process.env.OPENROUTER_API_KEY = "secondary-secret";
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("limited", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(validEvent) } }] }), { status: 200 }));

    const result = await generateAiEvent({
      name: "서윤", major: "문학", gradeYear: 2, age: 21, coreEventCount: 4,
      recentSummaries: [], usedEventTitles: [], stats: {}, relationships: [], storyArc: {},
    });

    expect(result).toMatchObject({ success: true, providerId: "openrouter", retryUsed: true, providerFailures: [{ providerId: "ollama", stage: "provider", reason: "rate_limited" }] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(result)).not.toContain("primary-secret");
    expect(JSON.stringify(result)).not.toContain("secondary-secret");
    expect(JSON.stringify(result)).not.toContain("주인공:");
  });

  it("classifies a missing provider key without making a request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const result = await generateAiEvent({ name: "서윤", major: "문학", gradeYear: 2, age: 21, coreEventCount: 4, recentSummaries: [], usedEventTitles: [], stats: {}, relationships: [], storyArc: {} }, { skipPrimary: true });
    expect(result).toMatchObject({ success: false, reason: "no_key", providerId: "openrouter", providerElapsedMs: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([[429, "rate_limited"], [500, "api_error"]] as const)("classifies HTTP %i as %s", async (status, reason) => {
    process.env.OPENROUTER_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("upstream failure", { status }));
    const result = await generateAiEvent({ name: "서윤", major: "문학", gradeYear: 2, age: 21, coreEventCount: 4, recentSummaries: [], usedEventTitles: [], stats: {}, relationships: [], storyArc: {} }, { skipPrimary: true });
    expect(result).toMatchObject({ success: false, reason, providerId: "openrouter" });
  });

  it.each([
    ["empty content", { choices: [{ message: { content: "" } }] }, "empty_content"],
    ["malformed JSON", { choices: [{ message: { content: "{broken" } }] }, "malformed_json"],
  ])("classifies %s responses", async (_label, payload, reason) => {
    process.env.OPENROUTER_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    const result = await generateAiEvent({ name: "서윤", major: "문학", gradeYear: 2, age: 21, coreEventCount: 4, recentSummaries: [], usedEventTitles: [], stats: {}, relationships: [], storyArc: {} }, { skipPrimary: true });
    expect(result).toMatchObject({ success: false, reason });
  });

  it.each([false, true])("classifies HTTP-200 SSE in-band errors (EOF=%s)", async (atEof) => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const suffix = atEof ? "" : "\n\n";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(`data: {"error":{"message":"upstream failed"}}${suffix}`, { status: 200 }));
    const result = await generateAiEventStream({ name: "서윤", major: "문학", gradeYear: 2, age: 21, coreEventCount: 4, recentSummaries: [], usedEventTitles: [], stats: {}, relationships: [], storyArc: {} }, () => {}, { skipPrimary: true });
    expect(result).toMatchObject({ success: false, reason: "api_error" });
  });
});
