import { describe, expect, it, vi } from "vitest";

import {
  acquireAuthoritativeEvent,
  type EventAuthorityStore,
  type PersistedEvent,
} from "@/lib/server/event-authority";
import {
  getAiTimeoutMs,
  parseAiEventContentDetailed,
} from "@/lib/game/openrouter";

function event(id: string, source = "AI"): PersistedEvent {
  return {
    id,
    source,
    status: "ACTIVE",
    title: `사건 ${id}`,
    body: "이미 확정되어 플레이어의 선택을 기다리는 충분히 긴 사건 본문입니다.",
    choices: [
      { id: "ask", label: "상황을 묻는다", summary: "당신은 상황을 물었다.", statDelta: { mental: -1 } },
      { id: "wait", label: "조금 기다린다", summary: "당신은 잠시 기다렸다.", statDelta: { health: -1 } },
    ],
    tags: ["관계"],
  };
}

function inMemoryStore(initial: PersistedEvent | null = null): EventAuthorityStore & {
  generated: PersistedEvent[];
  discarded: string[];
} {
  let current = initial;
  return {
    generated: [],
    discarded: [],
    async getCurrent() { return current; },
    async createCandidate(candidate) { this.generated.push(candidate); return candidate; },
    async claimIfEmpty(candidateId) {
      if (current) return false;
      current = this.generated.find((candidate) => candidate.id === candidateId) ?? null;
      return Boolean(current);
    },
    async discardCandidate(candidateId) { this.discarded.push(candidateId); },
  };
}

describe("event selection stability acceptance", () => {
  it("returns an already committed event without generation or eligibility replacement", async () => {
    const committed = event("committed");
    const store = inMemoryStore(committed);
    const generate = vi.fn(async () => event("replacement", "FALLBACK"));

    const result = await acquireAuthoritativeEvent({ store, generate });

    expect(result).toEqual(committed);
    expect(generate).not.toHaveBeenCalled();
    expect(store.discarded).toEqual([]);
  });

  it("makes concurrent generation requests converge on one authoritative event", async () => {
    const store = inMemoryStore();
    let sequence = 0;
    const generate = vi.fn(async () => event(`candidate-${++sequence}`));

    const [first, second, third] = await Promise.all([
      acquireAuthoritativeEvent({ store, generate }),
      acquireAuthoritativeEvent({ store, generate }),
      acquireAuthoritativeEvent({ store, generate }),
    ]);

    expect(new Set([first.id, second.id, third.id]).size).toBe(1);
    expect((await store.getCurrent())?.id).toBe(first.id);
    expect(store.generated.filter((candidate) => candidate.id !== first.id).every(
      (candidate) => store.discarded.includes(candidate.id),
    )).toBe(true);
  });

  it("uses the configured timeout only inside the accepted range", () => {
    expect(getAiTimeoutMs(undefined)).toBe(30_000);
    expect(getAiTimeoutMs("abc")).toBe(30_000);
    expect(getAiTimeoutMs("4999")).toBe(30_000);
    expect(getAiTimeoutMs("120001")).toBe(30_000);
    expect(getAiTimeoutMs("45000")).toBe(45_000);
  });

  it("diagnoses an invalid choice independently from a valid narrative", () => {
    const parsed = parseAiEventContentDetailed(JSON.stringify({
      title: "발표 전날의 빈자리",
      body: "팀원이 갑자기 연락이 끊겼다. ".repeat(12),
      choices: [
        { id: "repair", label: "자료를 보완한다", summary: "당신은 자료를 보완했다.", statDelta: { practical: 2, mental: -1 }, relationshipDelta: [] },
        { id: "break", label: "무리하게 밀어붙인다", summary: "당신은 무리해서 끝냈다.", statDelta: { health: -8 }, relationshipDelta: [] },
      ],
      tags: ["팀", "발표"],
    }));

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.stage).toBe("choice_schema");
      expect(parsed.issues.some((issue) => issue.path.includes("choices.1.statDelta.health"))).toBe(true);
    }
  });
});
