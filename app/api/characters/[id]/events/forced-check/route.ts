import { NextResponse } from "next/server";

import { buildBurnoutEvent } from "@/lib/game/event-engine";
import { checkForcedEvent } from "@/lib/game/game-rules";
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

  const forced = checkForcedEvent(character.hiddenState);

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

  await prisma.characterRun.update({
    where: { id },
    data: { currentEventId: newEvent.id },
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