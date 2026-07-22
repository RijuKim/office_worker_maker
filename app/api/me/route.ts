import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { requireCurrentUserId } from "@/lib/server/session";
import { logger } from "@/lib/server/logger";

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request | NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const log = logger.withRequestId(requestId);
  const userId = await requireCurrentUserId();

  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const [user, usage] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    }),
    prisma.aiUsage.findUnique({
      where: {
        userId_date: {
          userId,
          date: dateKey(),
        },
      },
      select: {
        date: true,
        count: true,
      },
    }),
  ]);

  if (!user) {
    log.error("사용자 정보 조회 실패 - 계정 없음", { userId });
    return NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      ...user,
      createdAt: user.createdAt.toISOString(),
    },
    aiUsage: {
      date: usage?.date ?? dateKey(),
      count: usage?.count ?? 0,
      limit: null,
      remaining: null,
    },
  });
}
