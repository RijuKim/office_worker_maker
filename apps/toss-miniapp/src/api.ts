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
  async records() {
    return request<{ records?: CareerRecord[]; error?: string }>("/api/records");
  },
};
