import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const record = await prisma.careerEndingRecord.findUnique({
    where: { id },
    include: {
      characterRun: {
        select: { name: true, major: true },
      },
    },
  });

  if (!record) {
    return NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ record });
}
