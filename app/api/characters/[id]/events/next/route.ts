import { NextResponse } from "next/server";

import { selectNextEvent } from "@/lib/game/event-engine";
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
      eventHistory: {
        orderBy: { createdAt: "desc" },
        take: 10,
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

  const recentTitles = character.eventHistory
    .map((h: { summary: string }) => h.summary)
    .filter(Boolean) as string[];

  const { type, event } = selectNextEvent(
    character.hiddenState,
    recentTitles,
  );

  const newEvent = await prisma.event.create({
    data: {
      characterRunId: id,
      title: event.title,
      body: event.body,
      source: type === "forced" ? "FORCED" : event.source,
      status: "ACTIVE",
      choices: event.choices as object[],
      tags: event.tags,
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