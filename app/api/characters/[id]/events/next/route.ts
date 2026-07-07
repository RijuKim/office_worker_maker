import { NextResponse } from "next/server";
import type { EventSource } from "@prisma/client";

import { getStoryArc, selectNextEvent } from "@/lib/game/event-engine";
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

  const activeEvent = character.events[0];
  if (activeEvent) {
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

  const recentSummaries = character.eventHistory
    .map((h: { summary: string }) => h.summary)
    .filter(Boolean) as string[];
  const usedEventTitles = character.eventHistory
    .map((h: { event?: { title?: string } }) => h.event?.title)
    .filter(Boolean) as string[];
  const recentlySeenUserEventTitles = await getRecentlySeenUserEventTitles(userId, id);
  const excludedEventTitles = [...new Set([...usedEventTitles, ...recentlySeenUserEventTitles])];
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
  const storyArc = advanceStoryArc(currentFlags.storyArc, character.coreEventCount, currentFlags);

  const { type, event } = selectNextEvent(
    {
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
    },
    excludedEventTitles,
  );

  let selectedEvent = event;
  let source: EventSource = type === "forced" ? "FORCED" : event.source;

  if (type !== "forced" && character.stats) {
    const limit = await checkDailyAiLimit(userId);
    if (limit.allowed) {
      const aiResult = await generateAiEvent({
        name: character.name,
        age: character.age,
        major: character.major,
        gradeYear: character.currentGradeYear,
        coreEventCount: character.coreEventCount,
        recentSummaries,
        usedEventTitles: excludedEventTitles,
        storyArc,
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
      });

      if (aiResult.success) {
        await incrementAiUsage(userId);
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
