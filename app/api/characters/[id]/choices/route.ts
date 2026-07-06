import { NextResponse } from "next/server";

import {
  applyFlagDeltas,
  applyRelationshipDeltas,
  applyStatDeltas,
  validateChoiceIndex,
} from "@/lib/game/game-rules";
import { prisma } from "@/lib/server/prisma";
import { requireCurrentUserId } from "@/lib/server/session";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
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
      relationships: { orderBy: { createdAt: "asc" } },
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

  if (!character.stats || !character.hiddenState) {
    return NextResponse.json({ error: "캐릭터 데이터가 불완전합니다." }, { status: 500 });
  }

  const activeEvent = character.events[0];
  if (!activeEvent) {
    return NextResponse.json({ error: "진행 중인 이벤트가 없습니다." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const choiceIndex = body?.choiceIndex;

  const eventChoices = activeEvent.choices as unknown[];
  if (!validateChoiceIndex(eventChoices, choiceIndex)) {
    return NextResponse.json({ error: "올바른 선택을 해주세요." }, { status: 400 });
  }

  const choices = eventChoices as {
    id: string;
    summary: string;
    statDelta: Record<string, number>;
    relationshipDelta: { name: string; trust: number }[];
    flagDelta: Record<string, unknown>;
  }[];
  const choice = choices[choiceIndex];
  if (!choice) {
    return NextResponse.json({ error: "올바른 선택을 해주세요." }, { status: 400 });
  }

  const updatedStats = applyStatDeltas(
    {
      academic: character.stats.academic,
      practical: character.stats.practical,
      communication: character.stats.communication,
      creativity: character.stats.creativity,
      health: character.stats.health,
      mental: character.stats.mental,
      network: character.stats.network,
      wealth: character.stats.wealth,
      reputation: character.stats.reputation,
      charm: character.stats.charm,
    },
    choice.statDelta,
  );
  const previousStats = {
    academic: character.stats.academic,
    practical: character.stats.practical,
    health: character.stats.health,
    mental: character.stats.mental,
    wealth: character.stats.wealth,
    reputation: character.stats.reputation,
    charm: character.stats.charm,
  };
  const currentFlags = (character.hiddenState.eventFlags as Record<string, unknown>) ?? {};
  const updatedEventFlags = applyFlagDeltas(currentFlags, choice.flagDelta);

  const updatedRelationships = applyRelationshipDeltas(
    character.relationships.map((r: { name: string; trust: number }) => ({ name: r.name, trust: r.trust })),
    choice.relationshipDelta,
  );
  const existingRelationshipNames = new Set(character.relationships.map((rel: { name: string }) => rel.name));
  const newRelationships = choice.relationshipDelta
    .filter((rel) => !existingRelationshipNames.has(rel.name))
    .map((rel) => ({
      characterRunId: id,
      name: rel.name,
      role: inferRelationshipRole(rel.name, activeEvent.title),
      trust: Math.max(0, Math.min(100, 45 + rel.trust)),
      tags: inferRelationshipTags(rel.name, activeEvent.title),
    }));
  const endingType = getImmediateBadEnding(updatedStats);
  const endingRecord = endingType ? buildImmediateBadEndingRecord({
    userId,
    characterRunId: id,
    characterName: character.name,
    major: character.major,
    endingType,
    stats: updatedStats,
    eventTitle: activeEvent.title,
    summary: choice.summary,
  }) : null;

  await prisma.$transaction([
    prisma.characterStats.update({
      where: { characterRunId: id },
      data: updatedStats,
    }),
    prisma.hiddenState.update({
      where: { characterRunId: id },
      data: { eventFlags: updatedEventFlags as object },
    }),
    prisma.event.update({
      where: { id: activeEvent.id },
      data: { status: "RESOLVED" },
    }),
    prisma.eventHistory.create({
      data: {
        characterRunId: id,
        eventId: activeEvent.id,
        choiceId: choice.id,
        summary: choice.summary,
        statDelta: choice.statDelta as object,
        relationshipDelta: choice.relationshipDelta as object,
        flagDelta: choice.flagDelta as object,
      },
    }),
    ...updatedRelationships.map((rel) =>
      prisma.relationship.updateMany({
        where: { characterRunId: id, name: rel.name },
        data: { trust: rel.trust },
      }),
    ),
    ...newRelationships.map((rel) => prisma.relationship.create({ data: rel })),
    ...(endingRecord ? [
      prisma.careerEndingRecord.create({ data: endingRecord }),
      prisma.characterRun.update({
        where: { id },
        data: {
          currentEventId: null,
          academicStatus: "DROPPED_OUT",
        },
      }),
    ] : []),
  ]);

  return NextResponse.json({
    result: {
      choiceId: choice.id,
      summary: choice.summary,
      stats: updatedStats,
      statDelta: diffPublicStats(previousStats, updatedStats),
      relationships: [...updatedRelationships, ...newRelationships.map((rel) => ({ name: rel.name, trust: rel.trust }))],
      relationshipDelta: choice.relationshipDelta,
      eventResolved: true,
      endingTriggered: Boolean(endingRecord),
      endingType,
    },
  });
}

function diffPublicStats(previous: Record<string, number>, next: Record<string, number>) {
  const keys = ["academic", "practical", "health", "mental", "wealth", "reputation", "charm"];
  return Object.fromEntries(
    keys
      .map((key) => [key, (next[key] ?? previous[key] ?? 0) - (previous[key] ?? 0)] as const)
      .filter(([, delta]) => delta !== 0),
  );
}

function getImmediateBadEnding(stats: Record<string, number>) {
  if (stats.health <= 0) return "건강 붕괴";
  if (stats.mental <= 0) return "멘탈 붕괴";
  if (stats.reputation <= 0) return "평판 붕괴";
  return null;
}

function inferRelationshipRole(name: string, eventTitle: string) {
  if (name.includes("선배")) return "선배";
  if (name.includes("교수")) return "교수";
  if (name.includes("민하")) return "동기";
  if (eventTitle.includes("동아리")) return "동아리 인물";
  return "관계 인물";
}

function inferRelationshipTags(name: string, eventTitle: string) {
  const tags = ["이벤트로 만남"];
  if (name.includes("선배")) tags.push("선배");
  if (eventTitle.includes("인턴")) tags.push("인턴정보");
  if (eventTitle.includes("동아리")) tags.push("동아리");
  return tags;
}

function buildImmediateBadEndingRecord(input: {
  userId: string;
  characterRunId: string;
  characterName: string;
  major: string;
  endingType: string;
  stats: Record<string, number>;
  eventTitle: string;
  summary: string;
}) {
  const reason = input.endingType === "건강 붕괴" ? "몸이 더는 버티지 못했다" :
    input.endingType === "멘탈 붕괴" ? "마음이 완전히 소진되었다" :
    "평판이 무너져 학교와 일상에서 설 자리를 잃었다";

  return {
    userId: input.userId,
    characterRunId: input.characterRunId,
    title: `${input.characterName}의 배드엔딩: ${input.endingType}`,
    summary: `${input.characterName}은 ${input.eventTitle} 이후 ${reason}.`,
    longNarrative: `당신은 ${input.major}의 하루들을 버텨냈지만, ${input.summary} 그 선택의 끝에서 ${reason}. 이야기는 여기서 멈춘다. 아직 회사도, 직업도, 더 먼 미래도 도착하지 않았지만 대학 생활은 때로 너무 이른 결말을 만든다.`,
    careerPath: "배드엔딩",
    jobRole: null,
    destinationName: null,
    salaryBand: null,
    workplaceTone: [],
    statSnapshot: input.stats,
    keyRelationships: [],
    majorEvents: [{ eventTitle: input.eventTitle, summary: input.summary, choiceId: null }],
    satisfaction: 0,
    growthPotential: 0,
    workLifeBalance: 0,
    healthState: input.stats.health <= 0 ? "붕괴" : "나쁨",
    relationshipState: input.stats.reputation <= 0 ? "고립" : "불안정",
    tags: ["배드엔딩", input.endingType],
    similarityKey: `bad-${input.endingType}`,
  };
}
