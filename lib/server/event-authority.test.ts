import { describe, expect, it, vi } from "vitest";

import {
  acquireAuthoritativeEvent,
  createPrismaEventAuthorityStore,
  toPublicEvent,
  type EventAuthorityStore,
  type PersistedEvent,
} from "./event-authority";

function event(id: string): PersistedEvent {
  return {
    id,
    source: "AI",
    status: "ACTIVE",
    title: `사건 ${id}`,
    body: "플레이어가 결정을 내릴 때까지 그대로 유지되는 사건입니다.",
    choices: [{ id: "choose", label: "선택한다" }, { id: "wait", label: "기다린다" }],
    tags: ["진로"],
  };
}

describe("event authority", () => {
  it("returns the exact committed event for JSON or stream recovery without generating", async () => {
    const committed = event("committed");
    const generate = vi.fn(async () => event("replacement"));
    const store: EventAuthorityStore = {
      getCurrent: vi.fn(async () => committed),
      createCandidate: vi.fn(),
      claimIfEmpty: vi.fn(),
      discardCandidate: vi.fn(),
    };

    const recovered = await acquireAuthoritativeEvent({ store, generate });

    expect(toPublicEvent(recovered)).toEqual({
      id: "committed",
      title: "사건 committed",
      body: committed.body,
      choices: committed.choices,
      source: "AI",
      forced: false,
    });
    expect(generate).not.toHaveBeenCalled();
    expect(store.createCandidate).not.toHaveBeenCalled();
  });

  it("makes simultaneous candidates converge and leaves every loser non-active", async () => {
    let current: PersistedEvent | null = null;
    const candidates = new Map<string, PersistedEvent>();
    const discarded: string[] = [];
    const store: EventAuthorityStore = {
      async getCurrent() { return current; },
      async createCandidate(candidate) { candidates.set(candidate.id, candidate); return candidate; },
      async claimIfEmpty(id) {
        if (current) return false;
        current = candidates.get(id) ?? null;
        return true;
      },
      async discardCandidate(id) { discarded.push(id); },
    };

    const results = await Promise.all(
      ["one", "two", "three"].map((id) => acquireAuthoritativeEvent({ store, generate: async () => event(id) })),
    );

    expect(new Set(results.map((result) => result.id))).toEqual(new Set([results[0].id]));
    expect([...candidates.keys()].filter((id) => id !== results[0].id).every((id) => discarded.includes(id))).toBe(true);
  });

  it("uses an owned-pointer compare-and-set without promoting a losing row", async () => {
    const updateMany = vi.fn(async () => ({ count: 0 }));
    const discardMany = vi.fn(async () => ({ count: 1 }));
    const client = {
      characterRun: { findFirst: vi.fn() },
      event: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
      $transaction: vi.fn(async (operation: (tx: unknown) => Promise<boolean>) => operation({
        characterRun: { updateMany },
        event: { updateMany: discardMany },
      })),
    };
    const store = createPrismaEventAuthorityStore({
      client: client as never,
      characterRunId: "run-1",
      userId: "user-1",
    });

    await expect(store.claimIfEmpty("candidate-1")).resolves.toBe(false);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "run-1", userId: "user-1", currentEventId: null },
      data: { currentEventId: "candidate-1" },
    });
    expect(discardMany).not.toHaveBeenCalled();
  });
});
