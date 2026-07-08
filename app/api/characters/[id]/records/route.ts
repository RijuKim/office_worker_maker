import { NextResponse } from "next/server";

import { findBestMatchingDestination, seedCareerDestinations } from "@/lib/game/career-data";
import { prisma } from "@/lib/server/prisma";
import { requireCurrentUserId } from "@/lib/server/session";
import { logger } from "@/lib/server/logger";

type RouteContext = { params: Promise<{ id: string }> };

const MIN_CORE_EVENTS = 5;

export async function POST(request: Request, context: RouteContext) {
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
    character.eventHistory.some((h: { flagDelta: unknown }) => {
      const flags = h.flagDelta as Record<string, unknown>;
      return branchTypes.some((bt) => JSON.stringify(flags).includes(bt)) ||
        (typeof flags.careerGate === "object" && flags.careerGate !== null);
    });

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
      longNarrative: generateNarrative({
        name: character.name,
        major: character.major,
        careerPath,
        topStats,
        satisfaction,
        growthPotential,
        workLifeBalance,
        healthState,
        relationshipState,
        statSnapshot,
        keyRelationships,
        majorEvents,
      }),
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

  log.info("기록 생성 완료", { userId, characterId: id, recordId: record.id, careerPath });

  return NextResponse.json({ record }, { status: 201 });
}

function generateNarrative(context: {
  name: string;
  major: string;
  careerPath: string;
  topStats: string[];
  satisfaction: number;
  growthPotential: number;
  workLifeBalance: number;
  healthState: string;
  relationshipState: string;
  statSnapshot: Record<string, number>;
  keyRelationships: { name: string; role: string; trust: number }[];
  majorEvents: { eventTitle: string; summary: string }[];
}): string {
  const { name, major, careerPath, topStats, satisfaction, growthPotential, workLifeBalance, healthState, relationshipState, statSnapshot, keyRelationships, majorEvents } = context;

  const statDescriptions: Record<string, string> = {
    academic: "학업 성취도가 높았던", practical: "실무 감각이 뛰어난",
    communication: "소통 능력이 출중했던", creativity: "창의성이 빛났던",
    health: "건강 관리에 철저했던", mental: "멘탈이 강했던",
    network: "인맥 관리에 능했던", wealth: "경제 감각이 있었던",
    reputation: "평판이 좋았던", charm: "매력적인",
  };

  const statList = Object.entries(statSnapshot)
    .sort(([, a], [, b]) => b - a)
    .map(([key, val]) => `${({ academic: "학업", practical: "실무", communication: "커뮤니케이션", creativity: "창의성", health: "건강", mental: "멘탈", network: "네트워크", wealth: "자산", reputation: "평판", charm: "매력" } as Record<string, string>)[key] ?? key}: ${val}`)
    .join(", ");

  const topStatDesc = topStats.slice(0, 3).map((s) => statDescriptions[s] || s).join(", ");

  const relText = keyRelationships.length > 0
    ? keyRelationships.slice(0, 3).map((r) => `${r.name}(${r.role}, 신뢰 ${r.trust})`).join(", ")
    : "특별한 관계는 없었지만";

  const eventText = majorEvents.length > 0
    ? majorEvents.slice(-5).map((e) => `「${e.eventTitle}」`).join(", ")
    : "뚜렷한 사건 없이 흘러간";

  const sections: string[] = [];

  sections.push(
    `${name}은 대학에서 ${major}를 전공했다. ${name}의 대학 생활은 결코 평범하지 않았다. ${topStatDesc} 점이 특징적이었으며, ${careerPath}를 선택하기까지 여러 갈림길과 선택이 있었다.`
  );

  sections.push(
    `졸업을 앞둔 시점, ${name}의 주요 스탯은 다음과 같았다: ${statList}. ${healthState === "좋음" ? "건강 상태는 양호했고" : healthState === "보통" ? "건강은 그럭저럭 유지되었고" : "건강은 다소 나빴지만"} ${relationshipState === "풍부함" ? "주변 관계는 풍부했다" : relationshipState === "보통" ? "관계는 평범한 수준이었다" : "사회적 관계는 다소 고립되어 있었다"}.`
  );

  sections.push(
    `${name}이 기억하는 중요한 순간들은 ${eventText} 등이 있었다. 각각의 선택은 ${name}의 스탯과 관계에 조금씩 영향을 미쳤고, 그 결과 현재의 ${name}가 완성되었다.`
  );

  if (keyRelationships.length > 0) {
    sections.push(
      `${name}의 대학 생활에 함께한 사람들: ${relText}. 이들과의 관계는 ${name}의 성장에 적지 않은 영향을 주었다.`
    );
  }

  const satisfactionText = satisfaction >= 70 ? "전반적으로 만족스러운 대학 생활을 보냈다. 선택한 길에 대한 후회는 크지 않다." :
    satisfaction >= 40 ? "나름대로 의미 있는 시간이었다. 아쉬운 점도 있지만, 그것 또한 경험이다." :
    "여러모로 아쉬움이 남는 시간이었다. 그러나 그 경험들이 앞으로의 밑거름이 될 것이다.";

  const growthText = growthPotential >= 60 ? `${name}은 앞으로도 충분히 성장할 가능성이 높다. 학업과 실무에서 쌓은 기반이 탄탄하다.` :
    growthPotential >= 35 ? `${name}에게는 아직 성장의 여지가 남아 있다. 앞으로의 환경과 선택에 따라 달라질 것이다.` :
    "성장 가능성은 낮게 평가되었지만, 이는 시작점일 뿐이다.";

  sections.push(
    `${name}의 ${careerPath} 선택은 우연이 아니었다. 그동안의 경험과 선택이 자연스럽게 이어져 만들어진 결과였다. ${satisfactionText}`
  );

  sections.push(growthText);

  const wlbText = workLifeBalance >= 60 ? "워라밸은 좋은 편이었다. 건강과 멘탈을 적절히 관리하며 균형을 유지했다." :
    workLifeBalance >= 35 ? "워라밸은 평범했다. 가끔은 일과 삶 사이에서 줄타기를 해야 했다." :
    "워라밸은 좋지 않았다. 학업이나 진로에 치중한 나머지 삶의 균형을 잃기도 했다.";
  sections.push(wlbText);

  sections.push(
    `${name}의 이야기는 여기서 끝이 아니다. ${careerPath}는 ${name}의 첫걸음에 불과하다. 앞으로 어떤 길을 걷게 될지, 그 완성은 아직 남아 있다. 이 기록은 ${name}의 대학 시절과 첫 진로 선택을 기념하기 위해 남긴다.`
  );

  return sections.join("\n\n");
}