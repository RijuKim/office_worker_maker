import { getServerSession } from "next-auth";
import { cookies, headers } from "next/headers";

import { authOptions } from "@/lib/server/auth-options";
import { prisma } from "@/lib/server/prisma";
import { verifyTossSessionToken } from "@/lib/server/toss-session";

export const GUEST_USER_COOKIE = "sano_guest_user_id";

export async function getCurrentUserId() {
  const requestHeaders = await headers();
  const authorization = requestHeaders.get("authorization");

  if (authorization?.startsWith("Bearer ")) {
    const tossSession = verifyTossSessionToken(authorization.slice("Bearer ".length));
    if (tossSession) return tossSession.userId;
  }

  const session = await getServerSession(authOptions);

  return session?.user?.id ?? null;
}

export async function requireCurrentUserId() {
  const userId = await getCurrentUserId();

  if (userId) {
    return userId;
  }

  return getOrCreateGuestUserId();
}

export async function getGuestUserId() {
  const cookieStore = await cookies();
  return cookieStore.get(GUEST_USER_COOKIE)?.value ?? null;
}

async function getOrCreateGuestUserId() {
  const cookieStore = await cookies();
  const existingId = cookieStore.get(GUEST_USER_COOKIE)?.value;

  if (existingId) {
    const existingUser = await prisma.user.findUnique({
      where: { id: existingId },
      select: { id: true },
    });
    if (existingUser) return existingUser.id;
  }

  const id = crypto.randomUUID();
  const user = await prisma.user.create({
    data: {
      id,
      email: `guest-${id}@guest.local`,
      passwordHash: "guest",
    },
    select: { id: true },
  });

  cookieStore.set(GUEST_USER_COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return user.id;
}
