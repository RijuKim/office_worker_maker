import { NextResponse, type NextRequest } from "next/server";

import { serializeCharacterRun } from "@/lib/game/character-foundation";
import { resolveCurrentEvent } from "@/lib/server/current-event";
import { prisma } from "@/lib/server/prisma";
import { requireCurrentUserId } from "@/lib/server/session";
import { logger } from "@/lib/server/logger";

type RouteContext = {
  params: Promise<Record<string, string>>;
};

export async function GET(request: Request | NextRequest, context: RouteContext) {
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

  const currentEvent = resolveCurrentEvent(character.events, character.currentEventId);

  if (currentEvent && currentEvent.id !== character.currentEventId) {
    try {
      await prisma.characterRun.updateMany({
        where: { id, userId },
        data: { currentEventId: currentEvent.id },
      });
      log.info("활성 사건 포인터 자동 복구", {
        userId,
        characterId: id,
        previousEventId: character.currentEventId,
        restoredEventId: currentEvent.id,
      });
    } catch (error) {
      // Return the recovered event even if pointer repair fails. The user can
      // continue immediately and a later resume can retry the repair.
      log.warn("활성 사건 포인터 복구 실패", {
        userId,
        characterId: id,
        restoredEventId: currentEvent.id,
        error: String(error),
      });
    }
  }

  return NextResponse.json({
    character: serializeCharacterRun({ ...character, events: currentEvent ? [currentEvent] : [] }),
    currentEvent,
    recordsSummary: {
      recentCount: character.records.length,
      recentTitles: character.records.map((record: { title: string }) => record.title),
    },
  });
}

export async function DELETE(request: Request | NextRequest, context: RouteContext) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const log = logger.withRequestId(requestId);
  const userId = await requireCurrentUserId();

  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await context.params;
  const deleted = await prisma.characterRun.deleteMany({ where: { id, userId } });

  if (deleted.count === 0) {
    log.warn("캐릭터 삭제 실패 - 찾을 수 없음", { userId, characterId: id });
    return NextResponse.json({ error: "삭제할 진행 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  log.info("새 시뮬레이션 시작을 위한 기존 캐릭터 삭제", { userId, characterId: id });
  return NextResponse.json({ deleted: true });
}
