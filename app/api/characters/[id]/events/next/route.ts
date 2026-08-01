import { NextResponse, type NextRequest } from "next/server";
import type { EventSource } from "@prisma/client";

import { getStoryArc, isEventAllowedForLifeStage, personalizeEvent, selectNextEvent, STORY_CORE_QUESTION, type EventSelectionContext, type StaticEvent } from "@/lib/game/event-engine";
import { evaluateCandidateEvent, findValidatedStaticFallback } from "@/lib/game/event-quality-policy";
import { deriveLifeStageState } from "@/lib/game/life-stage";
import { normalizeCareerNarrativeState, summarizeCareerNarrativeForPrompt } from "@/lib/game/career-narrative";
import { buildDiversityCategoryGuidance, collectRecentPeople, eventMatchesCategory, normalizeEventCategory, selectStoryCategoryPalette } from "@/lib/game/event-diversity";
import { checkDailyAiLimit, generateAiEvent, getOpenRouterTimeoutMs, incrementAiUsage } from "@/lib/game/openrouter";
import { NPC_POOL, selectStarterCandidates } from "@/lib/game/npcs";
import { recordEventQualityLog } from "@/lib/server/event-quality-log";
import { acquireAuthoritativeEvent, createPrismaEventAuthorityStore, EventAuthorityLostError, resolveEventGenerationRole, startEventGenerationHeartbeat, toPublicEvent } from "@/lib/server/event-authority";
import { prisma } from "@/lib/server/prisma";
import { requireCurrentUserId } from "@/lib/server/session";
import { logger } from "@/lib/server/logger";

type RouteContext = { params: Promise<Record<string, string>> };

export async function POST(request: Request | NextRequest, context: RouteContext) {
  const routeStartedAt = Date.now();
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const log = logger.withRequestId(requestId);
  const userId = await requireCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await context.params;

  const characterLoadStartedAt = Date.now();
  const character = await prisma.characterRun.findFirst({
    where: { id, userId },
    include: {
      stats: true,
      hiddenState: true,
      relationships: {
        orderBy: { createdAt: "asc" },
      },
      specs: {
        orderBy: { startedAt: "asc" },
      },
      jobApplications: {
        orderBy: { createdAt: "asc" },
      },
      careerPaths: {
        orderBy: { startedAt: "asc" },
      },
      eventHistory: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { event: true },
      },
    },
  });
  const characterLoadMs = Date.now() - characterLoadStartedAt;

  if (!character) {
    return NextResponse.json({ error: "캐릭터를 찾을 수 없습니다." }, { status: 404 });
  }

  if (character.academicStatus === "GRADUATED" || character.academicStatus === "DROPPED_OUT") {
    return NextResponse.json({ error: "이미 완료된 이야기입니다." }, { status: 409 });
  }

  if (!character.hiddenState) {
    return NextResponse.json({ error: "캐릭터 데이터가 불완전합니다." }, { status: 500 });
  }

  const authorityStartedAt = Date.now();
  let authorityStore = createPrismaEventAuthorityStore({ client: prisma, characterRunId: id, userId });
  const committedEvent = await authorityStore.getCurrent();
  if (committedEvent) {
    return NextResponse.json({ event: toPublicEvent(committedEvent) });
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
    return NextResponse.json({ error: "캐릭터를 찾을 수 없습니다." }, { status: 404 });
  }
  if (generationRole.event) {
    return NextResponse.json({ event: toPublicEvent(generationRole.event) });
  }
  const generationToken = generationRole.token;
  const generationLease = startEventGenerationHeartbeat({
    client: prisma, characterRunId: id, userId, token: generationToken,
    leaseMs: getOpenRouterTimeoutMs() + 5_000,
  });
  authorityStore = createPrismaEventAuthorityStore({
    client: prisma, characterRunId: id, userId, generationToken,
  });

  try {
  const currentFlags = (character.hiddenState.eventFlags as Record<string, unknown>) ?? {};
  const lifeStage = deriveLifeStageState({
    eventFlags: currentFlags,
    currentGradeYear: character.currentGradeYear,
    academicStatus: character.academicStatus,
    coreEventCount: character.coreEventCount,
    major: character.major,
  });
  const selectionLifeStage = lifeStage;
  const selectionFlags = currentFlags;
  const careerNarrative = normalizeCareerNarrativeState(currentFlags.careerState, {
    storySeed: character.id,
    major: character.major,
    coreEventCount: character.coreEventCount,
  });
  const diversityGuidance = buildDiversityGuidance(character.eventHistory, character.relationships, character.coreEventCount, character.id);
  const lastHistory = character.eventHistory[0];
  const previousChoiceSummary = lastHistory?.summary;
  const selectionContext = {
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
    eventFlags: selectionFlags,
    lifeStage: selectionLifeStage.lifeStage,
    academicPlan: selectionLifeStage.academicPlan,
    graduation: selectionLifeStage.graduation,
    destinationCandidates: selectionLifeStage.destinationCandidates,
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
    previousChoiceSummary,
  };

  const recentSummaries = character.eventHistory
    .map((h: { summary: string }) => h.summary)
    .filter(Boolean) as string[];
  const qualityContext = {
    academicStatus: character.academicStatus,
    lifeStage: selectionLifeStage.lifeStage,
    eventFlags: selectionFlags,
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
    careerOrganizations: careerNarrative.organizations.map((org: { name: string }) => org.name),
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
  const usedEventTitles = character.eventHistory
    .map((h: { event?: { title?: string } }) => h.event?.title)
    .filter(Boolean) as string[];
  const excludedEventTitles = [...new Set([...usedEventTitles])];
  const storyArc = advanceStoryArc(currentFlags.storyArc, character.coreEventCount, currentFlags);

  let selectedEvent: StaticEvent | null = null;
  let source: EventSource = "FALLBACK";
  let aiAttempted = false;
  let aiFailed = false;
  let retryUsed = false;
  let fallbackUsed = false;
  const generationStartedAt = Date.now();
  let providerElapsedMs = 0;
  let generationReason: string | null = null;
  let generationStage: "provider" | "parse" | "quality" | null = null;
  let generationSlow = false;
  let qualityElapsedMs = 0;
  let providerId: string | null = null;
  let providerFailures: unknown[] = [];

  if (character.stats && canUseAiForLifeStage(selectionLifeStage.lifeStage, character.academicStatus)) {
    aiAttempted = true;
    const limit = await checkDailyAiLimit(userId);
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
      eventFlags: selectionFlags,
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
      lifeStage: selectionLifeStage.lifeStage,
      graduation: selectionLifeStage.graduation,
      academicTerm: selectionLifeStage.term.label,
      academicPlan: selectionLifeStage.academicPlan,
      destinationCandidates: selectionLifeStage.destinationCandidates,
      specs: selectionContext.specs,
      jobApplications: selectionContext.jobApplications,
      careerPaths: selectionContext.careerPaths,
      avoidCategories: diversityGuidance.avoidCategories,
      preferCategories: diversityGuidance.preferCategories,
      targetCategory: diversityGuidance.targetCategory,
      allowedCategories: diversityGuidance.allowedCategories,
      careerNarrative: summarizeCareerNarrativeForPrompt(careerNarrative),
      avoidPeople: diversityGuidance.avoidPeople,
      starterCandidates: validateStarterCandidates(currentFlags.starterCandidates, character.id),
      closedCompanies: qualityContext.closedCompanies,
    };
    const providerStartedAt = Date.now();
    let aiResult: Awaited<ReturnType<typeof generateAiEvent>> | {
      success: false; reason: "api_error"; providerId: null; providerLabel: null;
      providerElapsedMs: number; totalElapsedMs: number; slow: boolean; retryUsed: false;
      providerFailures: Array<{ providerId: null; providerLabel: null; providerElapsedMs: number; reason: "api_error"; stage: "provider" }>;
    };
    try {
      // Integration coverage needs to exercise the same provider-failure fallback
      // branch deterministically. The fixture flag is both written and honored
      // only outside production, so deployed traffic can never activate it.
      if (process.env.NODE_ENV !== "production" && currentFlags.testForceProviderFailure === true) {
        aiResult = {
          success: false,
          reason: "api_error",
          providerId: null,
          providerLabel: null,
          providerElapsedMs: 0,
          totalElapsedMs: 0,
          slow: false,
          retryUsed: false,
          providerFailures: [{
            providerId: null,
            providerLabel: null,
            providerElapsedMs: 0,
            reason: "api_error",
            stage: "provider",
          }],
        };
      } else {
        aiResult = await generateAiEvent(aiState, {
          skipPrimary: !limit.allowed,
          trace: { requestId, characterRunId: id },
        });
      }
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
    providerElapsedMs = aiResult.providerElapsedMs ?? 0;
    generationSlow = aiResult.slow ?? false;
    retryUsed = aiResult.retryUsed ?? false;
    providerId = aiResult.providerId ?? null;
    providerFailures = aiResult.providerFailures ?? [];

    if (aiResult.success) {
      if (aiResult.providerId === "ollama") {
        await incrementAiUsage(userId);
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
        source: "AI" as const,
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
        preferredEvent: event,
        selectionContext,
        excludedEventTitles,
        qualityContext,
      });
      if (!fallback) {
        log.error("검증된 대체 이벤트 없음", { userId, characterId: id, generationReason });
        return NextResponse.json({ error: "다음 사건을 생성하지 못했습니다." }, { status: 500 });
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

  selectedEvent = personalizeEvent(selectedEvent, character.name);

  const commitStartedAt = Date.now();
  let newEvent;
  try {
    generationLease.assertOwned();
    newEvent = await acquireAuthoritativeEvent({
      store: authorityStore,
      generate: async () => ({
        id: crypto.randomUUID(),
        status: "ACTIVE",
        title: selectedEvent.title,
        body: selectedEvent.body,
        source,
        choices: selectedEvent.choices,
        tags: [
          ...selectedEvent.tags,
          ...(providerId ? [`provider:${providerId}`] : []),
          ...(fallbackUsed ? ["fallback:true"] : []),
          ...(generationReason ? [`reason:${generationReason}`] : []),
        ],
      }),
      onCommitted: async (_event, transaction) => {
        const tx = transaction as Pick<typeof prisma, "hiddenState">;
        await tx.hiddenState.update({
          where: { characterRunId: id },
          data: {
            eventFlags: {
              ...selectionFlags,
              storyArc,
              lastEventSource: source,
              lastProviderId: providerId,
              lastFallbackUsed: fallbackUsed,
              lastGenerationReason: generationReason,
              ...(fallbackUsed ? { lastAiFallbackReason: "quality_or_generation_failed" } : {}),
            },
          },
        });
      },
    });
  } catch (error) {
    if (error instanceof EventAuthorityLostError) {
      return NextResponse.json({ error: "진행 중인 이벤트가 없습니다." }, { status: 400 });
    }
    throw error;
  }
  const commitMs = Date.now() - commitStartedAt;
  const totalElapsedMs = Date.now() - generationStartedAt;
  log.info("이벤트 생성 완료", {
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
    timeToFinalEventMs: totalElapsedMs,
    lifeStage: selectionLifeStage.lifeStage,
  });

  return NextResponse.json({ event: toPublicEvent(newEvent) });
  } catch (error) {
    console.error("Next event route failed", error);
    log.error("이벤트 생성 중 예외", { userId, characterId: id, error: String(error) });
    return NextResponse.json({ error: "다음 사건을 생성하지 못했습니다." }, { status: 500 });
  } finally {
    await generationLease.stop();
  }
}

/**
 * Validate starterCandidates from hidden state before passing to the AI prompt.
 * Accepts only an array of 6-8 objects with non-empty string name/role that
 * match safe canonical NPC entries. If invalid, deterministically recomputes
 * 7 candidates from character.id locally (no extra DB/network call).
 */
function validateStarterCandidates(raw: unknown, characterId: string): { name: string; role: string }[] {
  if (!Array.isArray(raw)) return selectStarterCandidates(characterId, 7);
  if (raw.length < 6 || raw.length > 8) return selectStarterCandidates(characterId, 7);
  const safeNames = new Set(NPC_POOL.filter((n) => n.dangerLevel === 0 && n.starterEligible === true).map((n) => n.name));
  const allValid = raw.every(
    (item) =>
      typeof item === "object" && item !== null &&
      typeof (item as Record<string, unknown>).name === "string" &&
      (item as Record<string, unknown>).name !== "" &&
      typeof (item as Record<string, unknown>).role === "string" &&
      (item as Record<string, unknown>).role !== "" &&
      safeNames.has((item as Record<string, unknown>).name as string),
  );
  if (!allValid) return selectStarterCandidates(characterId, 7);
  return raw as { name: string; role: string }[];
}

function canUseAiForLifeStage(lifeStage: string, academicStatus: string) {
  return academicStatus === "ENROLLED" && (
    lifeStage === "college_early" ||
    lifeStage === "college_mid" ||
    lifeStage === "college_late"
  );
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
    title: arc.title,
    premise: typeof base.premise === "string" ? base.premise : "취업을 준비하는 동안 무엇을 지키고 포기할지 선택한다.",
    coreQuestion: STORY_CORE_QUESTION,
    phase: arc.phase,
    currentArcId: arc.id,
    chapter: Math.floor(coreEventCount / 3) + 1,
    dramaticQuestion: arc.dramaticQuestion,
    focusAxes: arc.focusAxes,
    tension,
    foreshadowing: Array.isArray(base.foreshadowing) && base.foreshadowing.length > 0
      ? base.foreshadowing
      : ["아직 정체를 알 수 없는 커리어 제안", "처음 보는 듯 익숙한 아침의 위화감"],
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
