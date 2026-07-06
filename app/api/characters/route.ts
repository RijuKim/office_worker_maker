import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { requireCurrentUserId } from "@/lib/server/session";

import {
  buildFirstEvent,
  buildInitialHiddenState,
  buildInitialStats,
  buildStarterRelationships,
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

export async function GET() {
  const userId = await requireCurrentUserId();

  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const characters = await prisma.characterRun.findMany({
    where: { userId },
    include: {
      stats: true,
      hiddenState: true,
      relationships: true,
      events: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ characters: characters.map(serializeCharacterRun) });
}

export async function POST(request: Request) {
  const userId = await requireCurrentUserId();

  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = characterCreateSchema.safeParse(body);

  if (!parsed.success) {
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
          create: buildInitialStats(createInput.preferredStats),
        },
        hiddenState: {
          create: buildInitialHiddenState(createInput),
        },
        relationships: {
          create: buildStarterRelationships(),
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

  return NextResponse.json({ character: serializeCharacterRun(character) }, { status: 201 });
}
