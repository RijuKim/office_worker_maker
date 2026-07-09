import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import {
  applyFlagDeltas,
  applyRelationshipDeltas,
  applyStatDeltas,
  normalizeStatDeltas,
  validateChoiceIndex,
} from "@/lib/game/game-rules";
import {
  applyLifeStageTransition,
  deriveRelationshipLifeState,
  getParentingEndingType,
  getRelationshipEndingType,
} from "@/lib/game/life-stage";
import { generateAiEnding } from "@/lib/game/openrouter";
import { gateConcreteResultFields } from "@/lib/game/result-gating";
import {
  evaluateCodingTest,
  evaluateDocumentStage,
  evaluateFinalResult,
  evaluateFirstInterview,
  evaluatePersonalityTest,
  evaluateSecondInterview,
  getCompanyStages,
} from "@/lib/game/spec-system";
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
      relationships: { orderBy: { createdAt: "asc" } },
      events: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      eventHistory: {
        orderBy: { createdAt: "asc" },
        include: { event: true },
      },
      jobApplications: {
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  if (!character) {
    return NextResponse.json({ error: "캐릭터를 찾을 수 없습니다." }, { status: 404 });
  }

  if (!character.stats || !character.hiddenState) {
    return NextResponse.json({ error: "캐릭터 데이터가 불완전합니다." }, { status: 500 });
  }

  const activeEvent = character.events[0];
  if (!activeEvent) {
    return NextResponse.json({ error: "진행 중인 이벤트가 없습니다." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const choiceIndex = body?.choiceIndex;

  const eventChoices = activeEvent.choices as unknown[];
  if (!validateChoiceIndex(eventChoices, choiceIndex)) {
    return NextResponse.json({ error: "올바른 선택을 해주세요." }, { status: 400 });
  }

  const choices = eventChoices as {
    id: string;
    summary: string;
    statDelta: Record<string, number>;
    relationshipDelta: { name: string; trust: number }[];
    flagDelta: Record<string, unknown>;
  }[];
  const choice = choices[choiceIndex];
  if (!choice) {
    return NextResponse.json({ error: "올바른 선택을 해주세요." }, { status: 400 });
  }
  const statDelta = Object.fromEntries(
    Object.entries(normalizeStatDeltas(choice.statDelta))
      .filter((entry): entry is [string, number] => typeof entry[1] === "number"),
  );

  const updatedStats = applyStatDeltas(
    {
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
    },
    statDelta,
  );
  const previousStats = {
    academic: character.stats.academic,
    practical: character.stats.practical,
    health: character.stats.health,
    mental: character.stats.mental,
    wealth: character.stats.wealth,
    reputation: character.stats.reputation,
    charm: character.stats.charm,
  };
  const currentFlags = (character.hiddenState.eventFlags as Record<string, unknown>) ?? {};
  const updatedRelationships = applyRelationshipDeltas(
    character.relationships.map((r: { name: string; trust: number }) => ({ name: r.name, trust: r.trust })),
    choice.relationshipDelta,
  );
  const existingRelationshipNames = new Set(character.relationships.map((rel: { name: string }) => rel.name));
  const newRelationships = choice.relationshipDelta
    .filter((rel) => !existingRelationshipNames.has(rel.name))
    .map((rel) => ({
      characterRunId: id,
      name: rel.name,
      role: inferRelationshipRole(rel.name, activeEvent.title),
      trust: Math.max(-100, Math.min(100, rel.trust >= 0 ? 35 + rel.trust : rel.trust)),
      tags: inferRelationshipTags(rel.name, activeEvent.title),
    }));
  const resolvedFlagDelta = resolveCareerGateFlagDelta({
    flagDelta: choice.flagDelta,
    stats: updatedStats,
    relationships: [...updatedRelationships, ...newRelationships.map((rel) => ({ name: rel.name, trust: rel.trust }))],
    currentFlags,
  });
  const resolvedSummary = appendApplicationOutcomeSummary(
    appendCareerGateOutcomeSummary(choice.summary, resolvedFlagDelta),
    character.jobApplications[0],
    updatedStats,
    resolvedFlagDelta,
  );
  const storyFlagDelta = buildStoryFlagDelta({
    eventTitle: activeEvent.title,
    eventTags: Array.isArray(activeEvent.tags) ? activeEvent.tags.filter((tag) => typeof tag === "string") : [],
    choiceId: choice.id,
    choiceSummary: resolvedSummary,
    statDelta,
    flagDelta: resolvedFlagDelta,
    coreEventCount: character.coreEventCount,
    currentFlags,
  });
  const updatedEventFlags = applyFlagDeltas(currentFlags, {
    ...resolvedFlagDelta,
    ...storyFlagDelta,
  });
  const updatedBurnoutRisk = getNextBurnoutRisk({
    currentRisk: character.hiddenState.burnoutRisk,
    eventSource: activeEvent.source,
    flagDelta: resolvedFlagDelta,
  });
  const lifeStageTransition = applyLifeStageTransition({
    eventFlags: updatedEventFlags,
    currentGradeYear: character.currentGradeYear,
    academicStatus: character.academicStatus,
    coreEventCount: character.coreEventCount,
    major: character.major,
    burnoutRisk: updatedBurnoutRisk,
    stats: {
      academic: updatedStats.academic,
      practical: updatedStats.practical,
      health: updatedStats.health,
      mental: updatedStats.mental,
      reputation: updatedStats.reputation,
    },
  });
  const collapseRisk = getCollapseRisk({
    currentStats: {
      health: character.stats.health,
      mental: character.stats.mental,
      reputation: character.stats.reputation,
    },
    statDelta,
    currentFlags,
  });
  const finalEventFlags = {
    ...updatedEventFlags,
    ...lifeStageTransition.flagDelta,
    ...collapseRisk.flagDelta,
  };
  const hiddenStateAfterTransition = {
    ...character.hiddenState,
    eventFlags: finalEventFlags,
    burnoutRisk: updatedBurnoutRisk,
  };
  const endingType = getImmediateBadEnding(updatedStats, collapseRisk.endingType);
  const relationshipLife = deriveRelationshipLifeState(finalEventFlags);
  const relationshipEndingType = getRelationshipEndingType(
    relationshipLife.relationshipLife,
    updatedStats,
    [...character.relationships, ...newRelationships].map((rel) => ({ name: rel.name, trust: rel.trust })),
  );
  const parentingEndingType = getParentingEndingType(relationshipLife.parenting);
  const coreEventCount = character.coreEventCount + 1;
  const shouldCreateFinalEnding = !endingType && (
    (lifeStageTransition.state.lifeStage === "post_graduation" &&
     lifeStageTransition.state.graduation === "graduated" &&
     coreEventCount >= 36) ||
    coreEventCount >= 40
  );
  const endingRecord = endingType ? await buildImmediateBadEndingRecord({
    userId,
    characterRunId: id,
    characterName: character.name,
    age: character.age,
    major: character.major,
    endingType,
    stats: updatedStats,
    hiddenState: hiddenStateAfterTransition,
    relationships: [...character.relationships, ...newRelationships],
    eventHistory: character.eventHistory,
    eventTitle: activeEvent.title,
    summary: resolvedSummary,
    relationshipLife,
  }) : shouldCreateFinalEnding ? await buildFinalEndingRecord({
    userId,
    characterRunId: id,
    characterName: character.name,
    age: character.age,
    major: character.major,
    stats: updatedStats,
    hiddenState: hiddenStateAfterTransition,
    relationships: [...character.relationships, ...newRelationships],
    eventHistory: character.eventHistory,
    eventTitle: activeEvent.title,
    summary: resolvedSummary,
    coreEventCount: character.coreEventCount + 1,
    relationshipLife,
    relationshipEndingType,
    parentingEndingType,
  }) : null;
  const jobApplicationWrites = buildJobApplicationWrites({
    characterRunId: id,
    specScore: character.specScore,
    stats: updatedStats,
    activeApplication: character.jobApplications[0],
    flagDelta: resolvedFlagDelta,
  });

  await prisma.$transaction([
    prisma.characterStats.update({
      where: { characterRunId: id },
      data: updatedStats,
    }),
    prisma.hiddenState.update({
      where: { characterRunId: id },
      data: {
        burnoutRisk: updatedBurnoutRisk,
        eventFlags: finalEventFlags as object,
      },
    }),
    prisma.event.update({
      where: { id: activeEvent.id },
      data: { status: "RESOLVED" },
    }),
    prisma.eventHistory.create({
      data: {
        characterRunId: id,
        eventId: activeEvent.id,
        choiceId: choice.id,
        summary: resolvedSummary,
        statDelta: statDelta as object,
        relationshipDelta: choice.relationshipDelta as object,
        flagDelta: { ...resolvedFlagDelta, ...storyFlagDelta, ...lifeStageTransition.flagDelta } as object,
      },
    }),
    ...updatedRelationships.map((rel) =>
      prisma.relationship.updateMany({
        where: { characterRunId: id, name: rel.name },
        data: { trust: rel.trust },
      }),
    ),
    ...newRelationships.map((rel) => prisma.relationship.create({ data: rel })),
    ...jobApplicationWrites,
    ...(endingRecord ? [
      prisma.careerEndingRecord.create({ data: endingRecord }),
      prisma.characterRun.update({
        where: { id },
        data: {
          currentEventId: null,
          coreEventCount: { increment: 1 },
          currentGradeYear: lifeStageTransition.state.term.gradeYear,
          academicStatus: endingType ? "DROPPED_OUT" : "GRADUATED",
        },
      }),
    ] : [
      prisma.characterRun.update({
        where: { id },
        data: {
          currentEventId: null,
          coreEventCount: { increment: 1 },
          currentGradeYear: lifeStageTransition.state.term.gradeYear,
          academicStatus: getAcademicStatusForLifeStage(lifeStageTransition.state.lifeStage, character.academicStatus),
          majorEventCount: Math.min(5, Math.floor((character.coreEventCount + 1) / 3) + 1),
        },
      }),
    ]),
  ]);

  log.info("선택 처리 완료", {
    userId,
    characterId: id,
    choiceId: choice.id,
    eventTitle: activeEvent.title,
    endingTriggered: Boolean(endingRecord),
    lifeStage: lifeStageTransition.state.lifeStage,
  });

  let endingRecordId: string | null = null;
  if (endingRecord) {
    const latest = await prisma.careerEndingRecord.findFirst({
      where: { characterRunId: id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    endingRecordId = latest?.id ?? null;
  }

  return NextResponse.json({
    result: {
      choiceId: choice.id,
      summary: resolvedSummary,
      stats: updatedStats,
      statDelta: diffPublicStats(previousStats, updatedStats),
      relationships: [...updatedRelationships, ...newRelationships.map((rel) => ({ name: rel.name, trust: rel.trust }))],
      relationshipDelta: choice.relationshipDelta,
      eventResolved: true,
      endingTriggered: Boolean(endingRecord),
      endingRecordId,
      resultType: endingType ?? (shouldCreateFinalEnding ? "선택의 결과" : lifeStageTransition.reasons.find((reason) => reason !== "no_transition") ?? null),
      lifeStage: lifeStageTransition.state,
    },
  });
}

function getAcademicStatusForLifeStage(lifeStage: string, fallback: string) {
  if (lifeStage === "leave") return "LEAVE" as const;
  if (lifeStage === "dropout") return "DROPPED_OUT" as const;
  if (lifeStage === "post_graduation") return "GRADUATED" as const;
  return fallback as "ENROLLED" | "LEAVE" | "DROPPED_OUT" | "GRADUATED";
}

function diffPublicStats(previous: Record<string, number>, next: Record<string, number>) {
  const keys = ["academic", "practical", "health", "mental", "wealth", "reputation", "charm"];
  return Object.fromEntries(
    keys
      .map((key) => [key, (next[key] ?? previous[key] ?? 0) - (previous[key] ?? 0)] as const)
      .filter(([, delta]) => delta !== 0),
  );
}

function getImmediateBadEnding(stats: Record<string, number>, collapseEndingType: string | null = null) {
  if (collapseEndingType) return collapseEndingType;
  if (stats.health <= 0) return "건강 붕괴";
  if (stats.mental <= 0) return "멘탈 붕괴";
  if (stats.reputation <= 0) return "평판 붕괴";
  return null;
}

function buildJobApplicationWrites(input: {
  characterRunId: string;
  specScore: number;
  stats: Record<string, number>;
  activeApplication?: {
    id: string;
    companyName: string;
    companyType: string;
    currentStage: string;
    specScore: number;
    stageResults: unknown;
  } | null;
  flagDelta: Record<string, unknown>;
}) {
  const writes: Prisma.PrismaPromise<unknown>[] = [];
  const init = readRecord(input.flagDelta.jobApplicationInit);
  if (init && typeof init.companyName === "string" && typeof init.companyType === "string") {
    writes.push(prisma.jobApplication.create({
      data: {
        characterRunId: input.characterRunId,
        companyName: init.companyName,
        companyType: init.companyType,
        currentStage: "DOCUMENT",
        specScore: input.specScore,
        isActive: true,
      },
    }));
    return writes;
  }

  const active = input.activeApplication;
  if (!active) return writes;

  const stageResult = getApplicationStageResult({
    application: active,
    stats: input.stats,
    flagDelta: input.flagDelta,
  });
  if (!stageResult) return writes;

  const stages = getCompanyStages(active.companyType);
  const currentIndex = stages.indexOf(active.currentStage);
  const nextStage = currentIndex >= 0 && currentIndex + 1 < stages.length ? stages[currentIndex + 1] : active.currentStage;
  const isTerminal = active.currentStage === "FINAL_RESULT" || currentIndex < 0 || currentIndex + 1 >= stages.length;
  const previousResults = Array.isArray(active.stageResults) ? active.stageResults.filter((item) => typeof item === "object" && item !== null) : [];

  writes.push(prisma.jobApplication.update({
    where: { id: active.id },
    data: {
      currentStage: stageResult.passed && !isTerminal ? nextStage as never : active.currentStage as never,
      stageResults: [...previousResults, stageResult] as object,
      isActive: stageResult.passed && !isTerminal,
      ...applicationStageFieldUpdate(active.currentStage, stageResult.passed),
    },
  }));

  return writes;
}

function getApplicationStageResult(input: {
  application: {
    companyType: string;
    currentStage: string;
    specScore: number;
    stageResults: unknown;
  };
  stats: Record<string, number>;
  flagDelta: Record<string, unknown>;
}) {
  const stage = input.application.currentStage;
  const flagDelta = input.flagDelta;
  if (flagDelta.applicationFailed === true) {
    return {
      stage,
      passed: false,
      score: 0,
      evaluatedAt: new Date().toISOString(),
    };
  }

  if (flagDelta.evaluateApplicationStage !== true &&
      flagDelta.advanceApplication !== true &&
      flagDelta.codingTestApproach === undefined &&
      flagDelta.interviewStyle === undefined &&
      flagDelta.finalOutcome !== "accepted") {
    return null;
  }

  const evaluation = evaluateApplicationStage({
    application: input.application,
    stats: input.stats,
  });

  return {
    stage,
    passed: evaluation.passed,
    score: evaluation.score,
    evaluatedAt: new Date().toISOString(),
  };
}

function evaluateApplicationStage(input: {
  application: {
    currentStage: string;
    specScore: number;
    stageResults: unknown;
  };
  stats: Record<string, number>;
}) {
  const stats = input.stats;
  if (input.application.currentStage === "DOCUMENT") {
    return evaluateDocumentStage(input.application.specScore, stats.academic, stats.practical);
  }
  if (input.application.currentStage === "PERSONALITY_TEST") {
    return evaluatePersonalityTest(stats.mental, stats.reputation);
  }
  if (input.application.currentStage === "CODING_TEST") {
    return evaluateCodingTest(stats.practical, stats.academic);
  }
  if (input.application.currentStage === "FIRST_INTERVIEW") {
    return evaluateFirstInterview(stats.communication, stats.charm, stats.practical);
  }
  if (input.application.currentStage === "SECOND_INTERVIEW") {
    return evaluateSecondInterview(stats.reputation, stats.mental, stats.charm);
  }

  const previousResults = Array.isArray(input.application.stageResults)
    ? input.application.stageResults.filter((item): item is { score: number } =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as { score?: unknown }).score === "number",
    )
    : [];
  const aggregateScore = previousResults.reduce((sum, result) => sum + result.score, 0);
  return evaluateFinalResult(aggregateScore);
}

function applicationStageFieldUpdate(stage: string, passed: boolean) {
  if (stage === "DOCUMENT") return { documentPassed: passed };
  if (stage === "PERSONALITY_TEST") return { personalityPassed: passed };
  if (stage === "CODING_TEST") return { codingTestPassed: passed };
  if (stage === "FIRST_INTERVIEW") return { firstInterviewPassed: passed };
  if (stage === "SECOND_INTERVIEW") return { secondInterviewPassed: passed };
  if (stage === "FINAL_RESULT") return { finalResult: passed };
  return {};
}

function appendApplicationOutcomeSummary(
  summary: string,
  activeApplication: {
    companyName: string;
    companyType: string;
    currentStage: string;
    specScore: number;
    stageResults: unknown;
  } | undefined,
  stats: Record<string, number>,
  flagDelta: Record<string, unknown>,
) {
  if (!activeApplication || flagDelta.evaluateApplicationStage !== true) return summary;
  const evaluation = evaluateApplicationStage({ application: activeApplication, stats });
  const outcome = evaluation.passed ? "통과했다" : "통과하지 못했다";
  return `${summary} ${activeApplication.companyName} ${applicationStageLabel(activeApplication.currentStage)} 판정 결과, ${outcome}.`;
}

function applicationStageLabel(stage: string) {
  if (stage === "DOCUMENT") return "서류 전형";
  if (stage === "PERSONALITY_TEST") return "인성검사";
  if (stage === "CODING_TEST") return "코딩테스트";
  if (stage === "FIRST_INTERVIEW") return "1차 면접";
  if (stage === "SECOND_INTERVIEW") return "2차 면접";
  if (stage === "FINAL_RESULT") return "최종 전형";
  return "전형";
}

function getCollapseRisk(input: {
  currentStats: { health: number; mental: number; reputation: number };
  statDelta: Record<string, number>;
  currentFlags: Record<string, unknown>;
}) {
  const healthHitAtFloor = input.currentStats.health <= 1 && (input.statDelta.health ?? 0) < 0;
  const mentalHitAtFloor = input.currentStats.mental <= 1 && (input.statDelta.mental ?? 0) < 0;
  const flagDelta: Record<string, unknown> = {};

  if (healthHitAtFloor) {
    if (input.currentFlags.healthCollapseWarning === true) {
      return { endingType: "건강 붕괴", flagDelta };
    }
    flagDelta.healthCollapseWarning = true;
    flagDelta.lastCriticalWarning = "health";
  }

  if (mentalHitAtFloor) {
    if (input.currentFlags.mentalCollapseWarning === true) {
      return { endingType: "멘탈 붕괴", flagDelta };
    }
    flagDelta.mentalCollapseWarning = true;
    flagDelta.lastCriticalWarning = "mental";
  }

  return { endingType: null, flagDelta };
}

function getNextBurnoutRisk(input: {
  currentRisk: number;
  eventSource: string;
  flagDelta: Record<string, unknown>;
}) {
  const currentRisk = Math.max(0, Math.min(100, input.currentRisk));
  const recovered = typeof input.flagDelta.burnoutRecovered === "string";

  if (input.eventSource === "FORCED" && recovered) {
    return Math.max(0, currentRisk - 45);
  }

  return currentRisk;
}

function resolveCareerGateFlagDelta(input: {
  flagDelta: Record<string, unknown>;
  stats: Record<string, number>;
  relationships: { name: string; trust: number }[];
  currentFlags: Record<string, unknown>;
}) {
  const attempt = readRecord(input.flagDelta.careerGateAttempt);
  if (!attempt || typeof attempt.path !== "string") return input.flagDelta;

  const path = attempt.path;
  const approach = typeof attempt.approach === "string" ? attempt.approach : "balanced";
  const riskDebt = typeof input.currentFlags.riskDebt === "number" ? input.currentFlags.riskDebt : 0;
  const relationshipAverage = input.relationships.length > 0
    ? input.relationships.reduce((sum, rel) => sum + rel.trust, 0) / input.relationships.length
    : 0;
  const relationshipBonus = Math.max(-8, Math.min(8, Math.round(relationshipAverage / 12)));
  let score = relationshipBonus - riskDebt * 4;

  if (path === "licensed_profession") {
    score += input.stats.academic * 8 + input.stats.mental * 4 + input.stats.health * 2;
    if (approach === "accuracy") score += input.stats.mental >= 6 ? 6 : 0;
    if (approach === "endurance") score += input.stats.health >= 6 ? 6 : -4;
  } else if (path === "company") {
    score += input.stats.practical * 7 + input.stats.reputation * 5 + input.stats.charm * 2 + input.stats.mental * 2;
    if (input.currentFlags.groupProjectAftermath === "receipts") score += 5;
    if (input.currentFlags.startupThread === "recovered") score += 5;
    if (approach === "project_cases") score += input.stats.practical >= 7 ? 6 : 0;
  } else if (path === "public_safety") {
    score += input.stats.health * 8 + input.stats.academic * 3 + input.stats.reputation * 3 + input.stats.mental * 2;
    if (approach === "push") score += input.stats.health >= 8 ? 6 : -8;
    if (approach === "paced") score += input.stats.mental >= 6 ? 4 : 0;
  } else if (path === "startup") {
    score += input.stats.practical * 8 + input.stats.wealth * 3 + input.stats.reputation * 3 + input.stats.charm * 2;
    if (input.currentFlags.startupThread === "recovered") score += 8;
    if (input.currentFlags.startupThread === "withdrawn") score -= 6;
    if (approach === "metrics") score += input.stats.practical >= 7 ? 6 : -2;
    if (approach === "vision") score += input.stats.charm >= 7 ? 5 : 0;
  } else {
    score += input.stats.practical * 5 + input.stats.reputation * 4 + input.stats.academic * 3 + input.stats.mental * 2;
    if (approach === "tailored") score += input.stats.practical >= 6 ? 5 : 0;
    if (approach === "fast_submit") score += input.stats.mental >= 7 ? 4 : -3;
  }

  const threshold = path === "licensed_profession" ? 106 :
    path === "public_safety" ? 102 :
      path === "startup" ? 104 :
        path === "company" ? 100 :
          92;
  const passed = score >= threshold;
  const label = getCareerGateLabel(path, passed);
  const destinationCandidates = upsertGateDestinationCandidate(input.currentFlags.destinationCandidates, {
    id: `career-${path}`,
    kind: getDestinationKindForCareerGate(path),
    name: getDestinationNameForCareerGate(path),
    introducedBy: "career-gate-event",
    status: passed ? "gate_passed" : "gate_failed",
  });

  return {
    ...input.flagDelta,
    careerGateAttempt: { path, approach, score, threshold },
    careerGate: {
      status: passed ? "passed" : "failed",
      path,
      label,
      score,
      threshold,
      basis: "stats_relationships_history",
    },
    ...(destinationCandidates ? { destinationCandidates } : {}),
  };
}

function getCareerGateLabel(path: string, passed: boolean) {
  if (path === "licensed_profession") return passed ? "전문직 시험 합격" : "전문직 시험 불합격";
  if (path === "public_safety") return passed ? "공공안전 전형 합격" : "공공안전 전형 탈락";
  if (path === "startup") return passed ? "창업 지원사업 선정" : "창업 지원사업 탈락";
  if (path === "general_job") return passed ? "첫 지원 절차 통과" : "첫 지원 절차 탈락";
  if (path === "company") return passed ? "기업 최종 면접 합격" : "기업 최종 면접 탈락";
  return passed ? "첫 지원 절차 통과" : "첫 지원 절차 탈락";
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function upsertGateDestinationCandidate(rawCandidates: unknown, candidate: {
  id: string;
  kind: string | null;
  name: string | null;
  introducedBy: string;
  status: "gate_passed" | "gate_failed";
}) {
  if (!candidate.kind || !candidate.name) return null;
  const existing = Array.isArray(rawCandidates)
    ? rawCandidates.filter((item) => typeof item === "object" && item !== null)
    : [];
  const withoutDuplicate = existing.filter((item) => readRecord(item)?.id !== candidate.id);
  return [...withoutDuplicate, candidate].slice(-12);
}

function getDestinationKindForCareerGate(path: string) {
  if (path === "company") return "company";
  if (path === "public_safety") return "public_sector";
  if (path === "licensed_profession") return "professional_exam";
  if (path === "startup") return "startup";
  if (path === "general_job") return "company";
  return null;
}

function getDestinationNameForCareerGate(path: string) {
  if (path === "company") {
    const companies = ["다람소프트", "삼슨전자", "네이봐", "카캉오", "배달이민족", "규글코리아", "스타벅수커피", "엘쥐전자", "현댜모터스", "에스끼리텔"];
    return companies[Math.floor(Math.random() * companies.length)];
  }
  if (path === "public_safety") return "공공안전 전형";
  if (path === "licensed_profession") return "전문직 시험";
  if (path === "startup") return "새싹엔진 캠프";
  if (path === "general_job") return "첫 지원 절차";
  return null;
}

function appendCareerGateOutcomeSummary(summary: string, flagDelta: Record<string, unknown>) {
  const gate = readRecord(flagDelta.careerGate);
  if (!gate || typeof gate.label !== "string" || typeof gate.status !== "string") return summary;
  const score = typeof gate.score === "number" && typeof gate.threshold === "number"
    ? ` (${gate.score}/${gate.threshold})`
    : "";
  return `${summary} 판정 결과: ${gate.label}${score}.`;
}

function buildStoryFlagDelta(input: {
  eventTitle: string;
  eventTags: string[];
  choiceId: string;
  choiceSummary: string;
  statDelta: Record<string, number>;
  flagDelta: Record<string, unknown>;
  coreEventCount: number;
  currentFlags: Record<string, unknown>;
}) {
  const previousThreads = Array.isArray(input.currentFlags.activeStoryThreads)
    ? input.currentFlags.activeStoryThreads.filter((thread) => typeof thread === "string")
    : [];
  const previousLedger = Array.isArray(input.currentFlags.storyLedger)
    ? input.currentFlags.storyLedger.filter((entry) => typeof entry === "object" && entry !== null)
    : [];
  const nextThreads = new Set([...previousThreads, ...inferStoryThreads(input.flagDelta, input.eventTags)]);
  const riskDebt = (typeof input.currentFlags.riskDebt === "number" ? input.currentFlags.riskDebt : 0) + inferRiskDebt(input);
  const majorBeat = Math.min(5, Math.floor((input.coreEventCount + 1) / 3) + 1);

  return {
    activeStoryThreads: [...nextThreads].slice(-8),
    riskDebt,
    lastStoryImpact: {
      eventTitle: input.eventTitle,
      choiceId: input.choiceId,
      summary: input.choiceSummary,
      threads: [...nextThreads].slice(-4),
      majorBeat,
    },
    storyLedger: [
      ...previousLedger,
      {
        beat: majorBeat,
        eventTitle: input.eventTitle,
        choiceId: input.choiceId,
        summary: input.choiceSummary,
        flags: input.flagDelta,
      },
    ].slice(-15),
  };
}

function inferStoryThreads(flagDelta: Record<string, unknown>, eventTags: string[]) {
  const threads = new Set<string>();
  const keys = Object.keys(flagDelta);

  for (const key of keys) {
    if (key.includes("crime") || key.includes("underworld") || key.includes("gambling") || key.includes("pyramid")) threads.add("위험한 돈과 회색지대");
    if (key.includes("partTime") || key.includes("money") || key.includes("rent")) threads.add("생활비와 노동");
    if (key.includes("romance")) threads.add("서연과의 관계");
    if (key.includes("family") || key.includes("mom")) threads.add("가족 압박");
    if (key.includes("startup")) threads.add("창업과 공개 실패");
    if (key.includes("overseas")) threads.add("해외로 떠날 가능성");
    if (key.includes("studentCouncil")) threads.add("학생회 권력과 책임");
    if (key.includes("groupProject")) threads.add("조별과제 갈등의 후폭풍");
    if (key.includes("lab") || key.includes("professor")) threads.add("연구실과 학업 진로");
  }

  for (const tag of eventTags) {
    if (["범죄", "도박", "위험"].includes(tag)) threads.add("위험한 돈과 회색지대");
    if (["알바", "자산", "돈"].includes(tag)) threads.add("생활비와 노동");
    if (["연애", "관계"].includes(tag)) threads.add("가까운 관계의 변화");
    if (["가족", "압박"].includes(tag)) threads.add("가족 압박");
    if (["취업", "진로", "공기업", "공무원"].includes(tag)) threads.add("졸업 이후의 방향");
  }

  return [...threads];
}

function inferRiskDebt(input: {
  eventTags: string[];
  statDelta: Record<string, number>;
  flagDelta: Record<string, unknown>;
}) {
  let risk = 0;
  if (input.eventTags.some((tag) => ["범죄", "도박", "위험", "빚"].includes(tag))) risk += 1;
  if (Object.keys(input.flagDelta).some((key) => key.includes("accepted") || key.includes("Entered") || key.includes("Debt") || key.includes("entangled"))) risk += 2;
  if ((input.statDelta.reputation ?? 0) <= -5) risk += 1;
  if ((input.statDelta.mental ?? 0) <= -5 || (input.statDelta.health ?? 0) <= -5) risk += 1;
  if (Object.keys(input.flagDelta).some((key) => key.includes("Refused") || key.includes("CutOff") || key.includes("ExitAttempt"))) risk -= 1;
  return Math.max(-1, risk);
}

function inferRelationshipRole(name: string, eventTitle: string) {
  if (name.includes("선배")) return "선배";
  if (name.includes("교수")) return "교수";
  if (name.includes("민하")) return "동기";
  if (eventTitle.includes("동아리")) return "동아리 인물";
  return "관계 인물";
}

function inferRelationshipTags(name: string, eventTitle: string) {
  const tags = ["이벤트로 만남"];
  if (name.includes("선배")) tags.push("선배");
  if (eventTitle.includes("인턴")) tags.push("인턴정보");
  if (eventTitle.includes("동아리")) tags.push("동아리");
  return tags;
}

async function buildImmediateBadEndingRecord(input: {
  userId: string;
  characterRunId: string;
  characterName: string;
  age: number;
  major: string;
  endingType: string;
  stats: Record<string, number>;
  hiddenState: unknown;
  relationships: { name: string; role: string; trust: number; tags: unknown }[];
  eventHistory: { event: { title: string }; summary: string; statDelta: unknown; relationshipDelta: unknown; flagDelta: unknown }[];
  eventTitle: string;
  summary: string;
  relationshipLife?: { relationshipLife: string; parenting: { hasChildren: boolean; childCount: number; parentingStage: string } };
}) {
  const reason = input.endingType === "건강 붕괴" ? "몸이 더는 버티지 못했다" :
    input.endingType === "멘탈 붕괴" ? "마음이 완전히 소진되었다" :
    "평판이 무너져 학교와 일상에서 설 자리를 잃었다";

  const aiEnding = await generateAiEnding({
    name: input.characterName,
    age: input.age,
    major: input.major,
    stats: input.stats,
    hiddenState: input.hiddenState,
    relationships: input.relationships.map((rel) => ({ name: rel.name, role: rel.role, trust: rel.trust, tags: rel.tags })),
    eventHistory: input.eventHistory.map((history) => ({
      title: history.event.title,
      summary: history.summary,
      statDelta: history.statDelta,
      relationshipDelta: history.relationshipDelta,
      flagDelta: history.flagDelta,
    })),
    finalChoiceSummary: input.summary,
    resultMode: "crisis",
    relationshipLife: input.relationshipLife,
  });
  const generated = aiEnding.success ? aiEnding.ending : null;
  const concreteResult = gateConcreteResultFields(generated, input.hiddenState);

  return {
    userId: input.userId,
    characterRunId: input.characterRunId,
    title: sanitizeResultText(generated?.title) ?? `${input.characterName}의 선택의 결과: ${input.endingType}`,
    summary: sanitizeResultText(generated?.summary) ?? `${input.characterName}은 ${input.eventTitle} 이후 ${reason}.`,
    longNarrative: sanitizeResultText(generated?.longNarrative) ?? buildLongFallbackEnding(input.characterName, input.major, "중도 이탈", input.stats, input.summary, reason),
    careerPath: sanitizeResultText(generated?.careerPath) ?? "중도 이탈",
    jobRole: concreteResult.jobRole,
    destinationName: concreteResult.destinationName,
    salaryBand: concreteResult.salaryBand,
    workplaceTone: sanitizeTextArray(generated?.workplaceTone),
    statSnapshot: input.stats,
    keyRelationships: serializeRelationships(input.relationships),
    majorEvents: [...input.eventHistory.map((history) => ({ eventTitle: history.event.title, summary: history.summary, choiceId: null })), { eventTitle: input.eventTitle, summary: input.summary, choiceId: null }],
    satisfaction: generated?.satisfaction ?? 0,
    growthPotential: generated?.growthPotential ?? 0,
    workLifeBalance: generated?.workLifeBalance ?? 0,
    healthState: sanitizeResultText(generated?.healthState) ?? (input.stats.health <= 0 ? "붕괴" : "나쁨"),
    relationshipState: sanitizeResultText(generated?.relationshipState) ?? (input.stats.reputation <= 0 ? "고립" : "불안정"),
    tags: sanitizeTags(generated?.tags, ["중도결과", input.endingType]),
    similarityKey: `result-${input.endingType}`,
  };
}

async function buildFinalEndingRecord(input: {
  userId: string;
  characterRunId: string;
  characterName: string;
  age: number;
  major: string;
  stats: Record<string, number>;
  hiddenState: unknown;
  relationships: { name: string; role: string; trust: number; tags: unknown }[];
  eventHistory: { event: { title: string }; summary: string; statDelta: unknown; relationshipDelta: unknown; flagDelta: unknown }[];
  eventTitle: string;
  summary: string;
  coreEventCount: number;
  relationshipLife?: { relationshipLife: string; parenting: { hasChildren: boolean; childCount: number; parentingStage: string } };
  relationshipEndingType?: string | null;
  parentingEndingType?: string | null;
}) {
  const gate = getCareerGate(input.hiddenState);
  const relationshipEndingLabel = input.relationshipEndingType ?? null;
  const parentingEndingLabel = input.parentingEndingType ?? null;
  const careerPath = relationshipEndingLabel && (!gate || gate.status !== "passed")
    ? relationshipEndingLabel
    : parentingEndingLabel && (!gate || gate.status !== "passed")
      ? parentingEndingLabel
      : pickCareerPath(input.stats, gate);
  const satisfaction = toPercentScore((input.stats.health + input.stats.mental + input.stats.reputation) / 3);
  const growthPotential = toPercentScore((input.stats.academic + input.stats.practical + input.stats.charm) / 3);
  const workLifeBalance = toPercentScore((input.stats.health + input.stats.mental) / 2);
  const healthState = input.stats.health >= 7 ? "좋음" : input.stats.health >= 4 ? "보통" : "불안";
  const relationshipState = input.relationshipLife?.relationshipLife === "married"
    ? "결혼 생활"
    : input.relationshipLife?.relationshipLife === "cohabitation"
      ? "동거 생활"
      : input.relationshipLife?.relationshipLife === "divorced"
        ? "이별 후 재정비"
        : input.relationshipLife?.relationshipLife === "dating"
          ? "연애 중"
          : input.stats.reputation >= 7 ? "넓고 안정적" : input.stats.reputation >= 4 ? "좁지만 유지됨" : "불안정";
  const aiEnding = await generateAiEnding({
    name: input.characterName,
    age: input.age,
    major: input.major,
    stats: input.stats,
    hiddenState: input.hiddenState,
    relationships: input.relationships.map((rel) => ({ name: rel.name, role: rel.role, trust: rel.trust, tags: rel.tags })),
    eventHistory: input.eventHistory.map((history) => ({
      title: history.event.title,
      summary: history.summary,
      statDelta: history.statDelta,
      relationshipDelta: history.relationshipDelta,
      flagDelta: history.flagDelta,
    })),
    finalChoiceSummary: input.summary,
    resultMode: "final",
    relationshipLife: input.relationshipLife,
  });
  const generated = aiEnding.success ? aiEnding.ending : null;
  const concreteResult = gateConcreteResultFields(generated, input.hiddenState);

  return {
    userId: input.userId,
    characterRunId: input.characterRunId,
    title: sanitizeResultText(generated?.title) ?? `${input.characterName}의 선택의 결과`,
    summary: sanitizeResultText(generated?.summary) ?? `${input.characterName}은 ${input.coreEventCount}개의 사건과 마지막 관문을 지나 ${careerPath} 방향으로 나아갔습니다.`,
    longNarrative: sanitizeResultText(generated?.longNarrative) ?? buildLongFallbackEnding(input.characterName, input.major, careerPath, input.stats, input.summary, relationshipState, input.eventHistory),
    careerPath,
    jobRole: gate?.status === "passed" ? concreteResult.jobRole : null,
    destinationName: gate?.status === "passed" ? concreteResult.destinationName : null,
    salaryBand: gate?.status === "passed" ? concreteResult.salaryBand : null,
    workplaceTone: sanitizeTextArray(generated?.workplaceTone),
    statSnapshot: input.stats,
    keyRelationships: serializeRelationships(input.relationships),
    majorEvents: [...input.eventHistory.map((history) => ({ eventTitle: history.event.title, summary: history.summary, choiceId: null })), { eventTitle: input.eventTitle, summary: input.summary, choiceId: null }],
    satisfaction: generated?.satisfaction ?? satisfaction,
    growthPotential: generated?.growthPotential ?? growthPotential,
    workLifeBalance: generated?.workLifeBalance ?? workLifeBalance,
    healthState: sanitizeResultText(generated?.healthState) ?? healthState,
    relationshipState: sanitizeResultText(generated?.relationshipState) ?? relationshipState,
    tags: sanitizeTags(generated?.tags, ["선택의 결과", careerPath]),
    similarityKey: `result-${careerPath}`,
  };
}

function getCareerGate(hiddenState: unknown): { status: string; path: string; label?: string } | null {
  const state = typeof hiddenState === "object" && hiddenState !== null ? hiddenState as Record<string, unknown> : {};
  const flags = typeof state.eventFlags === "object" && state.eventFlags !== null ? state.eventFlags as Record<string, unknown> : {};
  const gate = typeof flags.careerGate === "object" && flags.careerGate !== null ? flags.careerGate as Record<string, unknown> : null;
  if (!gate || typeof gate.status !== "string" || typeof gate.path !== "string") return null;
  return {
    status: gate.status,
    path: gate.path,
    label: typeof gate.label === "string" ? gate.label : undefined,
  };
}

function pickCareerPath(stats: Record<string, number>, gate: { status: string; path: string; label?: string } | null) {
  if (!gate) return "마지막 관문을 앞둔 진로 준비";
  if (gate.status !== "passed") {
    if (gate.path === "licensed_profession") return "전문직 시험 재도전";
    if (gate.path === "company") return "기업 면접 탈락 후 재지원 준비";
    if (gate.path === "public_safety") return "공공안전 전형 재준비";
    if (gate.path === "startup") return "창업 심사 탈락 후 아이디어 검증";
    return "첫 지원 탈락 후 이어지는 준비";
  }

  if (gate.path === "licensed_profession") return "전문직 수습 과정";
  if (gate.path === "public_safety") return "공공안전 직무 합격자";
  if (gate.path === "startup") return "새싹엔진 선정 창업자";
  if (gate.path === "general_job") return "첫 직장 신입 실무자";

  if (gate.path === "company") {
    const companies = ["다람소프트", "삼슨전자", "네이봐", "카캉오", "배달이민족", "규글코리아", "스타벅수커피", "엘쥐전자", "현댜모터스", "에스끼리텔"];
    const idx = Math.floor(Math.abs(stats.practical * 7 + stats.reputation * 3 + stats.charm * 2) % companies.length);
    return `${companies[idx]} 신입 실무자`;
  }

  if (stats.reputation <= 2 && stats.wealth >= 6) return "위험한 돈에서 겨우 발을 뺀 생존자";
  if (stats.practical >= 8 && stats.reputation <= 5) return "사설 조사 보조원";
  if (stats.health >= 7 && stats.academic >= 6 && stats.reputation >= 5) return "공공안전 직무 준비생";
  if (stats.charm >= 8 && stats.mental >= 6) return "연애와 결혼을 선택한 생활인";
  if (stats.mental >= 8 && stats.charm <= 5) return "혼자 살며 조용히 안정된 사람";
  if (stats.wealth <= 4 && stats.charm >= 6) return "해외 워홀 이후 다시 길을 찾은 사람";
  if (stats.wealth >= 7 && stats.practical >= 6) return "창업 또는 자영업";
  if (stats.academic >= 8 && stats.mental >= 6) return "전문직 시험 준비생";
  if (stats.reputation >= 7 && stats.practical >= 6) return "기업 채용 재도전";
  if (stats.academic >= 7 && stats.health >= 5) return "공공기관 또는 공무원 준비";
  if (stats.charm >= 7) return "마케팅·콘텐츠 직무";
  return "불확실하지만 계속되는 취업 준비";
}

function toPercentScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 10)));
}

function sanitizeResultText(value: unknown) {
  if (typeof value !== "string") return null;
  return value
    .replace(/배드엔딩/g, "중도 결과")
    .replace(/일반엔딩/g, "선택의 결과")
    .replace(/AI엔딩/g, "선택의 결과")
    .replace(/엔딩/g, "결과")
    .replace(/(학점|학업|지식|실무|실무력|건강|멘탈|정신|자산|돈|평판|명성|매력|네트워크|관계|academic|practical|health|mental|wealth|reputation|charm|network)\s*(?:수치|점수|스탯|stat)?\s*(?:은|는|이|가|의)?\s*[:：]?\s*(?:10|[0-9])\b/gi, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function sanitizeTags(value: unknown, fallback: string[]) {
  const tags = Array.isArray(value) && value.length > 0 ? value.filter((tag) => typeof tag === "string") : fallback;
  return tags.map((tag) => sanitizeResultText(tag) ?? tag).slice(0, 10);
}

function sanitizeTextArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string").map((item) => sanitizeResultText(item) ?? item)
    : [];
}

function serializeRelationships(relationships: { name: string; role: string; trust: number; tags: unknown }[]) {
  return relationships.map((rel) => ({
    name: rel.name,
    role: rel.role,
    trust: rel.trust,
    tags: Array.isArray(rel.tags) ? rel.tags.filter((tag) => typeof tag === "string") : [],
  }));
}

function buildLongFallbackEnding(
  name: string,
  major: string,
  careerPath: string,
  stats: Record<string, number>,
  finalChoiceSummary: string,
  relationshipState: string,
  eventHistory: { event: { title: string }; summary: string }[] = [],
) {
  const publicStrength = stats.academic >= stats.practical ? "당신은 책상 앞에서 오래 버티는 법을 알았다" : "당신은 현장에서 몸으로 익히는 속도가 빨랐다";
  const rememberedEvents = eventHistory
    .slice(-4)
    .map((history) => `${history.event.title}에서 ${history.summary}`)
    .join(" ");
  const memoryLine = rememberedEvents || "몇 개의 선택은 기록보다 오래 몸에 남았다.";
  const reversal = stats.reputation < 5
    ? "그러나 평판은 이상한 방식으로 뒤따라왔다. 한때 사소하게 넘겼던 말과 관계의 균열은, 가장 중요한 추천과 면접의 계절에 다시 고개를 들었다"
    : stats.health < 5
      ? "그러나 몸은 뒤늦게 청구서를 내밀었다. 커리어가 막 속도를 내기 시작할 때마다 당신은 쉬어야 했고, 쉬는 동안 다른 사람들은 한 발씩 앞서 나갔다"
      : stats.mental < 5
        ? "그러나 마음은 쉽게 회복되지 않았다. 남들이 보기에는 멀쩡한 성취도 당신에게는 늘 다음 실패를 미루는 임시방편처럼 느껴졌다"
        : "그러나 삶은 단순한 보상처럼 흘러가지 않았다. 잘한 선택도 대가를 남겼고, 피한 선택도 언젠가는 다른 얼굴로 돌아왔다";

  return `${name}의 이야기는 ${major}의 강의실에서 끝나지 않았다. 당신은 여러 사건을 지나 ${careerPath}라는 이름의 다음 문을 열었고, 그 문 안에는 생각보다 좁은 복도와 밝은 창문이 함께 있었다. ${memoryLine} ${publicStrength}. 그래서 처음에는 꽤 잘해냈다. 보고서는 깔끔했고, 면접에서는 침착했으며, 사람들이 놓치는 작은 흐름을 읽어내는 날도 있었다. ${finalChoiceSummary} 그 마지막 선택은 당신을 당장 유명하게 만들지는 않았지만, 이후 몇 년 동안 반복해서 떠오르는 기준점이 되었다.

${reversal}. 당신은 한때 성공이 직선이라고 믿었지만, 실제의 커리어는 더 지저분하고 더 오래 걸리는 문장에 가까웠다. 누군가와의 관계가 예상 밖의 도움으로 돌아오기도 했고, 반대로 잘못 틀어진 사람이 당신의 길목에서 차가운 얼굴로 서 있기도 했다. 사랑에 가까웠던 마음은 생활 앞에서 작아졌고, 미움에 가까웠던 관계는 오히려 당신을 더 단단하게 만들었다.

몇 년 뒤 당신은 처음 상상했던 모습과는 다른 표정으로 살고 있었다. 돈을 아주 많이 벌지는 못했을 수도 있고, 반대로 꽤 안정적인 직함을 얻었으면서도 밤마다 조용히 무너졌을 수도 있다. 중요한 것은 당신이 그 모든 결과를 하나의 숫자로 설명할 수 없다는 점이었다. ${relationshipState}이라는 결론 속에서, 당신은 얻은 것과 잃은 것을 모두 기억하는 사람이 되었다. 그래서 이 기록은 완벽한 성공도 완전한 실패도 아니다. 다만 당신이 치른 비용과 끝내 남긴 가능성이, 오래된 노트의 마지막 장처럼 조용히 접혀 있을 뿐이다.`;
}
