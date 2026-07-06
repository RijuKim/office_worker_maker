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
      trust: Math.max(-100, Math.min(100, rel.trust >= 0 ? 35 + rel.trust : rel.trust)),
      tags: inferRelationshipTags(rel.name, activeEvent.title),
    }));
  const endingType = getImmediateBadEnding(updatedStats);
  const shouldCreateFinalEnding = !endingType && character.coreEventCount >= 14;
  const endingRecord = endingType ? buildImmediateBadEndingRecord({
    userId,
    characterRunId: id,
    characterName: character.name,
    major: character.major,
    endingType,
    stats: updatedStats,
    eventTitle: activeEvent.title,
    summary: choice.summary,
  }) : shouldCreateFinalEnding ? buildFinalEndingRecord({
    userId,
    characterRunId: id,
    characterName: character.name,
    major: character.major,
    stats: updatedStats,
    eventTitle: activeEvent.title,
    summary: choice.summary,
    coreEventCount: character.coreEventCount + 1,
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
          academicStatus: endingType ? "DROPPED_OUT" : "GRADUATED",
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
      endingType: endingType ?? (shouldCreateFinalEnding ? "커리어와 엔딩" : null),
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

function buildFinalEndingRecord(input: {
  userId: string;
  characterRunId: string;
  characterName: string;
  major: string;
  stats: Record<string, number>;
  eventTitle: string;
  summary: string;
  coreEventCount: number;
}) {
  const careerPath = pickCareerPath(input.stats);
  const satisfaction = Math.round((input.stats.health + input.stats.mental + input.stats.reputation) / 3);
  const growthPotential = Math.round((input.stats.academic + input.stats.practical + input.stats.charm) / 3);
  const workLifeBalance = Math.round((input.stats.health + input.stats.mental) / 2);
  const healthState = input.stats.health >= 70 ? "좋음" : input.stats.health >= 35 ? "보통" : "불안";
  const relationshipState = input.stats.reputation >= 70 ? "넓고 안정적" : input.stats.reputation >= 35 ? "좁지만 유지됨" : "불안정";

  return {
    userId: input.userId,
    characterRunId: input.characterRunId,
    title: `${input.characterName}의 ${careerPath}`,
    summary: `${input.characterName}은 ${input.coreEventCount}개의 사건 끝에 ${careerPath} 방향으로 나아갔습니다.`,
    longNarrative: `당신은 ${input.major}의 낯선 아침에서 시작해 ${input.coreEventCount}개의 사건을 통과했다. ${input.summary} 그 선택은 마지막 문장처럼 조용했지만, 그동안 쌓인 학업, 실무, 건강, 멘탈, 자산, 매력, 평판이 함께 당신을 밀어냈다. 결국 당신은 ${careerPath}라는 이름의 다음 계절로 걸어간다. 완벽한 결말은 아니지만, 이 기록은 당신이 어떤 비용을 치르고 어떤 가능성을 남겼는지 보여준다.`,
    careerPath,
    jobRole: null,
    destinationName: null,
    salaryBand: null,
    workplaceTone: [],
    statSnapshot: input.stats,
    keyRelationships: [],
    majorEvents: [{ eventTitle: input.eventTitle, summary: input.summary, choiceId: null }],
    satisfaction,
    growthPotential,
    workLifeBalance,
    healthState,
    relationshipState,
    tags: ["일반엔딩", careerPath],
    similarityKey: `final-${careerPath}`,
  };
}

function pickCareerPath(stats: Record<string, number>) {
  if (stats.wealth >= 70 && stats.practical >= 60) return "창업 또는 자영업";
  if (stats.academic >= 75 && stats.mental >= 55) return "전문직 시험 준비";
  if (stats.reputation >= 70 && stats.practical >= 55) return "기업 취업";
  if (stats.academic >= 65 && stats.health >= 45) return "공공기관 또는 공무원 준비";
  if (stats.charm >= 70) return "마케팅·콘텐츠 직무";
  return "불확실하지만 계속되는 취업 준비";
}
