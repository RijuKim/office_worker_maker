import { NextResponse } from "next/server";
import type { EventSource } from "@prisma/client";

import { selectNextEvent } from "@/lib/game/event-engine";
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

  const recentTitles = character.eventHistory
    .map((h: { summary: string }) => h.summary)
    .filter(Boolean) as string[];
  const usedEventTitles = character.eventHistory
    .map((h: { event?: { title?: string } }) => h.event?.title)
    .filter(Boolean) as string[];
  const currentFlags = (character.hiddenState.eventFlags as Record<string, unknown>) ?? {};
  const storyArc = advanceStoryArc(currentFlags.storyArc, character.coreEventCount);

  const { type, event } = selectNextEvent(
    character.hiddenState,
    recentTitles,
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
        recentSummaries: recentTitles,
        usedEventTitles,
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
            relationshipDelta: [],
            flagDelta: { aiGenerated: true, storyPhase: storyArc.phase },
          })),
          tags: aiResult.event.tags,
          source: "FALLBACK",
        };
        source = "AI";
      }
    }
  }

  if (source === "AI" && isRepeatedEvent(selectedEvent.title, selectedEvent.tags, usedEventTitles, recentTitles)) {
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
      coreEventCount: { increment: 1 },
    },
  });

  await prisma.hiddenState.update({
    where: { characterRunId: id },
    data: {
      eventFlags: {
        ...currentFlags,
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

function isRepeatedEvent(title: string, tags: string[], usedTitles: string[], recentSummaries: string[]) {
  if (usedTitles.some((used) => used === title || used.includes(title) || title.includes(used))) {
    return true;
  }
  const normalizedTitle = title.replace(/\s/g, "");
  if (recentSummaries.some((summary) => summary.replace(/\s/g, "").includes(normalizedTitle))) {
    return true;
  }
  const tagOverlap = tags.filter((tag) => recentSummaries.slice(0, 5).some((summary) => summary.includes(tag)));
  return tagOverlap.length >= 3;
}

function advanceStoryArc(rawArc: unknown, coreEventCount: number) {
  const base = typeof rawArc === "object" && rawArc !== null ? rawArc as Record<string, unknown> : {};
  const phase = coreEventCount < 3 ? "발단" :
    coreEventCount < 8 ? "전개" :
    coreEventCount < 12 ? "위기" :
    coreEventCount < 15 ? "절정" :
    "결말";
  const tensionBase = typeof base.tension === "number" ? base.tension : 18;
  const tension = Math.max(10, Math.min(95, tensionBase + (phase === "위기" ? 9 : phase === "절정" ? 12 : 4)));

  return {
    title: typeof base.title === "string" ? base.title : "첫 학기와 보이지 않는 제안",
    premise: typeof base.premise === "string" ? base.premise : "작은 대학 생활의 선택들이 취업, 관계, 휴학, 직업으로 이어진다.",
    phase,
    chapter: Math.floor(coreEventCount / 3) + 1,
    tension,
    foreshadowing: Array.isArray(base.foreshadowing) && base.foreshadowing.length > 0
      ? base.foreshadowing
      : ["아직 정체를 알 수 없는 커리어 제안", "처음 보는 듯 익숙한 아침의 위화감"],
    openThreads: Array.isArray(base.openThreads) && base.openThreads.length > 0
      ? base.openThreads
      : ["이번 선택이 다음 학기의 방향을 바꿀 수 있다"],
  };
}
