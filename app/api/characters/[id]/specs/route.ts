import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { requireCurrentUserId } from "@/lib/server/session";
import { logger } from "@/lib/server/logger";

type RouteContext = { params: Promise<Record<string, string>> };

const VALID_SPEC_TYPES = [
  "INTERNSHIP",
  "LANGUAGE_SCORE",
  "PORTFOLIO",
  "CERTIFICATION",
  "EXAM_PREP",
  "CAREER_PATH",
] as const;

type SpecTypeValue = (typeof VALID_SPEC_TYPES)[number];

export async function POST(request: Request | NextRequest, context: RouteContext) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const log = logger.withRequestId(requestId);
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

  const body = await request.json().catch(() => null);
  const specType = typeof body?.specType === "string" ? body.specType : null;
  const specName = typeof body?.specName === "string" ? body.specName.trim() : "";

  if (!specType || !VALID_SPEC_TYPES.includes(specType as SpecTypeValue)) {
    return NextResponse.json({ error: "올바른 스펙 유형이 아닙니다." }, { status: 400 });
  }

  if (!specName) {
    return NextResponse.json({ error: "스펙 이름을 입력해주세요." }, { status: 400 });
  }

  const spec = await prisma.spec.create({
    data: {
      characterRunId: id,
      specType: specType as SpecTypeValue,
      specName,
      status: "IN_PROGRESS",
    },
  });

  log.info("스펙 생성", { userId, characterId: id, specId: spec.id, specType, specName });

  return NextResponse.json({ spec }, { status: 201 });
}

export async function GET(_request: Request | NextRequest, context: RouteContext) {
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

  const specs = await prisma.spec.findMany({
    where: { characterRunId: id },
    orderBy: { startedAt: "asc" },
  });

  return NextResponse.json({ specs });
}
