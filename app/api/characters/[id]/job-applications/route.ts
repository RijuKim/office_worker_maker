import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { requireCurrentUserId } from "@/lib/server/session";

type RouteContext = { params: Promise<{ id: string }> };

const VALID_COMPANY_TYPES = ["대기업", "스타트업", "공기업", "전문직", "외국계"] as const;

type CompanyTypeValue = (typeof VALID_COMPANY_TYPES)[number];

export async function POST(request: Request, context: RouteContext) {
  const userId = await requireCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await context.params;

  const character = await prisma.characterRun.findFirst({
    where: { id, userId },
    select: { id: true, specScore: true },
  });

  if (!character) {
    return NextResponse.json({ error: "캐릭터를 찾을 수 없습니다." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const companyName = typeof body?.companyName === "string" ? body.companyName.trim() : "";
  const companyType = typeof body?.companyType === "string" ? body.companyType : null;

  if (!companyName) {
    return NextResponse.json({ error: "회사 이름을 입력해주세요." }, { status: 400 });
  }

  if (!companyType || !VALID_COMPANY_TYPES.includes(companyType as CompanyTypeValue)) {
    return NextResponse.json(
      { error: "올바른 회사 유형이 아닙니다. (대기업, 스타트업, 공기업, 전문직, 외국계)" },
      { status: 400 },
    );
  }

  const application = await prisma.jobApplication.create({
    data: {
      characterRunId: id,
      companyName,
      companyType,
      currentStage: "DOCUMENT",
      specScore: character.specScore,
      isActive: true,
    },
  });

  return NextResponse.json({ application }, { status: 201 });
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

  const applications = await prisma.jobApplication.findMany({
    where: { characterRunId: id, isActive: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ applications });
}
