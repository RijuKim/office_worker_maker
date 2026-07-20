import { describe, expect, it, vi } from "vitest";

import {
  acquireEventGenerationLease,
  createPrismaEventAuthorityStore,
  releaseEventGenerationLease,
  type PersistedEvent,
} from "./event-authority";

class Mutex {
  private tail = Promise.resolve();

  async run<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try { return await operation(); } finally { release(); }
  }
}

/** A serialized predicate harness matching PostgreSQL UPDATE ... WHERE atomicity. */
function transactionalHarness() {
  const mutex = new Mutex();
  const run = { id: "run-1", userId: "user-1", currentEventId: null as string | null, token: null as string | null, startedAt: null as Date | null };
  const events = new Map<string, PersistedEvent>();

  const updateRun = async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
    if (where.id !== run.id || where.userId !== run.userId) return { count: 0 };
    if (where.currentEventId === null && run.currentEventId !== null) return { count: 0 };
    if (typeof where.eventGenerationToken === "string" && where.eventGenerationToken !== run.token) return { count: 0 };
    if (Array.isArray(where.OR)) {
      const stale = (where.OR as Array<Record<string, unknown>>).some((part) => {
        if (part.eventGenerationToken === null) return run.token === null;
        if (part.eventGenerationStartedAt === null) return run.startedAt === null;
        const comparison = part.eventGenerationStartedAt as { lt?: Date } | undefined;
        return comparison?.lt instanceof Date && run.startedAt !== null && run.startedAt < comparison.lt;
      });
      if (!stale) return { count: 0 };
    }
    if ("currentEventId" in data) run.currentEventId = data.currentEventId as string;
    if ("eventGenerationToken" in data) run.token = data.eventGenerationToken as string | null;
    if ("eventGenerationStartedAt" in data) run.startedAt = data.eventGenerationStartedAt as Date | null;
    return { count: 1 };
  };

  const tx = {
    characterRun: { updateMany: updateRun },
    event: {
      updateMany: async ({ where, data }: { where: { id: string; status: string }; data: { status: string } }) => {
        const current = events.get(where.id);
        if (!current || current.status !== where.status) return { count: 0 };
        current.status = data.status;
        return { count: 1 };
      },
    },
  };
  const client = {
    characterRun: {
      updateMany: (args: never) => mutex.run(() => updateRun(args)),
      findFirst: vi.fn(async () => ({
        currentEventId: run.currentEventId,
        eventGenerationToken: run.token,
        eventGenerationStartedAt: run.startedAt,
      })),
    },
    event: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; status: string } }) => {
        const current = events.get(where.id);
        return current?.status === where.status ? current : null;
      }),
      create: vi.fn(async ({ data }: { data: PersistedEvent }) => {
        const candidate = { ...data, status: "DISCARDED" };
        events.set(candidate.id, candidate);
        return candidate;
      }),
      updateMany: tx.event.updateMany,
    },
    $transaction: <T>(operation: (transaction: typeof tx) => Promise<T>) => mutex.run(() => operation(tx)),
  };
  return { client, run, events };
}

function candidate(id: string): PersistedEvent {
  return { id, source: "AI", status: "ACTIVE", title: id, body: "본문", choices: [], tags: [] };
}

describe("PostgreSQL-faithful event authority interleavings", () => {
  it("serializes simultaneous acquisition and permits takeover only after staleness", async () => {
    const harness = transactionalHarness();
    const now = new Date("2026-07-21T00:00:00Z");
    const [first, second] = await Promise.all([
      acquireEventGenerationLease({ client: harness.client as never, characterRunId: "run-1", userId: "user-1", token: "one", now, staleAfterMs: 1_000 }),
      acquireEventGenerationLease({ client: harness.client as never, characterRunId: "run-1", userId: "user-1", token: "two", now, staleAfterMs: 1_000 }),
    ]);
    expect([first.role, second.role].sort()).toEqual(["follower", "leader"]);
    const owner = first.role === "leader" ? "one" : "two";
    expect(harness.run.token).toBe(owner);

    const renewedAt = new Date(now.getTime() + 900);
    await harness.client.characterRun.updateMany({
      where: { id: "run-1", userId: "user-1", currentEventId: null, eventGenerationToken: owner },
      data: { eventGenerationStartedAt: renewedAt },
    } as never);
    const noTakeover = await acquireEventGenerationLease({ client: harness.client as never, characterRunId: "run-1", userId: "user-1", token: "early", now: new Date(now.getTime() + 1_500), staleAfterMs: 1_000 });
    expect(noTakeover.role).toBe("follower");
    const takeover = await acquireEventGenerationLease({ client: harness.client as never, characterRunId: "run-1", userId: "user-1", token: "late", now: new Date(now.getTime() + 2_001), staleAfterMs: 1_000 });
    expect(takeover.role).toBe("leader");
    expect(harness.run.token).toBe("late");
  });

  it("fences stale commits and cleanup while the current owner commits atomically", async () => {
    const harness = transactionalHarness();
    harness.run.token = "new-owner";
    harness.run.startedAt = new Date();
    const staleStore = createPrismaEventAuthorityStore({ client: harness.client as never, characterRunId: "run-1", userId: "user-1", generationToken: "old-owner" });
    const ownerStore = createPrismaEventAuthorityStore({ client: harness.client as never, characterRunId: "run-1", userId: "user-1", generationToken: "new-owner" });
    await staleStore.createCandidate(candidate("stale"));
    await ownerStore.createCandidate(candidate("winner"));

    expect(await staleStore.claimIfEmpty("stale")).toBe(false);
    expect(await ownerStore.claimIfEmpty("winner")).toBe(true);
    await staleStore.discardCandidate("stale");
    await releaseEventGenerationLease({ client: harness.client as never, characterRunId: "run-1", userId: "user-1", token: "old-owner" });

    expect(harness.run.currentEventId).toBe("winner");
    expect(harness.events.get("winner")?.status).toBe("ACTIVE");
    expect(harness.events.get("stale")?.status).toBe("DISCARDED");
    expect([...harness.events.values()].filter((event) => event.status === "ACTIVE")).toHaveLength(1);
  });
});
