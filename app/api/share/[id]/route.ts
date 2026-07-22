import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { normalizePublicEndingDto } from "@/lib/game-ui/types";

const PUBLIC_ENDING_SELECT = {
  id: true,
  title: true,
  summary: true,
  longNarrative: true,
  careerPath: true,
  jobRole: true,
  destinationName: true,
  salaryBand: true,
  workplaceTone: true,
  satisfaction: true,
  growthPotential: true,
  workLifeBalance: true,
  healthState: true,
  relationshipState: true,
  tags: true,
  statSnapshot: true,
  keyRelationships: true,
  majorEvents: true,
} as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const record = await prisma.careerEndingRecord.findUnique({
    where: { id },
    select: PUBLIC_ENDING_SELECT,
  });

  if (!record) {
    return NextResponse.json({ error: "기록을 찾을 수 없습니다" }, { status: 404 });
  }

  return NextResponse.json(normalizePublicEndingDto(record));
}
