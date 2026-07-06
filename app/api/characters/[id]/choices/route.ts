import { NextResponse } from "next/server";

import {
  applyFlagDeltas,
  applyRelationshipDeltas,
  applyStatDeltas,
  validateChoiceIndex,
} from "@/lib/game/game-rules";
import { generateAiEnding } from "@/lib/game/openrouter";
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
      eventHistory: {
        orderBy: { createdAt: "asc" },
        include: { event: true },
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
  const endingRecord = endingType ? await buildImmediateBadEndingRecord({
    userId,
    characterRunId: id,
    characterName: character.name,
    age: character.age,
    major: character.major,
    endingType,
    stats: updatedStats,
    hiddenState: character.hiddenState,
    relationships: [...character.relationships, ...newRelationships],
    eventHistory: character.eventHistory,
    eventTitle: activeEvent.title,
    summary: choice.summary,
  }) : shouldCreateFinalEnding ? await buildFinalEndingRecord({
    userId,
    characterRunId: id,
    characterName: character.name,
    age: character.age,
    major: character.major,
    stats: updatedStats,
    hiddenState: character.hiddenState,
    relationships: [...character.relationships, ...newRelationships],
    eventHistory: character.eventHistory,
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

async function buildImmediateBadEndingRecord(input: {
  userId: string;
  characterRunId: string;
  characterName: string;
  age: number;
  major: string;
  endingType: string;
  stats: Record<string, number>;
  hiddenState: unknown;
  relationships: { name: string; role: string; trust: number; tags: unknown }[];
  eventHistory: { event: { title: string }; summary: string; statDelta: unknown; relationshipDelta: unknown; flagDelta: unknown }[];
  eventTitle: string;
  summary: string;
}) {
  const reason = input.endingType === "건강 붕괴" ? "몸이 더는 버티지 못했다" :
    input.endingType === "멘탈 붕괴" ? "마음이 완전히 소진되었다" :
    "평판이 무너져 학교와 일상에서 설 자리를 잃었다";

  const aiEnding = await generateAiEnding({
    name: input.characterName,
    age: input.age,
    major: input.major,
    stats: input.stats,
    hiddenState: input.hiddenState,
    relationships: input.relationships.map((rel) => ({ name: rel.name, role: rel.role, trust: rel.trust, tags: rel.tags })),
    eventHistory: input.eventHistory.map((history) => ({
      title: history.event.title,
      summary: history.summary,
      statDelta: history.statDelta,
      relationshipDelta: history.relationshipDelta,
      flagDelta: history.flagDelta,
    })),
    finalChoiceSummary: input.summary,
  });
  const generated = aiEnding.success ? aiEnding.ending : null;

  return {
    userId: input.userId,
    characterRunId: input.characterRunId,
    title: generated?.title ?? `${input.characterName}의 배드엔딩: ${input.endingType}`,
    summary: generated?.summary ?? `${input.characterName}은 ${input.eventTitle} 이후 ${reason}.`,
    longNarrative: generated?.longNarrative ?? buildLongFallbackEnding(input.characterName, input.major, "배드엔딩", input.stats, input.summary, reason),
    careerPath: generated?.careerPath ?? "배드엔딩",
    jobRole: generated?.jobRole ?? null,
    destinationName: generated?.destinationName ?? null,
    salaryBand: generated?.salaryBand ?? null,
    workplaceTone: generated?.workplaceTone ?? [],
    statSnapshot: input.stats,
    keyRelationships: serializeRelationships(input.relationships),
    majorEvents: [...input.eventHistory.map((history) => ({ eventTitle: history.event.title, summary: history.summary, choiceId: null })), { eventTitle: input.eventTitle, summary: input.summary, choiceId: null }],
    satisfaction: generated?.satisfaction ?? 0,
    growthPotential: generated?.growthPotential ?? 0,
    workLifeBalance: generated?.workLifeBalance ?? 0,
    healthState: generated?.healthState ?? (input.stats.health <= 0 ? "붕괴" : "나쁨"),
    relationshipState: generated?.relationshipState ?? (input.stats.reputation <= 0 ? "고립" : "불안정"),
    tags: generated?.tags ?? ["배드엔딩", input.endingType],
    similarityKey: `bad-${input.endingType}`,
  };
}

async function buildFinalEndingRecord(input: {
  userId: string;
  characterRunId: string;
  characterName: string;
  age: number;
  major: string;
  stats: Record<string, number>;
  hiddenState: unknown;
  relationships: { name: string; role: string; trust: number; tags: unknown }[];
  eventHistory: { event: { title: string }; summary: string; statDelta: unknown; relationshipDelta: unknown; flagDelta: unknown }[];
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
  const aiEnding = await generateAiEnding({
    name: input.characterName,
    age: input.age,
    major: input.major,
    stats: input.stats,
    hiddenState: input.hiddenState,
    relationships: input.relationships.map((rel) => ({ name: rel.name, role: rel.role, trust: rel.trust, tags: rel.tags })),
    eventHistory: input.eventHistory.map((history) => ({
      title: history.event.title,
      summary: history.summary,
      statDelta: history.statDelta,
      relationshipDelta: history.relationshipDelta,
      flagDelta: history.flagDelta,
    })),
    finalChoiceSummary: input.summary,
  });
  const generated = aiEnding.success ? aiEnding.ending : null;

  return {
    userId: input.userId,
    characterRunId: input.characterRunId,
    title: generated?.title ?? `${input.characterName}의 ${careerPath}`,
    summary: generated?.summary ?? `${input.characterName}은 ${input.coreEventCount}개의 사건 끝에 ${careerPath} 방향으로 나아갔습니다.`,
    longNarrative: generated?.longNarrative ?? buildLongFallbackEnding(input.characterName, input.major, careerPath, input.stats, input.summary, relationshipState),
    careerPath: generated?.careerPath ?? careerPath,
    jobRole: generated?.jobRole ?? null,
    destinationName: generated?.destinationName ?? null,
    salaryBand: generated?.salaryBand ?? null,
    workplaceTone: generated?.workplaceTone ?? [],
    statSnapshot: input.stats,
    keyRelationships: serializeRelationships(input.relationships),
    majorEvents: [...input.eventHistory.map((history) => ({ eventTitle: history.event.title, summary: history.summary, choiceId: null })), { eventTitle: input.eventTitle, summary: input.summary, choiceId: null }],
    satisfaction: generated?.satisfaction ?? satisfaction,
    growthPotential: generated?.growthPotential ?? growthPotential,
    workLifeBalance: generated?.workLifeBalance ?? workLifeBalance,
    healthState: generated?.healthState ?? healthState,
    relationshipState: generated?.relationshipState ?? relationshipState,
    tags: generated?.tags ?? ["일반엔딩", careerPath],
    similarityKey: `final-${careerPath}`,
  };
}

function pickCareerPath(stats: Record<string, number>) {
  if (stats.reputation <= 20 && stats.wealth >= 60) return "회색지대에 발을 들인 범죄자";
  if (stats.practical >= 75 && stats.reputation <= 45) return "사설 탐정 같은 문제 해결자";
  if (stats.health >= 70 && stats.academic >= 55 && stats.reputation >= 50) return "경찰 또는 공공안전 직군";
  if (stats.charm >= 75 && stats.mental >= 55) return "연애와 결혼을 선택한 생활인";
  if (stats.mental >= 75 && stats.charm <= 45) return "혼자 살며 조용히 안정된 사람";
  if (stats.wealth <= 35 && stats.charm >= 60) return "해외 워홀 이후 다시 길을 찾은 사람";
  if (stats.wealth >= 70 && stats.practical >= 60) return "창업 또는 자영업";
  if (stats.academic >= 75 && stats.mental >= 55) return "전문직 시험 준비";
  if (stats.reputation >= 70 && stats.practical >= 55) return "기업 취업";
  if (stats.academic >= 65 && stats.health >= 45) return "공공기관 또는 공무원 준비";
  if (stats.charm >= 70) return "마케팅·콘텐츠 직무";
  return "불확실하지만 계속되는 취업 준비";
}

function serializeRelationships(relationships: { name: string; role: string; trust: number; tags: unknown }[]) {
  return relationships.map((rel) => ({
    name: rel.name,
    role: rel.role,
    trust: rel.trust,
    tags: Array.isArray(rel.tags) ? rel.tags.filter((tag) => typeof tag === "string") : [],
  }));
}

function buildLongFallbackEnding(
  name: string,
  major: string,
  careerPath: string,
  stats: Record<string, number>,
  finalChoiceSummary: string,
  relationshipState: string,
) {
  const publicStrength = stats.academic >= stats.practical ? "당신은 책상 앞에서 오래 버티는 법을 알았다" : "당신은 현장에서 몸으로 익히는 속도가 빨랐다";
  const reversal = stats.reputation < 45
    ? "그러나 평판은 이상한 방식으로 뒤따라왔다. 한때 사소하게 넘겼던 말과 관계의 균열은, 가장 중요한 추천과 면접의 계절에 다시 고개를 들었다"
    : stats.health < 45
      ? "그러나 몸은 뒤늦게 청구서를 내밀었다. 커리어가 막 속도를 내기 시작할 때마다 당신은 쉬어야 했고, 쉬는 동안 다른 사람들은 한 발씩 앞서 나갔다"
      : stats.mental < 45
        ? "그러나 마음은 쉽게 회복되지 않았다. 남들이 보기에는 멀쩡한 성취도 당신에게는 늘 다음 실패를 미루는 임시방편처럼 느껴졌다"
        : "그러나 삶은 단순한 보상처럼 흘러가지 않았다. 잘한 선택도 대가를 남겼고, 피한 선택도 언젠가는 다른 얼굴로 돌아왔다";

  return `${name}의 이야기는 ${major}의 강의실에서 끝나지 않았다. 당신은 여러 사건을 지나 ${careerPath}라는 이름의 다음 문을 열었고, 그 문 안에는 생각보다 좁은 복도와 밝은 창문이 함께 있었다. ${publicStrength}. 그래서 처음에는 꽤 잘해냈다. 보고서는 깔끔했고, 면접에서는 침착했으며, 사람들이 놓치는 작은 흐름을 읽어내는 날도 있었다. ${finalChoiceSummary} 그 마지막 선택은 당신을 당장 유명하게 만들지는 않았지만, 이후 몇 년 동안 반복해서 떠오르는 기준점이 되었다.

${reversal}. 당신은 한때 성공이 직선이라고 믿었지만, 실제의 커리어는 더 지저분하고 더 오래 걸리는 문장에 가까웠다. 누군가와의 관계가 예상 밖의 도움으로 돌아오기도 했고, 반대로 잘못 틀어진 사람이 당신의 길목에서 차가운 얼굴로 서 있기도 했다. 사랑에 가까웠던 마음은 생활 앞에서 작아졌고, 미움에 가까웠던 관계는 오히려 당신을 더 단단하게 만들었다.

몇 년 뒤 당신은 처음 상상했던 모습과는 다른 표정으로 살고 있었다. 돈을 아주 많이 벌지는 못했을 수도 있고, 반대로 꽤 안정적인 직함을 얻었으면서도 밤마다 조용히 무너졌을 수도 있다. 중요한 것은 당신이 그 모든 결과를 하나의 숫자로 설명할 수 없다는 점이었다. ${relationshipState}이라는 결론 속에서, 당신은 얻은 것과 잃은 것을 모두 기억하는 사람이 되었다. 그래서 이 엔딩은 완벽한 성공도 완전한 실패도 아니다. 다만 당신이 치른 비용과 끝내 남긴 가능성이, 오래된 노트의 마지막 장처럼 조용히 접혀 있을 뿐이다.`;
}
