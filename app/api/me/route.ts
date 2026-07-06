import { NextResponse } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { requireCurrentUserId } from "@/lib/server/session";

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export async function GET() {
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
      limit: 30,
      remaining: Math.max(0, 30 - (usage?.count ?? 0)),
    },
  });
}
