import { NextResponse } from "next/server";

import { buildBurnoutEvent } from "@/lib/game/event-engine";
import { checkForcedEvent } from "@/lib/game/game-rules";
import { applyLifeStageTransition, getDropoutReason, getLeaveReason, readRiskDebt } from "@/lib/game/life-stage";
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
  const riskDebt = readRiskDebt(currentFlags);
  const stats = character.stats ? {
    academic: character.stats.academic,
    practical: character.stats.practical,
    health: character.stats.health,
    mental: character.stats.mental,
    reputation: character.stats.reputation,
  } : undefined;
  const dropoutReason = stats ? getDropoutReason(stats, riskDebt) : false;
  const leaveReason = stats ? getLeaveReason(stats, character.hiddenState.burnoutRisk) : false;
  const forcedByLifeStage = dropoutReason || leaveReason;
  const forced = forcedByLifeStage ? { type: "burnout" as const } : checkForcedEvent(character.hiddenState);

  if (!forced) {
    return NextResponse.json({ forced: false });
  }

  const activeEvent = character.events[0];
  if (activeEvent) {
    await prisma.event.update({
      where: { id: activeEvent.id },
      data: { status: "DISCARDED" },
    });
  }

  const burnoutEvent = buildBurnoutEvent();

  const newEvent = await prisma.event.create({
    data: {
      characterRunId: id,
      title: burnoutEvent.title,
      body: burnoutEvent.body,
      source: "FORCED",
      status: "ACTIVE",
      choices: burnoutEvent.choices as object[],
      tags: burnoutEvent.tags,
      safetyChecked: true,
    },
  });

  const lifeStageTransition = character.stats ? applyLifeStageTransition({
    eventFlags: currentFlags,
    currentGradeYear: character.currentGradeYear,
    academicStatus: character.academicStatus,
    coreEventCount: character.coreEventCount,
    major: character.major,
    burnoutRisk: character.hiddenState.burnoutRisk,
    stats,
  }) : null;

  await prisma.$transaction([
    prisma.characterRun.update({
      where: { id },
      data: {
        currentEventId: newEvent.id,
        ...(forcedByLifeStage && lifeStageTransition ? {
          currentGradeYear: lifeStageTransition.state.term.gradeYear,
          academicStatus: dropoutReason ? "DROPPED_OUT" as const :
            leaveReason ? "LEAVE" as const :
              character.academicStatus,
        } : {}),
      },
    }),
    ...(forcedByLifeStage && lifeStageTransition ? [
      prisma.hiddenState.update({
        where: { characterRunId: id },
        data: {
          eventFlags: {
            ...currentFlags,
            ...lifeStageTransition.flagDelta,
            lifeStage: { id: dropoutReason ? "dropout" as const : "leave" as const },
          },
        },
      }),
    ] : []),
  ]);

  log.info("강제 이벤트 생성", {
    userId,
    characterId: id,
    eventId: newEvent.id,
    reason: forcedByLifeStage ? (dropoutReason || leaveReason) : "game_rule",
  });

  return NextResponse.json({
    forced: true,
    event: {
      id: newEvent.id,
      title: newEvent.title,
      body: newEvent.body,
      choices: newEvent.choices,
      source: "FORCED",
    },
  });
}
