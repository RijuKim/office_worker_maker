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

export function createPrismaEventAuthorityStore({
  client,
  characterRunId,
  userId,
}: {
  client: AuthorityPrisma;
  characterRunId: string;
  userId: string;
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
          where: { id: characterRunId, userId, currentEventId: null },
          data: { currentEventId: candidateId },
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
