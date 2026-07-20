import type { EventSource, EventStatus, Prisma, PrismaClient } from "@prisma/client";

export type PersistedEvent = {
  id: string;
  source: EventSource | string;
  status: EventStatus | string;
  title: string;
  body: string;
  choices: unknown;
  tags: unknown;
};

export type EventCandidate = PersistedEvent;

export interface EventAuthorityStore {
  getCurrent(): Promise<PersistedEvent | null>;
  createCandidate(candidate: EventCandidate): Promise<PersistedEvent>;
  claimIfEmpty(candidateId: string, onClaim?: (transaction: unknown) => Promise<void>): Promise<boolean>;
  discardCandidate(candidateId: string): Promise<void>;
}

export type EventGenerationLease = { token: string; startedAt: Date };
export type GenerationLeaseResult =
  | { role: "leader"; lease: EventGenerationLease }
  | { role: "follower"; lease: EventGenerationLease }
  | { role: "missing" };

export const EVENT_GENERATION_LEASE_MS = 45_000;
export const EVENT_GENERATION_POLL_MS = 100;

export type EventGenerationHeartbeat = {
  assertOwned(): void;
  stop(): Promise<void>;
};

export class EventAuthorityLostError extends Error {
  constructor() {
    super("The authoritative event was consumed while a concurrent candidate was being resolved.");
    this.name = "EventAuthorityLostError";
  }
}

/**
 * Resolves the immutable event pointer or elects exactly one generated candidate.
 * Eligibility belongs in `generate`; an existing pointer is deliberately never
 * passed through candidate validation again.
 */
export async function acquireAuthoritativeEvent({
  store,
  generate,
  onCommitted,
}: {
  store: EventAuthorityStore;
  generate: () => Promise<EventCandidate>;
  onCommitted?: (event: PersistedEvent, transaction: unknown) => Promise<void>;
}): Promise<PersistedEvent> {
  const current = await store.getCurrent();
  if (current) return current;

  const candidate = await store.createCandidate(await generate());
  if (await store.claimIfEmpty(candidate.id, onCommitted ? async (transaction) => {
    await onCommitted(candidate, transaction);
  } : undefined)) {
    return candidate;
  }

  await store.discardCandidate(candidate.id);
  const winner = await store.getCurrent();
  if (winner) return winner;

  // A choice can consume the winner between the failed CAS and this read. Do
  // not retry the claim: that could resurrect this late candidate.
  throw new EventAuthorityLostError();
}

type AuthorityPrisma = Pick<PrismaClient, "characterRun" | "event" | "$transaction">;

export async function acquireEventGenerationLease({
  client,
  characterRunId,
  userId,
  now = new Date(),
  token = crypto.randomUUID(),
  staleAfterMs = EVENT_GENERATION_LEASE_MS,
}: {
  client: AuthorityPrisma;
  characterRunId: string;
  userId: string;
  now?: Date;
  token?: string;
  staleAfterMs?: number;
}): Promise<GenerationLeaseResult> {
  const staleBefore = new Date(now.getTime() - staleAfterMs);
  const claimed = await client.characterRun.updateMany({
    where: {
      id: characterRunId,
      userId,
      currentEventId: null,
      OR: [
        { eventGenerationToken: null },
        { eventGenerationStartedAt: null },
        { eventGenerationStartedAt: { lt: staleBefore } },
      ],
    },
    data: { eventGenerationToken: token, eventGenerationStartedAt: now },
  });
  if (claimed.count === 1) return { role: "leader", lease: { token, startedAt: now } };

  const current = await client.characterRun.findFirst({
    where: { id: characterRunId, userId },
    select: { eventGenerationToken: true, eventGenerationStartedAt: true },
  });
  if (!current) return { role: "missing" };
  return {
    role: "follower",
    lease: {
      token: current.eventGenerationToken ?? "",
      startedAt: current.eventGenerationStartedAt ?? now,
    },
  };
}

export async function waitForAuthoritativeEvent({
  store,
  timeoutMs,
  pollMs = EVENT_GENERATION_POLL_MS,
}: {
  store: EventAuthorityStore;
  timeoutMs: number;
  pollMs?: number;
}): Promise<PersistedEvent | null> {
  const deadline = Date.now() + timeoutMs;
  do {
    const current = await store.getCurrent();
    if (current) return current;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  } while (Date.now() < deadline);
  return store.getCurrent();
}

export async function resolveEventGenerationRole({
  client,
  store,
  characterRunId,
  userId,
  leaseMs,
}: {
  client: AuthorityPrisma;
  store: EventAuthorityStore;
  characterRunId: string;
  userId: string;
  leaseMs: number;
}): Promise<
  | { event: PersistedEvent; token?: never; missing?: never }
  | { event?: never; token: string; missing?: never }
  | { event?: never; token?: never; missing: true }
> {
  while (true) {
    const result = await acquireEventGenerationLease({
      client, characterRunId, userId, staleAfterMs: leaseMs,
    });
    if (result.role === "leader") return { token: result.lease.token };
    if (result.role === "missing") return { missing: true };

    const elapsed = Date.now() - result.lease.startedAt.getTime();
    const winner = await waitForAuthoritativeEvent({
      store,
      timeoutMs: Math.max(EVENT_GENERATION_POLL_MS, leaseMs - elapsed),
    });
    if (winner) return { event: winner };
  }
}

export async function releaseEventGenerationLease({
  client,
  characterRunId,
  userId,
  token,
}: {
  client: AuthorityPrisma;
  characterRunId: string;
  userId: string;
  token: string;
}) {
  await client.characterRun.updateMany({
    where: { id: characterRunId, userId, currentEventId: null, eventGenerationToken: token },
    data: { eventGenerationToken: null, eventGenerationStartedAt: null },
  });
}

/**
 * Keeps a generation lease fresh without holding a database transaction open.
 * Every renewal and the eventual commit are fenced by the same opaque token.
 */
export function startEventGenerationHeartbeat({
  client,
  characterRunId,
  userId,
  token,
  leaseMs,
  intervalMs = Math.max(50, Math.floor(leaseMs / 3)),
}: {
  client: AuthorityPrisma;
  characterRunId: string;
  userId: string;
  token: string;
  leaseMs: number;
  intervalMs?: number;
}): EventGenerationHeartbeat {
  let stopped = false;
  let lost = false;
  let renewal: Promise<void> | null = null;

  const renew = () => {
    if (stopped || renewal) return;
    renewal = client.characterRun.updateMany({
      where: {
        id: characterRunId,
        userId,
        currentEventId: null,
        eventGenerationToken: token,
      },
      data: { eventGenerationStartedAt: new Date() },
    }).then(({ count }) => {
      if (count !== 1) lost = true;
    }).catch(() => {
      // A failed renewal is treated as loss of authority. This prevents a
      // request from committing after the database could no longer fence it.
      lost = true;
    }).finally(() => {
      renewal = null;
    });
  };

  const timer = setInterval(renew, Math.min(intervalMs, Math.max(50, leaseMs - 1)));
  timer.unref?.();

  return {
    assertOwned() {
      if (lost) throw new EventAuthorityLostError();
    },
    async stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      await renewal;
      await releaseEventGenerationLease({ client, characterRunId, userId, token });
    },
  };
}

export function createPrismaEventAuthorityStore({
  client,
  characterRunId,
  userId,
  generationToken,
}: {
  client: AuthorityPrisma;
  characterRunId: string;
  userId: string;
  generationToken?: string;
}): EventAuthorityStore {
  return {
    async getCurrent() {
      const run = await client.characterRun.findFirst({
        where: { id: characterRunId, userId },
        select: { currentEventId: true },
      });
      if (!run?.currentEventId) return null;

      return client.event.findFirst({
        where: {
          id: run.currentEventId,
          characterRunId,
          status: "ACTIVE",
        },
      });
    },

    async createCandidate(candidate) {
      return client.event.create({
        data: {
          characterRunId,
          id: candidate.id,
          title: candidate.title,
          body: candidate.body,
          source: candidate.source as EventSource,
          // A candidate is deliberately non-active until the same transaction
          // that wins the pointer CAS promotes it.
          status: "DISCARDED",
          choices: candidate.choices as Prisma.InputJsonValue,
          tags: candidate.tags as Prisma.InputJsonValue,
          safetyChecked: true,
        },
      });
    },

    async claimIfEmpty(candidateId, onClaim) {
      return client.$transaction(async (tx) => {
        const claimed = await tx.characterRun.updateMany({
          where: {
            id: characterRunId,
            userId,
            currentEventId: null,
            ...(generationToken ? { eventGenerationToken: generationToken } : {}),
          },
          data: {
            currentEventId: candidateId,
            eventGenerationToken: null,
            eventGenerationStartedAt: null,
          },
        });
        if (claimed.count === 1) {
          const promoted = await tx.event.updateMany({
            where: { id: candidateId, characterRunId, status: "DISCARDED" },
            data: { status: "ACTIVE" },
          });
          if (promoted.count !== 1) {
            throw new Error("Claimed event candidate could not be promoted to ACTIVE.");
          }
          await onClaim?.(tx);
        }
        return claimed.count === 1;
      });
    },

    async discardCandidate(candidateId) {
      await client.event.updateMany({
        where: { id: candidateId, characterRunId, status: "ACTIVE" },
        data: { status: "DISCARDED" },
      });
    },
  };
}

export function toPublicEvent(event: PersistedEvent) {
  return {
    id: event.id,
    title: event.title,
    body: event.body,
    choices: event.choices,
    source: event.source,
    forced: event.source === "FORCED",
  };
}
