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

  if (body?.action === "fallback-event" || body?.action === "forced-event") {
    const forced = body.action === "forced-event";
    await prisma.event.updateMany({ where: { characterRunId: character.id, status: "ACTIVE" }, data: { status: "DISCARDED" } });
    const event = await prisma.event.create({
      data: {
        characterRunId: character.id,
        source: forced ? "FORCED" : "FALLBACK",
        status: "ACTIVE",
        title: forced ? "번아웃 경고" : "AI 연결 대신 도착한 사건",
        body: forced ? "누적된 피로로 잠시 멈추고 회복 방법을 골라야 합니다." : "연결이 불안정해도 준비된 대체 사건으로 이야기는 계속됩니다.",
        choices: forced
          ? [{ id: "rest", label: "충분히 쉬고 상담을 받는다", statDelta: { health: 2, mental: 2 } }]
          : [{ id: "continue", label: "대체 사건에서 계속한다", statDelta: { practical: 1 } }],
        tags: forced ? ["burnout", "recovery"] : ["fallback"],
        safetyChecked: true,
      },
    });
    await prisma.characterRun.update({ where: { id: character.id }, data: { currentEventId: event.id } });
    return NextResponse.json({ eventId: event.id }, { status: 201 });
  }

  if (body?.action === "life-stage-leave") {
    await prisma.$transaction([
      prisma.characterStats.update({ where: { characterRunId: character.id }, data: { health: 2, mental: 2 } }),
      prisma.hiddenState.update({
        where: { characterRunId: character.id },
        data: { burnoutRisk: 90, eventFlags: { stageEventCount: 1, lifeStage: { id: "college_mid", term: { gradeYear: 2, semester: 1 } } } },
      }),
      prisma.characterRun.update({ where: { id: character.id }, data: { academicStatus: "LEAVE" } }),
    ]);
    return NextResponse.json({ academicStatus: "LEAVE" });
  }

  if (body?.action === "records-partial") {
    await prisma.careerEndingRecord.createMany({
      data: [
        { userId, characterRunId: character.id, title: "삼슨전자", summary: "첫 취업", longNarrative: "준비 끝에 첫 직장에 입사했습니다.", careerPath: "삼슨전자 신입 실무자", jobRole: "서비스 기획자", destinationName: "삼슨전자", salaryBand: "4,500만원", workplaceTone: ["차분함"], statSnapshot: {}, keyRelationships: [], majorEvents: [], satisfaction: 80, growthPotential: 85, workLifeBalance: 70, healthState: "양호", relationshipState: "안정", tags: ["회사취업"], similarityKey: `acceptance-${character.id}-1` },
        { userId, characterRunId: character.id, title: "건강 붕괴", summary: "회복의 시작", longNarrative: "과로를 멈추고 회복을 선택했습니다.", careerPath: "휴학 중 경험", jobRole: null, destinationName: null, salaryBand: null, workplaceTone: ["회복"], statSnapshot: {}, keyRelationships: [], majorEvents: [], satisfaction: 55, growthPotential: 60, workLifeBalance: 90, healthState: "회복 중", relationshipState: "안정", tags: ["건강"], similarityKey: `acceptance-${character.id}-2` },
      ],
    });
    return NextResponse.json({ count: 2 }, { status: 201 });
  }

  if (body?.action === "career-panels") {
    await prisma.$transaction([
      prisma.spec.create({ data: { characterRunId: character.id, specType: "PORTFOLIO", specName: "서비스 기획 포트폴리오", status: "COMPLETED", score: "우수" } }),
      prisma.jobApplication.create({ data: { characterRunId: character.id, companyName: "가상 테크", companyType: "스타트업", currentStage: "FIRST_INTERVIEW", specScore: 72 } }),
      prisma.careerPath.create({ data: { characterRunId: character.id, pathType: "PRODUCT", pathName: "프로덕트 매니저", status: "PREPARING" } }),
    ]);
    return NextResponse.json({ seeded: true }, { status: 201 });
  }

  return NextResponse.json({ error: "알 수 없는 fixture action입니다." }, { status: 400 });
}
