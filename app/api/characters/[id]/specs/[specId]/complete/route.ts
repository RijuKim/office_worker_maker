import { NextResponse, type NextRequest } from "next/server";

import { calculateSpecScore } from "@/lib/game/spec-system";
import { prisma } from "@/lib/server/prisma";
import { requireCurrentUserId } from "@/lib/server/session";
import { logger } from "@/lib/server/logger";

type RouteContext = { params: Promise<Record<string, string>> };

const VALID_STATUSES = ["COMPLETED", "FAILED"] as const;

type StatusValue = (typeof VALID_STATUSES)[number];

export async function POST(request: Request | NextRequest, context: RouteContext) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const log = logger.withRequestId(requestId);
  const userId = await requireCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id, specId } = await context.params;

  const character = await prisma.characterRun.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!character) {
    return NextResponse.json({ error: "캐릭터를 찾을 수 없습니다." }, { status: 404 });
  }

  const spec = await prisma.spec.findFirst({
    where: { id: specId, characterRunId: id },
  });

  if (!spec) {
    return NextResponse.json({ error: "스펙을 찾을 수 없습니다." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const rawStatus = typeof body?.status === "string" ? body.status : "COMPLETED";
  const score = typeof body?.score === "string" ? body.score : null;

  if (!VALID_STATUSES.includes(rawStatus as StatusValue)) {
    return NextResponse.json({ error: "올바른 상태가 아닙니다." }, { status: 400 });
  }

  const status = rawStatus as StatusValue;

  const updatedSpec = await prisma.spec.update({
    where: { id: specId },
    data: {
      status,
      score,
      completedAt: new Date(),
    },
  });

  const allSpecs = await prisma.spec.findMany({
    where: { characterRunId: id },
    select: { specType: true, status: true, score: true },
  });

  const specScore = calculateSpecScore(
    allSpecs.map((s: { specType: string; status: string; score: string | null }) => ({
      specType: s.specType,
      status: s.status,
      score: s.score,
    })),
  );

  await prisma.characterRun.update({
    where: { id },
    data: { specScore },
  });

  log.info("스펙 완료", { userId, characterId: id, specId, status, specScore });

  return NextResponse.json({ spec: updatedSpec, specScore });
}
