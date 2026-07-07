import { NextResponse } from "next/server";
import type { EventSource } from "@prisma/client";

import { getStoryArc, isEventAllowedForLifeStage, selectNextEvent } from "@/lib/game/event-engine";
import { deriveLifeStageState } from "@/lib/game/life-stage";
import { checkDailyAiLimit, generateAiEvent, incrementAiUsage } from "@/lib/game/openrouter";
import { prisma } from "@/lib/server/prisma";
import { requireCurrentUserId } from "@/lib/server/session";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
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
      eventHistory: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { event: true },
      },
      events: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!character) {
    return NextResponse.json({ error: "캐릭터를 찾을 수 없습니다." }, { status: 404 });
  }

  if (!character.hiddenState) {
    return NextResponse.json({ error: "캐릭터 데이터가 불완전합니다." }, { status: 500 });
  }

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
    recentTags: diversityGuidance.recentTags,
    recentRelationshipNames: diversityGuidance.recentPeople,
    previousChoiceSummary,
  };

  const activeEvent = character.events[0];
  if (activeEvent) {
    const activeTags = Array.isArray(activeEvent.tags) ? activeEvent.tags.filter((tag) => typeof tag === "string") : [];
    if (activeEvent.source === "FORCED" || isEventAllowedForLifeStage({ title: activeEvent.title, tags: activeTags }, selectionContext)) {
      return NextResponse.json({
        event: {
          id: activeEvent.id,
          title: activeEvent.title,
          body: activeEvent.body,
          choices: activeEvent.choices,
          source: activeEvent.source,
          forced: activeEvent.source === "FORCED",
        },
      });
    }

    await prisma.$transaction([
      prisma.event.update({
        where: { id: activeEvent.id },
        data: { status: "DISCARDED" },
      }),
      prisma.characterRun.update({
        where: { id },
        data: { currentEventId: null },
      }),
    ]);
  }

  const recentSummaries = character.eventHistory
    .map((h: { summary: string }) => h.summary)
    .filter(Boolean) as string[];
  const usedEventTitles = character.eventHistory
    .map((h: { event?: { title?: string } }) => h.event?.title)
    .filter(Boolean) as string[];
  const recentlySeenUserEventTitles = await getRecentlySeenUserEventTitles(userId, id);
  const excludedEventTitles = [...new Set([...usedEventTitles, ...recentlySeenUserEventTitles])];
  const storyArc = advanceStoryArc(currentFlags.storyArc, character.coreEventCount, currentFlags);

  const { type, event } = selectNextEvent(
    selectionContext,
    excludedEventTitles,
  );

  let selectedEvent = event;
  let source: EventSource = type === "forced" ? "FORCED" : event.source;

  if (type !== "forced" && character.stats && canUseAiForLifeStage(selectionLifeStage.lifeStage, character.academicStatus)) {
    const limit = await checkDailyAiLimit(userId);
    if (!limit.allowed) {
      console.warn("AI daily limit reached, falling back to OpenRouter", {
        userId,
        count: limit.count,
        limit: limit.limit,
      });
    }
    {
      const aiResult = await generateAiEvent({
        name: character.name,
        age: character.age,
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
        academicPlan: selectionLifeStage.academicPlan,
        destinationCandidates: selectionLifeStage.destinationCandidates,
        avoidCategories: diversityGuidance.avoidCategories,
        preferCategories: diversityGuidance.preferCategories,
        avoidPeople: diversityGuidance.avoidPeople,
      }, { skipPrimary: !limit.allowed });

      if (aiResult.success) {
        if (aiResult.providerId === "ollama") {
          await incrementAiUsage(userId);
        }
        selectedEvent = {
          title: aiResult.event.title,
          body: aiResult.event.body,
          choices: aiResult.event.choices.map((choice) => ({
            ...choice,
            relationshipDelta: choice.relationshipDelta ?? [],
            flagDelta: { aiGenerated: true, storyPhase: storyArc.phase },
          })),
          tags: aiResult.event.tags,
          source: "FALLBACK",
        };
        source = "AI";
      }
    }
  }

  if (source === "AI" && isRepeatedEvent(selectedEvent.title, selectedEvent.tags, usedEventTitles, recentSummaries)) {
    selectedEvent = event;
    source = event.source;
  }

  const newEvent = await prisma.event.create({
    data: {
      characterRunId: id,
      title: selectedEvent.title,
      body: selectedEvent.body,
      source,
      status: "ACTIVE",
      choices: selectedEvent.choices as object[],
      tags: selectedEvent.tags,
      safetyChecked: true,
    },
  });

  await prisma.characterRun.update({
    where: { id },
    data: {
      currentEventId: newEvent.id,
    },
  });

  await prisma.hiddenState.update({
    where: { characterRunId: id },
    data: {
      eventFlags: {
        ...selectionFlags,
        storyArc,
        lastEventSource: source,
      },
    },
  });

  return NextResponse.json({
    event: {
      id: newEvent.id,
      title: newEvent.title,
      body: newEvent.body,
      choices: newEvent.choices,
      source: newEvent.source,
      forced: type === "forced",
    },
  });
}

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

  return recentHistory
    .map((history: { event?: { title?: string } }) => history.event?.title)
    .filter(Boolean) as string[];
}

function isRepeatedEvent(title: string, tags: string[], usedTitles: string[], recentSummaries: string[]) {
  if (usedTitles.some((used) => used === title || used.includes(title) || title.includes(used))) {
    return true;
  }
  const normalizedTitle = title.replace(/\s/g, "");
  if (recentSummaries.some((summary) => summary.replace(/\s/g, "").includes(normalizedTitle))) {
    return true;
  }
  return false;
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
  const allCategories = ["돈", "가족", "연애", "건강", "알바", "동아리", "해외", "위험", "진로", "생활"];
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
  if (["해외", "워홀"].includes(tag)) return "해외";
  if (["취업", "진로", "면접", "지원서", "기업"].includes(tag)) return "진로";
  if (["건강", "멘탈", "운동", "번아웃"].includes(tag)) return "건강";
  if (["동아리", "학생회"].includes(tag)) return "동아리";
  return tag;
}
