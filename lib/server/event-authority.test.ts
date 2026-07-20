import { describe, expect, it, vi } from "vitest";

import {
  acquireAuthoritativeEvent,
  acquireEventGenerationLease,
  createPrismaEventAuthorityStore,
  EventAuthorityLostError,
  resolveEventGenerationRole,
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
      data: {
        currentEventId: "candidate-1",
        eventGenerationToken: null,
        eventGenerationStartedAt: null,
      },
    });
    expect(discardMany).not.toHaveBeenCalled();
  });

  it("promotes the winner and applies required side effects in the same transaction", async () => {
    const calls: string[] = [];
    const tx = {
      characterRun: { updateMany: vi.fn(async () => { calls.push("claim"); return { count: 1 }; }) },
      event: { updateMany: vi.fn(async () => { calls.push("promote"); return { count: 1 }; }) },
      hiddenState: { update: vi.fn(async () => { calls.push("flags"); return {}; }) },
    };
    const client = {
      characterRun: { findFirst: vi.fn() },
      event: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
      $transaction: vi.fn(async (operation: (transaction: typeof tx) => Promise<boolean>) => {
        calls.push("transaction:start");
        const result = await operation(tx);
        calls.push("transaction:commit");
        return result;
      }),
    };
    const store = createPrismaEventAuthorityStore({ client: client as never, characterRunId: "run-1", userId: "user-1" });

    await expect(store.claimIfEmpty("candidate-1", async (transaction) => {
      await (transaction as typeof tx).hiddenState.update();
    })).resolves.toBe(true);

    expect(calls).toEqual(["transaction:start", "claim", "promote", "flags", "transaction:commit"]);
  });

  it("discards a failed-CAS candidate and reports no active event when the winner was consumed", async () => {
    const candidate = event("late-candidate");
    const store: EventAuthorityStore = {
      getCurrent: vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null),
      createCandidate: vi.fn(async () => candidate),
      claimIfEmpty: vi.fn(async () => false),
      discardCandidate: vi.fn(async () => undefined),
    };

    await expect(acquireAuthoritativeEvent({ store, generate: async () => candidate }))
      .rejects.toBeInstanceOf(EventAuthorityLostError);
    expect(store.discardCandidate).toHaveBeenCalledWith(candidate.id);
    expect(store.claimIfEmpty).toHaveBeenCalledTimes(1);
  });

  it("returns the failed-CAS winner and leaves the losing candidate non-active", async () => {
    const winner = event("winner");
    const loser = event("loser");
    const store: EventAuthorityStore = {
      getCurrent: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(winner),
      createCandidate: vi.fn(async () => loser),
      claimIfEmpty: vi.fn(async () => false),
      discardCandidate: vi.fn(async () => undefined),
    };

    await expect(acquireAuthoritativeEvent({ store, generate: async () => loser })).resolves.toEqual(winner);
    expect(store.discardCandidate).toHaveBeenCalledWith(loser.id);
  });

  it("elects one persisted generation leader and makes a mixed caller observe its winner", async () => {
    let token: string | null = null;
    let startedAt: Date | null = null;
    let current: PersistedEvent | null = null;
    const client = {
      characterRun: {
        updateMany: vi.fn(async ({ data }: { data: { eventGenerationToken: string; eventGenerationStartedAt: Date } }) => {
          if (token) return { count: 0 };
          token = data.eventGenerationToken;
          startedAt = data.eventGenerationStartedAt;
          return { count: 1 };
        }),
        findFirst: vi.fn(async () => ({ eventGenerationToken: token, eventGenerationStartedAt: startedAt })),
      },
    };
    const store = { getCurrent: vi.fn(async () => current) } as unknown as EventAuthorityStore;
    const leader = await resolveEventGenerationRole({
      client: client as never, store, characterRunId: "run-1", userId: "user-1", leaseMs: 500,
    });
    setTimeout(() => { current = event("winner"); }, 10);
    const follower = await resolveEventGenerationRole({
      client: client as never, store, characterRunId: "run-1", userId: "user-1", leaseMs: 500,
    });

    expect(leader).toHaveProperty("token");
    expect(follower).toEqual({ event: event("winner") });
    expect(client.characterRun.updateMany).toHaveBeenCalledTimes(2);
  });

  it("takes over a stale persisted generation reservation", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const now = new Date("2026-07-21T00:01:00Z");
    const result = await acquireEventGenerationLease({
      client: { characterRun: { updateMany }, event: {}, $transaction: vi.fn() } as never,
      characterRunId: "run-1", userId: "user-1", token: "new-owner", now, staleAfterMs: 30_000,
    });

    expect(result).toEqual({ role: "leader", lease: { token: "new-owner", startedAt: now } });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([{ eventGenerationStartedAt: { lt: new Date("2026-07-21T00:00:30Z") } }]),
      }),
    }));
  });
});
