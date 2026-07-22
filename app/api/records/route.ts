import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { requireCurrentUserId } from "@/lib/server/session";
import { logger } from "@/lib/server/logger";

export async function GET(request: Request | NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const log = logger.withRequestId(requestId);
  const userId = await requireCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const careerFilter = searchParams.get("careerPath");
  const sortBy = searchParams.get("sort") ?? "newest";

  const where: Record<string, unknown> = { userId };
  if (careerFilter) {
    where.careerPath = careerFilter;
  }

  const orderBy: Record<string, string> =
    sortBy === "oldest" ? { createdAt: "asc" } :
    sortBy === "satisfaction" ? { satisfaction: "desc" } :
    { createdAt: "desc" };

  const records = await prisma.careerEndingRecord.findMany({
    where,
    orderBy,
    include: {
      characterRun: {
        select: { name: true, major: true },
      },
    },
  });

  const grouped = groupSimilarRecords(records);

  return NextResponse.json({ records, grouped });
}

function groupSimilarRecords(
  records: Array<{ similarityKey: string; id: string; title: string }>,
): Array<{ key: string; recordIds: string[]; titles: string[] }> {
  const groups = new Map<string, { recordIds: string[]; titles: string[] }>();

  for (const record of records) {
    const existing = groups.get(record.similarityKey);
    if (existing) {
      existing.recordIds.push(record.id);
      if (!existing.titles.includes(record.title)) {
        existing.titles.push(record.title);
      }
    } else {
      groups.set(record.similarityKey, {
        recordIds: [record.id],
        titles: [record.title],
      });
    }
  }

  return Array.from(groups.entries())
    .filter(([, g]) => g.recordIds.length > 1)
    .map(([key, g]) => ({ key, ...g }));
}
