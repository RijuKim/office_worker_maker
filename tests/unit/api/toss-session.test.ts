import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/toss/session/route";
import { createTossSessionToken, verifyTossSessionToken } from "@/lib/server/toss-session";

const prismaMocks = vi.hoisted(() => ({
  upsert: vi.fn(async () => ({ id: "toss-user-123" })),
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: { user: { upsert: prismaMocks.upsert } },
}));

describe("toss session token", () => {
  const previousSecret = process.env.TOSS_SESSION_SECRET;

  beforeEach(() => {
    process.env.TOSS_SESSION_SECRET = "test-toss-session-secret";
  });

  afterEach(() => {
    if (previousSecret === undefined) delete process.env.TOSS_SESSION_SECRET;
    else process.env.TOSS_SESSION_SECRET = previousSecret;
  });

  it("round-trips a user id", () => {
    const token = createTossSessionToken("user-123");

    expect(verifyTossSessionToken(token)?.userId).toBe("user-123");
  });

  it("rejects a modified token", () => {
    const token = createTossSessionToken("user-123");
    const modified = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;

    expect(verifyTossSessionToken(modified)).toBeNull();
  });

  it("creates an authenticated Toss session for a valid anonymous key", async () => {
    const response = await POST(new Request("http://localhost/api/toss/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hash: "valid_toss_key_123456" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.expiresIn).toBe(60 * 60 * 24 * 30);
    expect(verifyTossSessionToken(body.token)).toMatchObject({ userId: "toss-user-123" });
    expect(prismaMocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { tossAnonymousKey: "valid_toss_key_123456" },
    }));
  });
});
