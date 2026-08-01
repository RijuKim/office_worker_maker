import type { EventSource } from "@prisma/client";
import type { NextRequest } from "next/server";

import { getStoryArc, isEventAllowedForLifeStage, personalizeEvent, selectNextEvent, STORY_CORE_QUESTION, type EventSelectionContext, type StaticEvent } from "@/lib/game/event-engine";
import { evaluateCandidateEvent, findValidatedStaticFallback } from "@/lib/game/event-quality-policy";
import { deriveLifeStageState } from "@/lib/game/life-stage";
import { normalizeCareerNarrativeState, summarizeCareerNarrativeForPrompt } from "@/lib/game/career-narrative";
import { buildDiversityCategoryGuidance, collectRecentPeople, eventMatchesCategory, normalizeEventCategory, selectStoryCategoryPalette } from "@/lib/game/event-diversity";
import { checkDailyAiLimit, generateAiEventStream, getOpenRouterTimeoutMs, incrementAiUsage } from "@/lib/game/openrouter";
import { recordEventQualityLog } from "@/lib/server/event-quality-log";
import { acquireAuthoritativeEvent, createPrismaEventAuthorityStore, EventAuthorityLostError, resolveEventGenerationRole, startEventGenerationHeartbeat, toPublicEvent, type EventGenerationHeartbeat } from "@/lib/server/event-authority";
import { prisma } from "@/lib/server/prisma";
import { requireCurrentUserId } from "@/lib/server/session";
import { logger } from "@/lib/server/logger";

type RouteContext = { params: Promise<Record<string, string>> };

export type SseSendObservation = {
  event: string;
  elapsedMs: number;
};

class StreamCancelledError extends Error {
  constructor() {
    super("The event stream consumer disconnected.");
    this.name = "StreamCancelledError";
  }
}

/**
 * Samples timing at the enqueue-call boundary. Keeping this tiny boundary
 * injectable makes telemetry deterministic without replacing the global clock
 * or depending on stream-controller scheduling details.
 */
export function createSseSender({
  controller,
  encoder,
  generationStartedAt,
  now = Date.now,
  observe,
}: {
  controller: Pick<ReadableStreamDefaultController<Uint8Array>, "enqueue">;
  encoder: TextEncoder;
  generationStartedAt: number;
  now?: () => number;
  observe?: (observation: SseSendObservation) => unknown;
}) {
  return (event: string, data: unknown) => {
    const elapsedMs = now() - generationStartedAt;
    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
    try {
      // Observation is deliberately best-effort and happens only after the
      // frame is owned by the stream. Promise-returning observers are not
      // awaited, so telemetry can never hold delivery hostage.
      const observation = observe?.({ event, elapsedMs });
      if (observation && typeof (observation as PromiseLike<unknown>).then === "function") {
        void Promise.resolve(observation).catch(() => {});
      }
    } catch {
      // Telemetry must never change public SSE delivery semantics.
    }
  };
}

export type NextEventStreamRouteDependencies = {
  now?: () => number;
  observeSend?: (observation: SseSendObservation) => unknown;
};

export function createNextEventStreamPost({
  now = Date.now,
  observeSend,
}: NextEventStreamRouteDependencies = {}) {
  return async function nextEventStreamPost(request: Request | NextRequest, context: RouteContext) {
  const routeStartedAt = Date.now();
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const log = logger.withRequestId(requestId);
  const userId = await requireCurrentUserId();
  if (!userId) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await context.params;
  const encoder = new TextEncoder();
  let generationLease: EventGenerationHeartbeat | null = null;
  let cancelled = false;

  return new Response(new ReadableStream({
    async start(controller) {
      const generationStartedAt = now();
      let generationCompleteMs: number | null = null;
      let timeToFirstVisibleBodyMs: number | null = null;
      let timeToFinalEventMs: number | null = null;
      const send = createSseSender({
        controller,
        encoder,
        generationStartedAt,
        now,
        observe: ({ event, elapsedMs }) => {
          if (event === "event") {
            timeToFirstVisibleBodyMs = elapsedMs;
            timeToFinalEventMs = elapsedMs;
          }
          observeSend?.({ event, elapsedMs });
        },
      });
      const assertConnected = () => {
        if (cancelled) throw new StreamCancelledError();
      };
      try {
        assertConnected();
        send("status", { message: "선택의 시간이 다가오고 있습니다..." });
        const characterLoadStartedAt = Date.now();
        const character = await prisma.characterRun.findFirst({
          where: { id, userId },
          include: {
            stats: true,
            hiddenState: true,
            relationships: { orderBy: { createdAt: "asc" } },
            specs: { orderBy: { startedAt: "asc" } },
            jobApplications: { orderBy: { createdAt: "asc" } },
            careerPaths: { orderBy: { startedAt: "asc" } },
            eventHistory: {
              orderBy: { createdAt: "desc" },
              take: 20,
              include: { event: true },
            },
          },
        });
        const characterLoadMs = Date.now() - characterLoadStartedAt;
        assertConnected();

        if (!character || !character.hiddenState) {
          send("error", { error: character ? "캐릭터 데이터가 불완전합니다." : "캐릭터를 찾을 수 없습니다." });
          return;
        }

        if (character.academicStatus === "GRADUATED" || character.academicStatus === "DROPPED_OUT") {
          send("error", { error: "이미 완료된 이야기입니다." });
          return;
        }

        const authorityStartedAt = Date.now();
        let authorityStore = createPrismaEventAuthorityStore({ client: prisma, characterRunId: id, userId });
        const committedEvent = await authorityStore.getCurrent();
        assertConnected();
        if (committedEvent) {
          send("event", { event: toPublicEvent(committedEvent) });
          return;
        }
        const generationRole = await resolveEventGenerationRole({
          client: prisma,
          store: authorityStore,
          characterRunId: id,
          userId,
          leaseMs: getOpenRouterTimeoutMs() + 5_000,
        });
        const authorityResolveMs = Date.now() - authorityStartedAt;
        if (generationRole.missing) {
          assertConnected();
          send("error", { error: "캐릭터를 찾을 수 없습니다." });
          return;
        }
        if (generationRole.event) {
          assertConnected();
          send("event", { event: toPublicEvent(generationRole.event) });
          return;
        }
        const generationToken = generationRole.token;
        // The role resolver may acquire the database token while the client is
        // disconnecting. Own the matching cleanup handle before observing
        // cancellation so every acquired token reaches the fenced finally.
        generationLease = startEventGenerationHeartbeat({
          client: prisma, characterRunId: id, userId, token: generationToken,
          leaseMs: getOpenRouterTimeoutMs() + 5_000,
        });
        authorityStore = createPrismaEventAuthorityStore({
          client: prisma, characterRunId: id, userId, generationToken,
        });
        assertConnected();

        const currentFlags = (character.hiddenState.eventFlags as Record<string, unknown>) ?? {};
        const lifeStage = deriveLifeStageState({
          eventFlags: currentFlags,
          currentGradeYear: character.currentGradeYear,
          academicStatus: character.academicStatus,
          coreEventCount: character.coreEventCount,
          major: character.major,
        });
        const careerNarrative = normalizeCareerNarrativeState(currentFlags.careerState, {
          storySeed: character.id,
          major: character.major,
          coreEventCount: character.coreEventCount,
        });
        const diversityGuidance = buildDiversityGuidance(character.eventHistory, character.relationships, character.coreEventCount, character.id);
        const selectionContext: EventSelectionContext = {
          burnoutRisk: character.hiddenState.burnoutRisk,
          major: character.major,
          coreEventCount: character.coreEventCount,
          age: character.age,
          gradeYear: character.currentGradeYear,
          residence: getResidence(character.hiddenState.familyState),
          stats: character.stats ? {
            academic: character.stats.academic,
            practical: character.stats.practical,
            communication: character.stats.communication,
            creativity: character.stats.creativity,
            health: character.stats.health,
            mental: character.stats.mental,
            network: character.stats.network,
            wealth: character.stats.wealth,
            reputation: character.stats.reputation,
            charm: character.stats.charm,
          } : undefined,
          relationships: character.relationships.map((rel: { name: string; role: string; trust: number }) => ({
            name: rel.name,
            role: rel.role,
            trust: rel.trust,
          })),
          eventFlags: currentFlags,
          lifeStage: lifeStage.lifeStage,
          academicPlan: lifeStage.academicPlan,
          graduation: lifeStage.graduation,
          destinationCandidates: lifeStage.destinationCandidates,
          specs: character.specs.map((spec: { specType: string; specName: string; status: string; score: string | null }) => ({
            specType: spec.specType,
            specName: spec.specName,
            status: spec.status,
            score: spec.score,
          })),
          jobApplications: character.jobApplications.map((app: { companyName: string; companyType: string; currentStage: string; isActive: boolean }) => ({
            companyName: app.companyName,
            companyType: app.companyType,
            currentStage: app.currentStage,
            isActive: app.isActive,
          })),
          careerPaths: character.careerPaths.map((path: { pathType: string; pathName: string; status: string }) => ({
            pathType: path.pathType,
            pathName: path.pathName,
            status: path.status,
          })),
          recentTags: diversityGuidance.recentTags,
          recentRelationshipNames: diversityGuidance.recentPeople,
        };

        const recentSummaries = character.eventHistory.map((history: { summary: string }) => history.summary).filter(Boolean) as string[];
        const previousChoiceSummary = character.eventHistory[0]?.summary ?? null;
        const qualityContext = {
          academicStatus: character.academicStatus,
          lifeStage: lifeStage.lifeStage,
          eventFlags: currentFlags,
          recentSummaries,
          recentEvents: character.eventHistory.map((history: {
            summary: string;
            relationshipDelta: unknown;
            event?: { title?: string | null; body?: string | null; tags?: unknown };
          }) => ({
            title: history.event?.title,
            body: history.event?.body,
            summary: history.summary,
            tags: Array.isArray(history.event?.tags) ? history.event.tags.filter((tag) => typeof tag === "string") : [],
            people: readRelationshipNames(history.relationshipDelta),
          })),
          previousChoiceSummary,
          careerOrganizations: careerNarrative.organizations.map((organization) => organization.name),
          activeJobCompany: character.jobApplications
            .filter((app: { isActive: boolean }) => app.isActive)
            .map((app: { companyName: string }) => app.companyName)[0] ?? careerNarrative.takenOpportunities.at(-1) ?? null,
          closedCompanies: [...new Set([
            ...character.jobApplications
              .filter((app: { isActive: boolean }) => !app.isActive)
              .map((app: { companyName: string }) => app.companyName),
            ...careerNarrative.missedOpportunities,
          ])],
        };
        const usedEventTitles = character.eventHistory.map((history: { event?: { title?: string } }) => history.event?.title).filter(Boolean) as string[];
        const recentlySeenUserEventTitles = await getRecentlySeenUserEventTitles(userId, id);
        const excludedEventTitles = [...new Set([...usedEventTitles, ...recentlySeenUserEventTitles])];
        const storyArc = advanceStoryArc(currentFlags.storyArc, character.coreEventCount, currentFlags);
        let selectedEvent: StaticEvent | null = null;
        let source: EventSource = "FALLBACK";
        let aiAttempted = false;
        let aiFailed = false;
        let retryUsed = false;
        let fallbackUsed = false;
        let providerElapsedMs = 0;
        let generationReason: string | null = null;
        let generationStage: "provider" | "parse" | "quality" | null = null;
        let generationSlow = false;
        let qualityElapsedMs = 0;
        let providerId: string | null = null;
        let providerFailures: unknown[] = [];
        let providerFirstBodyMs: number | null = null;

        if (character.stats && canUseAiForLifeStage(lifeStage.lifeStage, character.academicStatus)) {
          aiAttempted = true;
          const limit = await checkDailyAiLimit(userId);
          assertConnected();
          const aiState = {
            name: character.name,
            age: character.age,
            residence: selectionContext.residence,
            major: character.major,
            gradeYear: character.currentGradeYear,
            coreEventCount: character.coreEventCount,
            recentSummaries,
            usedEventTitles: excludedEventTitles,
            storyArc,
            eventFlags: currentFlags,
            relationships: character.relationships.map((rel: { name: string; role: string; trust: number }) => ({
              name: rel.name,
              role: rel.role,
              trust: rel.trust,
            })),
            stats: {
              academic: character.stats.academic,
              practical: character.stats.practical,
              health: character.stats.health,
              mental: character.stats.mental,
              wealth: character.stats.wealth,
              charm: character.stats.charm,
              reputation: character.stats.reputation,
            },
            lifeStage: lifeStage.lifeStage,
            graduation: lifeStage.graduation,
            academicTerm: lifeStage.term.label,
            academicPlan: lifeStage.academicPlan,
            destinationCandidates: lifeStage.destinationCandidates,
            specs: selectionContext.specs,
            jobApplications: selectionContext.jobApplications,
            careerPaths: selectionContext.careerPaths,
            avoidCategories: diversityGuidance.avoidCategories,
            preferCategories: diversityGuidance.preferCategories,
            targetCategory: diversityGuidance.targetCategory,
            allowedCategories: diversityGuidance.allowedCategories,
            careerNarrative: summarizeCareerNarrativeForPrompt(careerNarrative),
            avoidPeople: diversityGuidance.avoidPeople,
            closedCompanies: qualityContext.closedCompanies,
          };

          const providerStartedAt = Date.now();
          let aiResult: Awaited<ReturnType<typeof generateAiEventStream>> | {
            success: false; reason: "api_error"; providerId: null; providerLabel: null;
            providerElapsedMs: number; totalElapsedMs: number; slow: boolean; retryUsed: false;
            providerFailures: Array<{ providerId: null; providerLabel: null; providerElapsedMs: number; reason: "api_error"; stage: "provider" }>;
          };
          try {
            aiResult = await generateAiEventStream(aiState, (text) => {
              if (text && providerFirstBodyMs === null) {
                providerFirstBodyMs = now() - generationStartedAt;
              }
            }, { skipPrimary: !limit.allowed });
          } catch {
            const elapsed = Math.max(0, Date.now() - providerStartedAt);
            aiResult = {
              success: false,
              reason: "api_error",
              providerId: null,
              providerLabel: null,
              providerElapsedMs: elapsed,
              totalElapsedMs: elapsed,
              slow: elapsed > 10_000,
              retryUsed: false,
              providerFailures: [{
                providerId: null,
                providerLabel: null,
                providerElapsedMs: elapsed,
                reason: "api_error",
                stage: "provider",
              }],
            };
          }
          assertConnected();
          generationCompleteMs = now() - generationStartedAt;
          providerElapsedMs = aiResult.providerElapsedMs ?? 0;
          generationSlow = aiResult.slow ?? false;
          retryUsed = aiResult.retryUsed ?? false;
          providerId = aiResult.providerId ?? null;
          providerFailures = aiResult.providerFailures ?? [];

            if (aiResult.success) {
            if (aiResult.providerId === "ollama") {
              assertConnected();
              await incrementAiUsage(userId);
              assertConnected();
            }
            const aiEvent = {
              title: aiResult.event.title,
              body: aiResult.event.body,
              choices: aiResult.event.choices.map((choice) => ({
                ...choice,
                relationshipDelta: choice.relationshipDelta ?? [],
                flagDelta: { aiGenerated: true, storyPhase: storyArc.phase },
              })),
              tags: aiResult.event.tags,
              source: "FALLBACK" as const,
            };
            const initialEvaluation = evaluateCandidateEvent("AI", aiEvent, qualityContext);
            recordEventQualityLog({
              characterRunId: id,
              eventId: null,
              phase: "initial_ai",
              source: "AI",
              verdict: initialEvaluation.verdict,
              reasons: initialEvaluation.verdict.reasons,
              diversityScore: initialEvaluation.verdict.diversityScore,
              continuityExemptions: initialEvaluation.verdict.continuityExemptions,
              retryUsed,
              fallbackUsed: false,
              selectedFallbackTitle: null,
              durationMs: initialEvaluation.durationMs,
              createdAt: new Date().toISOString(),
            });
            qualityElapsedMs = initialEvaluation.durationMs;

            const matchesTargetCategory = !diversityGuidance.targetCategory || eventMatchesCategory(diversityGuidance.targetCategory, aiEvent);
            if (initialEvaluation.verdict.status === "pass" && matchesTargetCategory && isEventAllowedForLifeStage({ title: aiEvent.title, tags: aiEvent.tags }, selectionContext)) {
              selectedEvent = aiEvent;
              source = "AI";
            } else if (initialEvaluation.verdict.hardFailure || !matchesTargetCategory) {
              // Attempt same-Ollama targeted correction/regeneration for quality rejections
              // before falling through to OpenRouter or static fallback.
              const qualityRepairResult = await attemptQualityRepair(aiState, aiResult, initialEvaluation, diversityGuidance, qualityContext, selectionContext, id, userId, log);
              if (qualityRepairResult) {
                selectedEvent = qualityRepairResult.event;
                source = "AI";
                retryUsed = true;
                providerFailures = [...(aiResult.providerFailures ?? []), {
                  providerId: "ollama",
                  providerLabel: "Ollama GPT-OSS",
                  providerElapsedMs: 0,
                  reason: matchesTargetCategory ? "narrative_schema" : "target_category_mismatch",
                  stage: "quality",
                  issues: initialEvaluation.verdict.reasons,
                }];
              } else {
                aiFailed = true;
                generationReason = matchesTargetCategory ? "post_parse_quality_failure" : "target_category_mismatch";
                generationStage = "quality";
              }
            } else {
              selectedEvent = aiEvent;
              source = "AI";
            }
          } else {
            aiFailed = true;
            generationReason = aiResult.reason;
            generationStage = aiResult.providerFailures?.at(-1)?.stage ?? "provider";
          }
        }

        if (!selectedEvent) {
          const { type, event } = selectNextEvent(selectionContext, excludedEventTitles);
          if (aiAttempted && type !== "forced") {
            const fallback = findValidatedStaticFallback({
              preferredEvent: event, selectionContext, excludedEventTitles, qualityContext,
            });
            if (!fallback) {
              log.error("검증된 대체 이벤트 없음", { userId, characterId: id, generationReason });
              send("error", { error: "다음 사건을 생성하지 못했습니다." });
              return;
            }
            selectedEvent = fallback.event;
            source = "FALLBACK";
            recordEventQualityLog({
              characterRunId: id, eventId: null, phase: "static_fallback", source,
              verdict: fallback.evaluation.verdict, reasons: fallback.evaluation.verdict.reasons,
              diversityScore: fallback.evaluation.verdict.diversityScore,
              continuityExemptions: fallback.evaluation.verdict.continuityExemptions,
              retryUsed, fallbackUsed: true, selectedFallbackTitle: fallback.event.title,
              durationMs: fallback.evaluation.durationMs, createdAt: new Date().toISOString(),
            });
          } else {
            selectedEvent = event;
            source = type === "forced" ? "FORCED" : event.source;
          }
          fallbackUsed = source === "FALLBACK";
        }

        if (!selectedEvent) {
          send("error", {
            error: "다음 사건을 생성하지 못했습니다.",
          });
          return;
        }

        const candidateId = crypto.randomUUID();
        assertConnected();
        generationLease.assertOwned();
        selectedEvent = personalizeEvent(selectedEvent, character.name);

        const commitStartedAt = Date.now();
        const newEvent = await acquireAuthoritativeEvent({
          store: authorityStore,
          generate: async () => {
            assertConnected();
            generationLease?.assertOwned();
            return {
              id: candidateId,
              status: "ACTIVE",
              title: selectedEvent.title,
              body: selectedEvent.body,
              source,
              choices: selectedEvent.choices,
              tags: selectedEvent.tags,
            };
          },
          onCommitted: async (_event, transaction) => {
            assertConnected();
            generationLease?.assertOwned();
            const tx = transaction as Pick<typeof prisma, "hiddenState">;
            await tx.hiddenState.update({
              where: { characterRunId: id },
              data: {
                eventFlags: {
                  ...currentFlags,
                  storyArc,
                  lastEventSource: source,
                  ...(fallbackUsed ? { lastAiFallbackReason: "quality_or_generation_failed" } : {}),
                },
              },
            });
            assertConnected();
          },
        });
        const commitMs = Date.now() - commitStartedAt;
        assertConnected();
        // Provider output stays buffered until the candidate is committed.
        // Deliver the complete committed event at once so the client does not
        // wait through a second, artificial typing phase.
        send("event", { event: toPublicEvent(newEvent) });
        const totalElapsedMs = now() - generationStartedAt;
        log.info("스트림 이벤트 생성 완료", {
          userId,
          characterId: id,
          eventId: newEvent.id,
          source: newEvent.source,
          aiAttempted,
          aiFailed,
          retryUsed,
          fallbackUsed,
          generationReason,
          generationStage,
          qualityElapsedMs,
          providerId,
          providerFailures,
          providerElapsedMs,
          characterLoadMs,
          authorityResolveMs,
          commitMs,
          totalElapsedMs,
          routeTotalElapsedMs: Date.now() - routeStartedAt,
          slow: generationSlow || totalElapsedMs > 10_000,
          providerFirstBodyMs,
          generationCompleteMs,
          timeToFirstVisibleBodyMs,
          timeToFinalEventMs,
          lifeStage: lifeStage.lifeStage,
        });

      } catch (error) {
        if (error instanceof StreamCancelledError || cancelled) return;
        if (error instanceof EventAuthorityLostError) {
          send("error", { error: "진행 중인 이벤트가 없습니다." });
          return;
        }
        console.error("Next event stream route failed", error);
        log.error("스트림 이벤트 생성 중 예외", { userId, characterId: id, error: String(error) });
        send("error", { error: "다음 사건을 생성하지 못했습니다." });
      } finally {
        await generationLease?.stop();
        try {
          controller.close();
        } catch {
          // The consumer may already have cancelled the stream.
        }
      }
    },
    async cancel() {
      cancelled = true;
      await generationLease?.stop();
    },
  }), {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "text/event-stream; charset=utf-8",
      Connection: "keep-alive",
    },
  });
};
}

export const POST = createNextEventStreamPost();

function canUseAiForLifeStage(lifeStage: string, academicStatus: string) {
  return academicStatus === "ENROLLED" && (
    lifeStage === "college_early" ||
    lifeStage === "college_mid" ||
    lifeStage === "college_late"
  );
}

async function getRecentlySeenUserEventTitles(userId: string, currentCharacterRunId: string) {
  const recentHistory = await prisma.eventHistory.findMany({
    where: {
      characterRun: {
        userId,
        id: { not: currentCharacterRunId },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: { event: true },
  });

  return recentHistory.map((history: { event?: { title?: string } }) => history.event?.title).filter(Boolean) as string[];
}

function getResidence(rawFamilyState: unknown) {
  const familyState = typeof rawFamilyState === "object" && rawFamilyState !== null ? rawFamilyState as Record<string, unknown> : {};
  return typeof familyState.residence === "string" ? familyState.residence : null;
}

function advanceStoryArc(rawArc: unknown, coreEventCount: number, flags: Record<string, unknown>) {
  const base = typeof rawArc === "object" && rawArc !== null ? rawArc as Record<string, unknown> : {};
  const arc = getStoryArc(coreEventCount);
  const tensionBase = typeof base.tension === "number" ? base.tension : 18;
  const riskDebt = typeof flags.riskDebt === "number" ? flags.riskDebt : 0;
  const phaseTension = arc.phase === "절정" ? 12 : arc.phase === "위기" ? 9 : arc.phase === "심화" || arc.phase === "결단" ? 7 : 4;
  const tension = Math.max(10, Math.min(95, tensionBase + phaseTension + Math.min(12, riskDebt * 2)));
  const openThreads = Array.isArray(base.openThreads) && base.openThreads.length > 0
    ? base.openThreads.filter((thread) => typeof thread === "string")
    : [arc.openThread];
  const activeThreads = Array.isArray(flags.activeStoryThreads)
    ? flags.activeStoryThreads.filter((thread) => typeof thread === "string")
    : [];

  return {
    ...base,
    title: arc.title,
    premise: typeof base.premise === "string" ? base.premise : "취업을 준비하는 동안 무엇을 지키고 포기할지 선택한다.",
    coreQuestion: STORY_CORE_QUESTION,
    phase: arc.phase,
    chapter: Math.floor(coreEventCount / 3) + 1,
    currentArcId: arc.id,
    dramaticQuestion: arc.dramaticQuestion,
    focusAxes: arc.focusAxes,
    tension,
    openThreads: [...new Set([arc.openThread, ...activeThreads, ...openThreads])].slice(0, 8),
  };
}

function buildDiversityGuidance(eventHistory: Array<{
  event?: { title?: string | null; body?: string | null; tags?: unknown };
  relationshipDelta?: unknown;
}>, relationships: Array<{ name: string }>, coreEventCount: number, storySeed: string) {
  const recent = eventHistory.slice(0, 5);
  const recentTags = recent.flatMap((history) =>
    Array.isArray(history.event?.tags) ? history.event.tags.filter((tag) => typeof tag === "string") : [],
  );
  const { recentPeople, avoidPeople } = collectRecentPeople(recent, relationships);
  const allowedCategories = selectStoryCategoryPalette(storySeed);
  const categoryGuidance = buildDiversityCategoryGuidance(
    recentTags.map(normalizeEventCategory).filter(Boolean),
    allowedCategories,
    2,
    coreEventCount % 3 === 2,
  );
  const avoidCategories = categoryGuidance.avoidCategories;
  const preferCategories = categoryGuidance.preferCategories;
  const targetCategory = categoryGuidance.targetCategory;

  return { recentTags, recentPeople, avoidCategories, preferCategories, targetCategory, allowedCategories, avoidPeople };
}

function readRelationshipNames(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => typeof item === "object" && item !== null ? (item as Record<string, unknown>).name : null)
    .filter((name): name is string => typeof name === "string" && name.trim().length > 0);
}

/**
 * Attempt a same-Ollama targeted correction/regeneration when the initial AI
 * event passes parsing but fails quality checks (hard failure or target category
 * mismatch). Returns a corrected event on success, or null if repair fails.
 */
async function attemptQualityRepair(
  aiState: Record<string, unknown>,
  originalResult: { event: { title: string; body: string; tags: string[]; choices: unknown[] } },
  qualityEvaluation: { verdict: { reasons: string[]; diversityScore: number; continuityExemptions: string[] }; durationMs: number },
  diversityGuidance: { targetCategory?: string | null },
  qualityContext: Record<string, unknown>,
  selectionContext: EventSelectionContext,
  characterRunId: string,
  userId: string,
  log: ReturnType<typeof logger.withRequestId>,
): Promise<{ event: StaticEvent } | null> {
  const repairPrompt = buildQualityRepairPrompt(aiState, originalResult, qualityEvaluation, diversityGuidance);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const ollamaKey = process.env.OLLAMA_API_KEY?.trim() || null;
    if (!ollamaKey) return null;
    const ollamaModel = (process.env.OLLAMA_MODEL ?? "gpt-oss:20b").trim();
    const response = await fetch("https://ollama.com/api/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ollamaKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ollamaModel,
        messages: [
          { role: "system", content: repairPrompt.system },
          { role: "user", content: repairPrompt.user },
        ],
        format: "json",
        stream: false,
        think: "low",
        options: {
          temperature: 0.4,
          num_predict: 2_000,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const responseText = await response.text();
    let parsedData: unknown;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      return null;
    }
    const data = parsedData as Record<string, unknown> | null;
    const message = data?.message;
    const content: string | undefined = message && typeof message === "object"
      ? (message as Record<string, unknown>).content as string | undefined
      : undefined;
    if (!content) return null;

    const { parseAiEventContentDetailed } = await import("@/lib/game/openrouter");
    const parsed = parseAiEventContentDetailed(content);
    if (!parsed.success) return null;

    const { evaluateCandidateEvent } = await import("@/lib/game/event-quality-policy");
    const { isEventAllowedForLifeStage } = await import("@/lib/game/event-engine");
    const { eventMatchesCategory } = await import("@/lib/game/event-diversity");
    const repairedEvent = {
      title: parsed.event.title,
      body: parsed.event.body,
      choices: parsed.event.choices.map((choice) => ({
        ...choice,
        relationshipDelta: choice.relationshipDelta ?? [],
        flagDelta: { aiGenerated: true, qualityRepair: true },
      })),
      tags: parsed.event.tags,
      source: "FALLBACK" as const,
    };
    const repairEvaluation = evaluateCandidateEvent("AI", repairedEvent, qualityContext as Parameters<typeof evaluateCandidateEvent>[2]);
    const matchesTarget = !diversityGuidance.targetCategory || eventMatchesCategory(diversityGuidance.targetCategory, repairedEvent);
    if (repairEvaluation.verdict.status === "pass" && matchesTarget && isEventAllowedForLifeStage({ title: repairedEvent.title, tags: repairedEvent.tags }, selectionContext)) {
      return { event: repairedEvent };
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function buildQualityRepairPrompt(
  aiState: Record<string, unknown>,
  originalResult: { event: { title: string; body: string; tags: string[]; choices: unknown[] } },
  qualityEvaluation: { verdict: { reasons: string[]; diversityScore: number; continuityExemptions: string[] }; durationMs: number },
  diversityGuidance: { targetCategory?: string | null },
): { system: string; user: string } {
  const reasons = qualityEvaluation.verdict.reasons.join(", ");
  const targetCategory = diversityGuidance.targetCategory;
  const categoryGuidance = targetCategory
    ? `이번 사건의 필수 주제는 "${targetCategory}"입니다. 제목, 갈등, 본문, 태그에 이 주제를 반영해야 합니다.`
    : "자유 주제로 생성하되 최근 맥락과 겹치지 않게 합니다.";

  return {
    system: `한국 대학생활 텍스트 어드벤처 사건 하나를 JSON으로 작성한다. 이전 시도에서 다음 이유로 거절되었다: ${reasons}.
${categoryGuidance}
JSON 형식: {"title","body","tags","choices"}. choices는 2-3개, 각각 {"id","label","summary","statDelta","relationshipDelta"}.
body는 한국어 2문단. summary는 "당신은"으로 시작.
statDelta: academic/practical/health/mental/wealth/reputation/charm (정수 -15~15, health/mental -1 이상).
이전과 완전히 다른 내용으로 생성한다. 같은 제목, 같은 갈등, 같은 인물 조합을 반복하지 않는다.
temperature 0.4, JSON만 출력.`,
    user: `주인공 정보: ${JSON.stringify({
      name: aiState.name,
      age: aiState.age,
      major: aiState.major,
      lifeStage: aiState.lifeStage,
      coreEventCount: aiState.coreEventCount,
    })}
이전 시도 제목: "${originalResult.event.title}"
이전 시도 태그: ${JSON.stringify(originalResult.event.tags)}
거절 사유: ${reasons}
다양성 점수: ${qualityEvaluation.verdict.diversityScore}
${categoryGuidance}
완전히 다른 사건을 생성하라.`,
  };
}
