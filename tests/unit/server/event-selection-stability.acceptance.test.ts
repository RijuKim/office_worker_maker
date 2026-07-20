import { describe, expect, it, vi } from "vitest";

import {
  acquireAuthoritativeEvent,
  type EventAuthorityStore,
  type PersistedEvent,
} from "@/lib/server/event-authority";

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
    async createCandidate(candidate) {
      const persisted = { ...candidate, status: "DISCARDED" };
      this.generated.push(persisted);
      return persisted;
    },
    async claimIfEmpty(candidateId) {
      if (current) return false;
      current = this.generated.find((candidate) => candidate.id === candidateId) ?? null;
      if (current) current.status = "ACTIVE";
      return Boolean(current);
    },
    async discardCandidate(candidateId) {
      const candidate = this.generated.find((item) => item.id === candidateId);
      if (candidate) candidate.status = "DISCARDED";
      this.discarded.push(candidateId);
    },
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
    expect(store.generated.filter((candidate) => candidate.status === "ACTIVE")).toHaveLength(1);
    expect(store.generated.filter((candidate) => candidate.id !== first.id).every(
      (candidate) => store.discarded.includes(candidate.id),
    )).toBe(true);
  });

});
