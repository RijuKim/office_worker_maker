export type JsonApiResult<T> =
  | {
      ok: true;
      status: number;
      data: T;
    }
  | {
      ok: false;
      status: number;
      data: T;
      error?: string;
    };

export interface GameApiClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  headers?: () => Record<string, string>;
  credentials?: RequestCredentials;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
  extractCommittedEvent?: (data: unknown) => unknown | null | undefined;
}

export interface JsonRequestInit extends Omit<RequestInit, "body" | "headers"> {
  body?: unknown;
  headers?: HeadersInit;
}

export interface ParsedSseBlock {
  event: string;
  data: string;
  fields: Record<string, string[]>;
}

export const NEXT_EVENT_STREAM_RETRY_MESSAGE = "다음 사건이 아직 확정되지 않았습니다. 잠시 후 다시 시도해 주세요.";

const DEFAULT_POLL_INTERVAL_MS = 600;
const DEFAULT_POLL_TIMEOUT_MS = 12_000;

function stripTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

function buildUrl(baseUrl: string | undefined, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!baseUrl) return normalizedPath;
  return `${stripTrailingSlash(baseUrl)}${normalizedPath}`;
}

function isBodyInit(value: unknown): value is BodyInit {
  return typeof value === "string"
    || value instanceof Blob
    || value instanceof FormData
    || value instanceof URLSearchParams
    || value instanceof ArrayBuffer
    || ArrayBuffer.isView(value)
    || value instanceof ReadableStream;
}

function serializeJsonBody(value: unknown): BodyInit | undefined {
  if (value === undefined) return undefined;
  if (isBodyInit(value)) return value;
  return JSON.stringify(value);
}

function createHeaders(baseHeaders?: Record<string, string>, requestHeaders?: HeadersInit): Headers {
  const headers = new Headers(baseHeaders);
  if (requestHeaders) {
    new Headers(requestHeaders).forEach((value, key) => {
      headers.set(key, value);
    });
  }
  return headers;
}

function parseJsonOrEmpty<T>(value: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return {} as T;
  }
}

function defaultExtractCommittedEvent(data: unknown): unknown | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const committed = (data as { currentEvent?: unknown }).currentEvent;
  if (!committed || typeof committed !== "object") return null;
  return committed;
}

function normalizeSseText(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

function consumeSseFrame<TEvent>(
  frame: ParsedSseBlock | null,
  onFrame?: (frame: ParsedSseBlock) => void,
): { event: TEvent | null; failed: boolean } | null {
  if (!frame) {
    return { event: null, failed: true };
  }

  onFrame?.(frame);

  if (frame.event === "status") {
    return null;
  }

  if (frame.event === "error") {
    return { event: null, failed: true };
  }

  if (frame.event !== "event") {
    return null;
  }

  const payload = parseJsonOrEmpty<{ event?: TEvent }>(frame.data);
  if (!payload || typeof payload !== "object" || !payload.event || typeof payload.event !== "object") {
    return { event: null, failed: true };
  }

  return { event: payload.event, failed: false };
}

export function parseSseBlocks(text: string): ParsedSseBlock[] {
  const normalized = normalizeSseText(text);
  const blocks = normalized.split("\n\n");
  const frames: ParsedSseBlock[] = [];

  for (const block of blocks) {
    const parsed = parseSseBlock(block);
    if (parsed) frames.push(parsed);
  }

  return frames;
}

function parseSseBlock(block: string): ParsedSseBlock | null {
  const lines = normalizeSseText(block).split("\n");
  const fields: Record<string, string[]> = {};
  const dataLines: string[] = [];
  let event = "";

  for (const line of lines) {
    if (!line || line.startsWith(":")) continue;
    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) continue;

    const name = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).replace(/^\s/, "");
    (fields[name] ??= []).push(value);
    if (name === "event") event = value;
    if (name === "data") dataLines.push(value);
  }

  if (!event && dataLines.length === 0) return null;
  return {
    event,
    data: dataLines.join("\n"),
    fields,
  };
}

export async function readNextEventFromStream<TEvent>(
  response: Response,
  onFrame?: (frame: ParsedSseBlock) => void,
): Promise<{ event: TEvent | null; failed: boolean }> {
  if (!response.ok || !response.body) {
    return { event: null, failed: true };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        buffer = normalizeSseText(buffer);

        const finalFrame = consumeSseFrame<TEvent>(parseSseBlock(buffer), onFrame);
        if (!finalFrame) {
          return { event: null, failed: true };
        }
        return finalFrame;
      }

      buffer += decoder.decode(value, { stream: true });
      buffer = normalizeSseText(buffer);

      while (true) {
        const separatorIndex = buffer.indexOf("\n\n");
        if (separatorIndex < 0) break;

        const block = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);

        const nextFrame = consumeSseFrame<TEvent>(parseSseBlock(block), onFrame);
        if (!nextFrame) continue;
        if (nextFrame.failed) {
          return { event: null, failed: true };
        }
        return nextFrame;
      }
    }
  } catch {
    return { event: null, failed: true };
  }
}

export function createGameApiClient(options: GameApiClientOptions = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const credentials = options.credentials ?? "omit";
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const headers = options.headers ?? (() => ({}));
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const pollTimeoutMs = options.pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
  const extractCommittedEvent = options.extractCommittedEvent ?? defaultExtractCommittedEvent;

  async function requestJson<T>(path: string, init: JsonRequestInit = {}): Promise<JsonApiResult<T>> {
    const requestHeaders = createHeaders(headers(), init.headers);
    const body = serializeJsonBody(init.body);
    if (body !== undefined && !requestHeaders.has("Content-Type")) {
      requestHeaders.set("Content-Type", "application/json");
    }
    if (!requestHeaders.has("Accept")) {
      requestHeaders.set("Accept", "application/json");
    }

    try {
      const response = await fetchImpl(buildUrl(options.baseUrl, path), {
        ...init,
        body,
        headers: requestHeaders,
        credentials,
      });
      const text = await response.text();
      const data = text ? parseJsonOrEmpty<T>(text) : ({} as T);
      if (response.ok) {
        return { ok: true, status: response.status, data };
      }
      return {
        ok: false,
        status: response.status,
        data,
        error: typeof data === "object" && data !== null && "error" in data && typeof (data as { error?: unknown }).error === "string"
          ? (data as { error?: string }).error
          : undefined,
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        data: {} as T,
        error: error instanceof Error ? error.message : "요청에 실패했습니다.",
      };
    }
  }

  async function recoverCommittedEvent<TEvent>(characterId: string): Promise<TEvent | null> {
    const startedAt = now();
    const committedPath = `/api/characters/${characterId}`;

    while (true) {
      const elapsed = now() - startedAt;
      const remaining = pollTimeoutMs - elapsed;
      if (remaining <= 0) break;

      await sleep(Math.min(pollIntervalMs, remaining));
      const response = await requestJson<unknown>(committedPath, { method: "GET" });
      const committedEvent = extractCommittedEvent(response.data);
      if (response.ok && committedEvent && typeof committedEvent === "object") {
        return committedEvent as TEvent;
      }
    }

    return null;
  }

  async function nextEventStream<TEvent>(characterId: string): Promise<JsonApiResult<{ event?: TEvent; error?: string }>> {
    let streamResponse: Response | null = null;
    try {
      streamResponse = await fetchImpl(buildUrl(options.baseUrl, `/api/characters/${characterId}/events/next/stream`), {
        method: "POST",
        headers: createHeaders({
          Accept: "text/event-stream",
          ...headers(),
        }),
        credentials,
      });
    } catch {
      streamResponse = null;
    }

    if (!streamResponse) {
      return {
        ok: false,
        status: 504,
        data: { error: NEXT_EVENT_STREAM_RETRY_MESSAGE },
        error: NEXT_EVENT_STREAM_RETRY_MESSAGE,
      };
    }

    const streamed = await readNextEventFromStream<TEvent>(streamResponse, () => undefined);
    if (streamed.event) {
      return {
        ok: true,
        status: 200,
        data: { event: streamed.event },
      };
    }

    const recovered = await recoverCommittedEvent<TEvent>(characterId);
    if (recovered) {
      return {
        ok: true,
        status: 200,
        data: { event: recovered },
      };
    }

    return {
      ok: false,
      status: 504,
      data: { error: NEXT_EVENT_STREAM_RETRY_MESSAGE },
      error: NEXT_EVENT_STREAM_RETRY_MESSAGE,
    };
  }

  return {
    requestJson,
    nextEventStream,
    parseSseBlocks,
  };
}
