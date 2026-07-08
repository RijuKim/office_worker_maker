import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { signupSchema } from "@/lib/game/validation";
import { hashPassword } from "@/lib/server/password";
import { prisma } from "@/lib/server/prisma";
import { GUEST_USER_COOKIE, getGuestUserId } from "@/lib/server/session";
import { logger } from "@/lib/server/logger";

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const log = logger.withRequestId(requestId);

  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    log.warn("회원가입 유효성 검사 실패", { issues: parsed.error.flatten().fieldErrors });
    return NextResponse.json(
      { error: "입력값을 확인해 주세요.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const passwordHash = await hashPassword(parsed.data.password);
    const guestUserId = await getGuestUserId();
    const guestUser = guestUserId
      ? await prisma.user.findUnique({ where: { id: guestUserId }, select: { id: true, email: true } })
      : null;
    const user = guestUser?.email.endsWith("@guest.local")
      ? await prisma.user.update({
        where: { id: guestUser.id },
        data: {
          email: parsed.data.email,
          passwordHash,
        },
        select: {
          id: true,
          email: true,
          createdAt: true,
        },
      })
      : await prisma.user.create({
        data: {
          email: parsed.data.email,
          passwordHash,
        },
        select: {
          id: true,
          email: true,
          createdAt: true,
        },
      });

    if (guestUser) {
      const cookieStore = await cookies();
      cookieStore.delete(GUEST_USER_COOKIE);
    }

    log.info("회원가입 성공", { userId: user.id, email: user.email, wasGuest: !!guestUser });

    return NextResponse.json(
      {
        user: {
          ...user,
          createdAt: user.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      log.warn("회원가입 중복 이메일", { email: parsed?.data?.email });
      return NextResponse.json({ error: "이미 사용할 수 없는 이메일입니다." }, { status: 409 });
    }

    log.error("회원가입 중 오류", { error: String(error) });
    throw error;
  }
}
