import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { requireCurrentUserId } from "@/lib/server/session";
import { logger } from "@/lib/server/logger";

import {
  buildFirstEvent,
  buildInitialHiddenState,
  buildInitialStats,
  pickRandomGradeYear,
  pickRandomMajor,
  serializeCharacterRun,
} from "@/lib/game/character-foundation";
import { characterCreateSchema } from "@/lib/game/validation";

const includeCharacterDetails = {
  stats: true,
  hiddenState: true,
  relationships: true,
  events: {
    where: { status: "ACTIVE" as const },
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
  eventHistory: {
    orderBy: { createdAt: "desc" as const },
    take: 5,
  },
};

export async function GET(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const userId = await requireCurrentUserId();

  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let characters;
  try {
    characters = await prisma.characterRun.findMany({
      where: { userId },
      include: {
        stats: true,
        hiddenState: true,
        relationships: true,
        eventHistory: {
          orderBy: { createdAt: "desc" },
          take: 8,
        },
        events: {
          where: { status: "ACTIVE" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("does not exist")) {
      logger.withRequestId(requestId).warn("캐릭터 목록 조회 실패, 빈 목록으로 대체", {
        userId,
        reason: "schema_mismatch",
      });
      return NextResponse.json({ characters: [] });
    }
    throw error;
  }

  logger.withRequestId(requestId).info("캐릭터 목록 조회", { userId, count: characters.length });

  return NextResponse.json({ characters: characters.map(serializeCharacterRun) });
}

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const log = logger.withRequestId(requestId);
  const userId = await requireCurrentUserId();

  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = characterCreateSchema.safeParse(body);

  if (!parsed.success) {
    log.warn("캐릭터 생성 유효성 검사 실패", { userId, issues: parsed.error.flatten().fieldErrors });
    return NextResponse.json(
      { error: "캐릭터 정보를 확인해 주세요.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const createInput = {
    ...parsed.data,
    major: parsed.data.major ?? pickRandomMajor(),
    startGradeYear: parsed.data.startGradeYear ?? pickRandomGradeYear(parsed.data.age),
  };

  const character = await prisma.$transaction(async (tx) => {
    const created = await tx.characterRun.create({
      data: {
        userId,
        name: createInput.name,
        age: createInput.age,
        startGradeYear: createInput.startGradeYear,
        currentGradeYear: createInput.startGradeYear,
        major: createInput.major,
        lifeStatus: [],
        stats: {
          create: buildInitialStats(createInput.preferredStats, createInput),
        },
        hiddenState: {
          create: buildInitialHiddenState(createInput),
        },
      },
      include: {
        stats: true,
        hiddenState: true,
        relationships: true,
      },
    });

    const firstEvent = await tx.event.create({
      data: {
        ...buildFirstEvent(createInput),
        characterRunId: created.id,
      },
    });

    return tx.characterRun.update({
      where: { id: created.id },
      data: { currentEventId: firstEvent.id },
      include: includeCharacterDetails,
    });
  });

  log.info("캐릭터 생성 완료", { userId, characterId: character.id, name: character.name });

  return NextResponse.json({ character: serializeCharacterRun(character) }, { status: 201 });
}
