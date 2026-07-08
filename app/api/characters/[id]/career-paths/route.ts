import { NextResponse } from "next/server";

import { isCareerPathEligible } from "@/lib/game/spec-system";
import { prisma } from "@/lib/server/prisma";
import { requireCurrentUserId } from "@/lib/server/session";
import { logger } from "@/lib/server/logger";

type RouteContext = { params: Promise<{ id: string }> };

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
    include: { stats: true },
  });

  if (!character) {
    return NextResponse.json({ error: "캐릭터를 찾을 수 없습니다." }, { status: 404 });
  }

  if (!character.stats) {
    return NextResponse.json({ error: "캐릭터 데이터가 불완전합니다." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const pathType = typeof body?.pathType === "string" ? body.pathType : null;
  const pathName = typeof body?.pathName === "string" ? body.pathName.trim() : "";

  if (!pathType) {
    return NextResponse.json({ error: "경로 유형을 지정해주세요." }, { status: 400 });
  }

  if (!pathName) {
    return NextResponse.json({ error: "경로 이름을 입력해주세요." }, { status: 400 });
  }

  const stats: Record<string, number> = {
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

  const eligibility = isCareerPathEligible(pathType, stats, character.major);
  if (!eligibility.eligible) {
    return NextResponse.json(
      { error: eligibility.reason ?? "해당 진로는 현재 선택할 수 없습니다." },
      { status: 400 },
    );
  }

  const careerPath = await prisma.careerPath.create({
    data: {
      characterRunId: id,
      pathType,
      pathName,
      status: "PREPARING",
    },
  });

  log.info("진로 경로 생성", { userId, characterId: id, careerPathId: careerPath.id, pathType, pathName });

  return NextResponse.json({ careerPath }, { status: 201 });
}

export async function GET(_request: Request, context: RouteContext) {
  const userId = await requireCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await context.params;

  const character = await prisma.characterRun.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!character) {
    return NextResponse.json({ error: "캐릭터를 찾을 수 없습니다." }, { status: 404 });
  }

  const careerPaths = await prisma.careerPath.findMany({
    where: { characterRunId: id },
    orderBy: { startedAt: "asc" },
  });

  return NextResponse.json({ careerPaths });
}
