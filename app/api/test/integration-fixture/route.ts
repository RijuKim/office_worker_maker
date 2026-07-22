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
    await prisma.event.updateMany({ where: { characterRunId: character.id, status: "ACTIVE" }, data: { status: "DISCARDED" } });
    await prisma.characterRun.update({ where: { id: character.id }, data: { currentEventId: null } });
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

  return NextResponse.json({ error: "알 수 없는 fixture action입니다." }, { status: 400 });
}
