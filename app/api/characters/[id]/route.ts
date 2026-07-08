import { NextResponse } from "next/server";

import { serializeCharacterRun } from "@/lib/game/character-foundation";
import { prisma } from "@/lib/server/prisma";
import { requireCurrentUserId } from "@/lib/server/session";
import { logger } from "@/lib/server/logger";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
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
      events: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      eventHistory: {
        orderBy: { createdAt: "desc" },
        take: 8,
      },
      records: {
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
  });

  if (!character) {
    log.warn("캐릭터 조회 실패 - 찾을 수 없음", { userId, characterId: id });
    return NextResponse.json({ error: "캐릭터를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({
    character: serializeCharacterRun(character),
    currentEvent: character.events[0] ?? null,
    recordsSummary: {
      recentCount: character.records.length,
      recentTitles: character.records.map((record: { title: string }) => record.title),
    },
  });
}
