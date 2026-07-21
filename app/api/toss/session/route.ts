import { createHash } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/server/prisma";
import { createTossSessionToken } from "@/lib/server/toss-session";

const requestSchema = z.object({
  hash: z.string().min(16).max(512).regex(/^[A-Za-z0-9_-]+$/),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "유효하지 않은 토스 사용자 식별키입니다." }, { status: 400 });
  }

  const tossAnonymousKey = parsed.data.hash;
  const keyDigest = createHash("sha256").update(tossAnonymousKey).digest("hex");
  const user = await prisma.user.upsert({
    where: { tossAnonymousKey },
    update: {},
    create: {
      email: `toss-${keyDigest}@toss-user.local`,
      passwordHash: "toss-anonymous-key",
      tossAnonymousKey,
    },
    select: { id: true },
  });

  return NextResponse.json({
    token: createTossSessionToken(user.id),
    expiresIn: 60 * 60 * 24 * 30,
  });
}
