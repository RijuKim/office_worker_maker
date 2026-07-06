import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { requireCurrentUserId } from "@/lib/server/session";

type RouteContext = { params: Promise<{ id: string }> };

const MIN_CORE_EVENTS = 15;

export async function POST(_request: Request, context: RouteContext) {
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
      eventHistory: {
        orderBy: { createdAt: "asc" },
        include: { event: true },
      },
    },
  });

  if (!character) {
    return NextResponse.json({ error: "캐릭터를 찾을 수 없습니다." }, { status: 404 });
  }

  if (!character.stats) {
    return NextResponse.json({ error: "캐릭터 데이터가 불완전합니다." }, { status: 500 });
  }

  if (character.coreEventCount < MIN_CORE_EVENTS) {
    return NextResponse.json(
      { error: `아직 기록을 생성하기에 부족합니다. (최소 ${MIN_CORE_EVENTS}개의 핵심 이벤트 필요)` },
      { status: 400 },
    );
  }

  const branchTypes = ["EMPLOYMENT", "ENTREPRENEURSHIP", "GRADUATED", "DROPPED_OUT", "LEAVE_EXTENDED"];
  const hasBranchPoint = character.academicStatus !== "ENROLLED" ||
    character.eventHistory.some((h: { flagDelta: unknown }) =>
      branchTypes.some((bt) => JSON.stringify(h.flagDelta).includes(bt)),
    );

  if (!hasBranchPoint) {
    return NextResponse.json(
      { error: "진로 분기점에 도달해야 기록을 생성할 수 있습니다." },
      { status: 400 },
    );
  }

  const statSnapshot = {
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
  };

  const topStats = Object.entries(statSnapshot)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([key]) => key);

  const careerPath = character.academicStatus === "GRADUATED" ? "졸업 후 취업" :
    character.academicStatus === "DROPPED_OUT" ? "자퇴 후 진로" :
    character.academicStatus === "LEAVE" ? "휴학 중 경험" :
    "진로 탐색";

  const keyRelationships = character.relationships.map((r: { name: string; role: string; trust: number }) => ({
    name: r.name,
    role: r.role,
    trust: r.trust,
  }));

  const majorEvents = character.eventHistory
    .slice(-7)
    .map((h: { event: { title: string }; summary: string; choiceId: string | null }) => ({
      eventTitle: h.event.title,
      summary: h.summary,
      choiceId: h.choiceId,
    }));

  const satisfaction = Math.round(
    (statSnapshot.health + statSnapshot.mental + statSnapshot.network) / 3,
  );
  const growthPotential = Math.round(
    (statSnapshot.academic + statSnapshot.practical + statSnapshot.creativity) / 3,
  );
  const workLifeBalance = Math.round(
    (statSnapshot.health + statSnapshot.mental + statSnapshot.charm) / 3,
  );

  const healthState = character.stats.health >= 70 ? "좋음" :
    character.stats.health >= 40 ? "보통" : "나쁨";
  const relationshipState = character.stats.network >= 60 ? "풍부함" :
    character.stats.network >= 30 ? "보통" : "고립";

  const tags = new Set([
    ...topStats,
    careerPath,
    character.academicStatus,
    `건강:${healthState}`,
  ]);

  const similarityKey = `${careerPath}-${topStats[0] ?? "general"}`;

  const record = await prisma.careerEndingRecord.create({
    data: {
      userId,
      characterRunId: id,
      title: `${character.name}의 ${careerPath}`,
      summary: `${character.name}은 ${character.major}를 전공하며 ${character.coreEventCount}개의 이벤트를 경험했습니다. 최종적으로 ${careerPath}를 선택했습니다.`,
      longNarrative: generateNarrative(character.name, character.major, careerPath, topStats, satisfaction),
      careerPath,
      jobRole: null,
      destinationName: null,
      salaryBand: null,
      workplaceTone: [],
      statSnapshot,
      keyRelationships,
      majorEvents,
      satisfaction,
      growthPotential,
      workLifeBalance,
      healthState,
      relationshipState,
      tags: Array.from(tags),
      similarityKey,
    },
  });

  return NextResponse.json({ record }, { status: 201 });
}

function generateNarrative(
  name: string,
  major: string,
  careerPath: string,
  topStats: string[],
  satisfaction: number,
): string {
  const statDescriptions: Record<string, string> = {
    academic: "학업에 충실했던",
    practical: "실무 감각이 뛰어난",
    communication: "소통을 잘하는",
    creativity: "창의적인",
    health: "건강 관리에 신경 썼던",
    mental: "멘탈이 강한",
    network: "인맥이 넓은",
    wealth: "경제 감각이 있는",
    reputation: "평판이 좋은",
    charm: "매력적인",
  };

  const statDescription = topStats.slice(0, 2).map((s: string) => statDescriptions[s] || s).join(" ");

  const satisfactionText = satisfaction >= 70 ? "만족스러운" :
    satisfaction >= 40 ? "나름 괜찮은" : "아쉬움이 남는";

  return `${name}은 대학 시절 ${major}를 전공하며 ${statDescription} 학생으로 기억됩니다. ${careerPath}를 선택한 ${name}의 이야기는 ${satisfactionText} 결말로 마무리되었습니다. 앞으로의 길이 어떻든, 이 경험은 분명 의미 있는 자양분이 될 것입니다.`;
}