import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { requireCurrentUserId } from "@/lib/server/session";

function unavailable() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") return unavailable();

  const userId = await requireCurrentUserId();
  const body = await request.json().catch(() => null) as { action?: string; characterId?: string } | null;
  const character = body?.characterId
    ? await prisma.characterRun.findFirst({ where: { id: body.characterId, userId } })
    : await prisma.characterRun.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } });
  if (!character) return NextResponse.json({ error: "캐릭터를 찾을 수 없습니다." }, { status: 404 });

  if (body?.action === "next-event-precursor") {
    const hiddenState = await prisma.hiddenState.findUnique({ where: { characterRunId: character.id } });
    const eventFlags = typeof hiddenState?.eventFlags === "object" && hiddenState.eventFlags !== null && !Array.isArray(hiddenState.eventFlags)
      ? hiddenState.eventFlags as Record<string, unknown>
      : {};
    await prisma.$transaction([
      prisma.event.updateMany({ where: { characterRunId: character.id, status: "ACTIVE" }, data: { status: "DISCARDED" } }),
      prisma.characterRun.update({ where: { id: character.id }, data: { currentEventId: null } }),
      prisma.hiddenState.update({
        where: { characterRunId: character.id },
        data: { eventFlags: { ...eventFlags, testForceProviderFailure: true } },
      }),
    ]);
    return NextResponse.json({ prepared: true });
  }

  if (body?.action === "life-stage-precursor") {
    await prisma.$transaction([
      prisma.characterStats.update({ where: { characterRunId: character.id }, data: { health: 2, mental: 2 } }),
      prisma.hiddenState.update({
        where: { characterRunId: character.id },
        data: { burnoutRisk: 90, eventFlags: { stageEventCount: 1, lifeStage: { id: "college_mid", term: { gradeYear: 2, semester: 1 } } } },
      }),
    ]);
    return NextResponse.json({ prepared: true });
  }

  if (body?.action === "ending-record-precursor") {
    const precursorEvent = await prisma.event.create({
      data: {
        characterRunId: character.id,
        source: "FORCED",
        status: "RESOLVED",
        title: "휴학 뒤의 진로 분기",
        body: "충분한 경험을 쌓은 뒤 다음 진로를 정리합니다.",
        choices: [],
        tags: ["career", "leave"],
        safetyChecked: true,
      },
    });
    await prisma.$transaction([
      prisma.eventHistory.create({
        data: {
          characterRunId: character.id,
          eventId: precursorEvent.id,
          choiceId: "take-leave",
          summary: "휴학 기간의 경험을 바탕으로 진로를 정리했습니다.",
          statDelta: {},
          relationshipDelta: [],
          flagDelta: { careerGate: { status: "passed", path: "company" } },
        },
      }),
      prisma.characterRun.update({
        where: { id: character.id },
        data: { academicStatus: "LEAVE", coreEventCount: 5 },
      }),
    ]);
    return NextResponse.json({ prepared: true, historyEventId: precursorEvent.id });
  }

  return NextResponse.json({ error: "알 수 없는 fixture action입니다." }, { status: 400 });
}
