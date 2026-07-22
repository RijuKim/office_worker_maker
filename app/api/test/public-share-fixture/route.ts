import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";

function unavailable() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function POST() {
  if (process.env.NODE_ENV === "production") return unavailable();

  const suffix = crypto.randomUUID();
  const userId = `share-user-${suffix}`;
  const characterRunId = `share-run-${suffix}`;
  const recordId = `share-record-${suffix}`;

  await prisma.$transaction([
    prisma.user.create({ data: { id: userId, email: `${userId}@example.test`, passwordHash: "acceptance-fixture" } }),
    prisma.characterRun.create({ data: { id: characterRunId, userId, name: "공개 테스트", age: 24, startGradeYear: 4, major: "테스트학과" } }),
    prisma.careerEndingRecord.create({
      data: {
        id: recordId, userId, characterRunId, title: "공개된 첫 기록", summary: "공개 요약", longNarrative: "공개 장문 서사",
        careerPath: "기획", jobRole: "서비스 기획자", destinationName: null, salaryBand: "4,500만원",
        workplaceTone: ["차분함"], statSnapshot: { academic: 8 }, keyRelationships: [{ name: "민준", role: "동기", trust: 80 }],
        majorEvents: [{ summary: "첫 입사" }], satisfaction: 84, growthPotential: 91, workLifeBalance: 73,
        healthState: "양호", relationshipState: "안정", tags: ["첫 도전"], similarityKey: `private-similarity-${suffix}`,
      },
    }),
  ]);

  return NextResponse.json({ recordId, cleanupId: userId }, { status: 201 });
}

export async function DELETE(request: Request | NextRequest) {
  if (process.env.NODE_ENV === "production") return unavailable();
  const cleanupId = new URLSearchParams(request.url.split("?")[1] ?? "").get("cleanupId");
  if (!cleanupId?.startsWith("share-user-")) {
    return NextResponse.json({ error: "Invalid fixture id" }, { status: 400 });
  }
  await prisma.user.deleteMany({ where: { id: cleanupId } });
  return new NextResponse(null, { status: 204 });
}
