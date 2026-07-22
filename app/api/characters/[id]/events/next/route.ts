import { NextResponse } from "next/server";
import type { EventSource } from "@prisma/client";

import { getStoryArc, isEventAllowedForLifeStage, selectNextEvent, type StaticEvent } from "@/lib/game/event-engine";
import { evaluateCandidateEvent, findValidatedStaticFallback } from "@/lib/game/event-quality-policy";
import { deriveLifeStageState } from "@/lib/game/life-stage";
import { checkDailyAiLimit, generateAiEvent, getOpenRouterTimeoutMs, incrementAiUsage } from "@/lib/game/openrouter";
import { recordEventQualityLog } from "@/lib/server/event-quality-log";
import { acquireAuthoritativeEvent, createPrismaEventAuthorityStore, EventAuthorityLostError, resolveEventGenerationRole, startEventGenerationHeartbeat, toPublicEvent } from "@/lib/server/event-authority";
import { prisma } from "@/lib/server/prisma";
import { requireCurrentUserId } from "@/lib/server/session";
import { logger } from "@/lib/server/logger";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const log = logger.withRequestId(requestId);
  const userId = await requireCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await context.params;

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

  if (!character) {
    return NextResponse.json({ error: "캐릭터를 찾을 수 없습니다." }, { status: 404 });
  }

  if (!character.hiddenState) {
    return NextResponse.json({ error: "캐릭터 데이터가 불완전합니다." }, { status: 500 });
  }

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
  const diversityGuidance = buildDiversityGuidance(character.eventHistory);
  const lastHistory = character.eventHistory[0];
  const previousChoiceSummary = lastHistory?.summary;
  const selectionContext = {
    burnoutRisk: character.hiddenState.burnoutRisk,
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
      avoidPeople: diversityGuidance.avoidPeople,
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
        aiResult = await generateAiEvent(aiState, { skipPrimary: !limit.allowed });
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

      if (initialEvaluation.verdict.status === "pass" && isEventAllowedForLifeStage({ title: aiEvent.title, tags: aiEvent.tags }, selectionContext)) {
        selectedEvent = aiEvent;
        source = "AI";
      } else if (initialEvaluation.verdict.hardFailure) {
        aiFailed = true;
        generationReason = "post_parse_quality_failure";
        generationStage = "quality";
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
        tags: selectedEvent.tags,
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
    totalElapsedMs,
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
  const tension = Math.max(10, Math.min(95, tensionBase + (arc.phase === "위기" ? 9 : arc.phase === "절정" ? 12 : 4) + Math.min(12, riskDebt * 2)));
  const openThreads = Array.isArray(base.openThreads) && base.openThreads.length > 0
    ? base.openThreads.filter((thread) => typeof thread === "string")
    : [arc.openThread];
  const activeThreads = Array.isArray(flags.activeStoryThreads)
    ? flags.activeStoryThreads.filter((thread) => typeof thread === "string")
    : [];

  return {
    title: arc.title,
    premise: typeof base.premise === "string" ? base.premise : "작은 대학 생활의 선택들이 취업, 관계, 휴학, 직업으로 이어진다.",
    phase: arc.phase,
    chapter: Math.floor(coreEventCount / 3) + 1,
    tension,
    foreshadowing: Array.isArray(base.foreshadowing) && base.foreshadowing.length > 0
      ? base.foreshadowing
      : ["아직 정체를 알 수 없는 커리어 제안", "처음 보는 듯 익숙한 아침의 위화감"],
    openThreads: [...new Set([arc.openThread, ...openThreads, ...activeThreads])].slice(0, 8),
  };
}

function buildDiversityGuidance(eventHistory: Array<{
  event?: { tags?: unknown };
  relationshipDelta?: unknown;
}>) {
  const recent = eventHistory.slice(0, 5);
  const recentTags = recent.flatMap((history) =>
    Array.isArray(history.event?.tags) ? history.event.tags.filter((tag) => typeof tag === "string") : [],
  );
  const recentPeople = recent.flatMap((history) => readRelationshipNames(history.relationshipDelta));
  const tagCounts = countItems(recentTags.map(normalizeCategory).filter(Boolean));
  const peopleCounts = countItems(recentPeople);
  const avoidCategories = Object.entries(tagCounts)
    .filter(([, count]) => count >= 2)
    .map(([category]) => category);
  const avoidPeople = Object.entries(peopleCounts)
    .filter(([, count]) => count >= 2)
    .map(([name]) => name);
  const allCategories = ["돈", "가족", "연애", "건강", "알바", "동아리/학생회", "해외/여행", "위험", "진로", "생활", "SNS/디지털", "취미/문화", "스펙/경쟁", "주거", "멘탈"];
  const preferCategories = allCategories
    .filter((category) => !tagCounts[category])
    .slice(0, 4);

  return { recentTags, recentPeople, avoidCategories, preferCategories, avoidPeople };
}

function readRelationshipNames(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => typeof item === "object" && item !== null ? (item as Record<string, unknown>).name : null)
    .filter((name): name is string => typeof name === "string" && name.trim().length > 0);
}

function countItems(items: string[]) {
  return items.reduce<Record<string, number>>((counts, item) => {
    counts[item] = (counts[item] ?? 0) + 1;
    return counts;
  }, {});
}

function normalizeCategory(tag: string) {
  if (["학업", "스터디", "시험", "중간고사", "교수", "연구실", "대학원", "수업", "공무원", "공기업", "자격증"].includes(tag)) return "학업/스터디";
  if (["자산", "돈", "월세", "알바", "자취"].includes(tag)) return "돈";
  if (["가족", "본가", "압박"].includes(tag)) return "가족";
  if (["연애", "결혼", "관계"].includes(tag)) return "연애";
  if (["범죄", "위험", "도박", "다단계", "사기"].includes(tag)) return "위험";
  if (["해외", "워홀", "여행", "교환학생"].includes(tag)) return "해외/여행";
  if (["취업", "진로", "면접", "지원서", "기업"].includes(tag)) return "진로";
  if (["건강", "운동", "병원", "감기", "부상"].includes(tag)) return "건강";
  if (["멘탈", "번아웃", "스트레스", "우울", "불안"].includes(tag)) return "멘탈";
  if (["동아리", "학생회", "리더십"].includes(tag)) return "동아리/학생회";
  if (["SNS", "인스타", "유튜브", "커뮤니티", "온라인", "디지털"].includes(tag)) return "SNS/디지털";
  if (["취미", "문화", "전시", "영화", "게임", "독서", "음악", "밴드"].includes(tag)) return "취미/문화";
  if (["스펙", "인턴", "어학", "공모전", "포트폴리오", "코딩테스트", "인성검사"].includes(tag)) return "스펙/경쟁";
  if (["기숙사", "자취", "월세", "룸메", "하숙"].includes(tag)) return "주거";
  return tag;
}
