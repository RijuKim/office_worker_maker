import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_PREFIX = "toss_session";
const TOKEN_LIFETIME_SECONDS = 60 * 60 * 24 * 30;

type TossSessionPayload = {
  userId: string;
  expiresAt: number;
};

function sessionSecret() {
  const secret = process.env.TOSS_SESSION_SECRET || process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error("TOSS_SESSION_SECRET or NEXTAUTH_SECRET is required");
  }

  return secret;
}

function sign(encodedPayload: string) {
  return createHmac("sha256", sessionSecret()).update(encodedPayload).digest("base64url");
}

export function createTossSessionToken(userId: string) {
  const payload: TossSessionPayload = {
    userId,
    expiresAt: Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");

  return `${TOKEN_PREFIX}.${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyTossSessionToken(token: string) {
  const [prefix, encodedPayload, signature, extra] = token.split(".");
  if (prefix !== TOKEN_PREFIX || !encodedPayload || !signature || extra) return null;

  const expectedSignature = Buffer.from(sign(encodedPayload));
  const receivedSignature = Buffer.from(signature);
  if (
    expectedSignature.length !== receivedSignature.length
    || !timingSafeEqual(expectedSignature, receivedSignature)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as TossSessionPayload;
    if (!payload.userId || !Number.isInteger(payload.expiresAt)) return null;
    if (payload.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
