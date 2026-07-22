import type { CareerRecord, CharacterData, EventData } from "./types";

type ApiResult<T> = {
  ok: boolean;
  status: number;
  data: T;
};

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const TOSS_SESSION_STORAGE_KEY = "sano-toss-session";

let tossSessionToken = sessionStorage.getItem(TOSS_SESSION_STORAGE_KEY) ?? "";

function apiUrl(path: string) {
  if (!apiBaseUrl) return path;
  return `${apiBaseUrl}${path}`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) headers.set("Content-Type", "application/json");
  if (tossSessionToken) headers.set("Authorization", `Bearer ${tossSessionToken}`);

  const response = await fetch(apiUrl(path), {
    ...options,
    headers,
    credentials: "omit",
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data: data as T };
}

export const api = {
  async createTossSession(hash: string) {
    const result = await request<{ token?: string; expiresIn?: number; error?: string }>("/api/toss/session", {
      method: "POST",
      body: JSON.stringify({ hash }),
    });
    if (result.ok && result.data.token) {
      tossSessionToken = result.data.token;
      sessionStorage.setItem(TOSS_SESSION_STORAGE_KEY, tossSessionToken);
    }
    return result;
  },
  async me() {
    return request<{ user?: { id: string; email: string }; error?: string }>("/api/me");
  },
  async characters() {
    return request<{ characters?: CharacterData[]; error?: string }>("/api/characters");
  },
  async createCharacter(input: { name: string; age: number; residence: string; preferredStats: string[] }) {
    return request<{ character?: CharacterData; error?: string }>("/api/characters", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  async character(id: string) {
    return request<{ character?: CharacterData; currentEvent?: EventData; error?: string }>(`/api/characters/${id}`);
  },
  async choose(characterId: string, choiceIndex: number) {
    return request<{
      result?: {
        stats?: Record<string, number>;
        statDelta?: Record<string, number>;
        relationshipDelta?: { name: string; trust: number }[];
        summary?: string;
        endingTriggered?: boolean;
        endingRecordId?: string;
      };
      error?: string;
    }>(`/api/characters/${characterId}/choices`, {
      method: "POST",
      body: JSON.stringify({ choiceIndex }),
    });
  },
  async nextEvent(characterId: string) {
    return request<{ event?: EventData; error?: string }>(`/api/characters/${characterId}/events/next`, {
      method: "POST",
    });
  },
  async nextEventStream(characterId: string) {
    const headers = new Headers({ Accept: "text/event-stream" });
    if (tossSessionToken) headers.set("Authorization", `Bearer ${tossSessionToken}`);
    const response = await fetch(apiUrl(`/api/characters/${characterId}/events/next/stream`), {
      method: "POST",
      headers,
      credentials: "omit",
    });
    if (!response.ok || !response.body) {
      const data = await response.json().catch(() => ({})) as { error?: string };
      return { ok: false, status: response.status, data } as ApiResult<{ event?: EventData; error?: string }>;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let event: EventData | undefined;
    let error: string | undefined;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const messages = buffer.split("\n\n");
      buffer = messages.pop() ?? "";
      for (const message of messages) {
        const eventName = message.split("\n").find((line) => line.startsWith("event:"))?.slice(6).trim();
        const dataLine = message.split("\n").find((line) => line.startsWith("data:"));
        if (!eventName || !dataLine) continue;
        const payload = JSON.parse(dataLine.slice(5).trim()) as { event?: EventData; error?: string };
        if (eventName === "event" && payload.event) event = payload.event;
        if (eventName === "error") error = payload.error ?? "다음 사건을 생성하지 못했습니다.";
      }
    }
    return { ok: Boolean(event), status: event ? 200 : 502, data: { event, error } } as ApiResult<{ event?: EventData; error?: string }>;
  },
  async records() {
    return request<{ records?: CareerRecord[]; error?: string }>("/api/records");
  },
};
