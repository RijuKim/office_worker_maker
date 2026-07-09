import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  aiUsage: {
    findUnique: vi.fn(),
  },
  characterRun: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const sessionMock = vi.hoisted(() => ({
  requireCurrentUserId: vi.fn(),
  getGuestUserId: vi.fn(),
  GUEST_USER_COOKIE: "sano_guest_user_id",
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/server/session", () => sessionMock);

import { GET as getCharacter } from "@/app/api/characters/[id]/route";
import { GET as listCharacters, POST as createCharacter } from "@/app/api/characters/route";
import { POST as signup } from "@/app/api/auth/signup/route";
import { GET as getMe } from "@/app/api/me/route";
import { buildCharacterProfile, buildInitialHiddenState, buildInitialStats, pickRandomGradeYear, randomMajors } from "@/lib/game/character-foundation";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function characterRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "char-1",
    userId: "user-1",
    name: "한서윤",
    age: 21,
    startGradeYear: 2,
    currentGradeYear: 2,
    major: "사회학과",
    academicStatus: "ENROLLED",
    lifeStatus: [],
    majorEventCount: 0,
    coreEventCount: 0,
    currentEventId: "event-1",
    createdAt: new Date("2026-07-06T00:00:00.000Z"),
    updatedAt: new Date("2026-07-06T00:00:00.000Z"),
    stats: {
      academic: 52,
      practical: 42,
      communication: 50,
      creativity: 48,
      health: 64,
      mental: 58,
      network: 36,
      wealth: 30,
      reputation: 45,
      charm: 46,
    },
    hiddenState: { majorFit: 55, burnoutRisk: 18 },
    relationships: [],
    events: [{ id: "event-1", title: "봄 학기 첫 갈림길", choices: [] }],
    eventHistory: [],
    records: [],
    ...overrides,
  };
}

describe("account and character API foundation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionMock.getGuestUserId.mockResolvedValue(null);
  });

  it("picks starting grade independently from selected age", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValueOnce(0.01).mockReturnValueOnce(0.01);

    expect(pickRandomGradeYear(18)).toBe(1);
    expect(pickRandomGradeYear(35)).toBe(1);

    spy.mockRestore();
  });

  it("offers broad random majors across career-relevant fields", () => {
    expect(randomMajors.length).toBeGreaterThanOrEqual(90);
    expect(randomMajors).toEqual(expect.arrayContaining([
      "경영학과",
      "회계학과",
      "금융학과",
      "법학과",
      "영어영문학과",
      "통번역학과",
      "의학과",
      "약학과",
      "간호학과",
      "시각디자인학과",
      "음악학과",
      "연극영화학과",
      "컴퓨터공학과",
      "인공지능학과",
      "경찰행정학과",
    ]));
  });

  it("uses age and chosen grade as character profile, not grade selection logic", () => {
    const profile = buildCharacterProfile({ age: 26, startGradeYear: 1 });
    const hiddenState = buildInitialHiddenState({
      age: 26,
      startGradeYear: 1,
      major: "사회학과",
      residence: "studio",
      preferredStats: ["academic", "mental"],
    });
    const stats = buildInitialStats(["academic", "mental"], { age: 26, startGradeYear: 1 });

    expect(profile).toMatchObject({
      ageBand: "older",
      gradeBand: "early",
      background: "비정형 학적 리듬",
    });
    expect(hiddenState.eventFlags).toEqual(expect.objectContaining({ characterProfile: profile }));
    expect(stats.practical).toBeGreaterThanOrEqual(1);
    expect(stats.practical).toBeLessThanOrEqual(10);
  });

  it("signup creates a lowercase account with a hashed password, not the submitted password", async () => {
    prismaMock.user.create.mockImplementationOnce(async ({ data, select }) => ({
      id: "user-1",
      email: data.email,
      passwordHash: select.passwordHash ? data.passwordHash : undefined,
      createdAt: new Date("2026-07-06T00:00:00.000Z"),
    }));

    const response = await signup(jsonRequest({ email: "Player@Example.COM", password: "Password123!" }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.user.email).toBe("player@example.com");
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "player@example.com",
          passwordHash: expect.stringMatching(/^scrypt\$/),
        }),
      }),
    );
    expect(prismaMock.user.create.mock.calls[0][0].data.passwordHash).not.toBe("Password123!");
  });

  it("rejects unauthenticated character creation before touching the database", async () => {
    sessionMock.requireCurrentUserId.mockResolvedValueOnce(null);

    const response = await createCharacter(
      jsonRequest({ name: "한서윤", age: 21, residence: "studio", preferredStats: ["academic", "mental"], startGradeYear: 2, major: "사회학과" }),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toMatch(/로그인/);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("requires a user-entered character name instead of assigning one", async () => {
    sessionMock.requireCurrentUserId.mockResolvedValueOnce("user-1");

    const response = await createCharacter(jsonRequest({ age: 21, startGradeYear: 2, major: "사회학과" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.issues.name?.[0]).toMatch(/이름/);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("creates a character with initialized stats, hidden state, and first event before relationships form", async () => {
    sessionMock.requireCurrentUserId.mockResolvedValueOnce("user-1");
    const created = characterRecord();

    prismaMock.$transaction.mockImplementationOnce(async (callback) =>
      callback({
        characterRun: {
          create: vi.fn(async ({ data }) => {
            expect(data).toEqual(
              expect.objectContaining({
                userId: "user-1",
                name: "한서윤",
                age: 21,
                startGradeYear: 2,
                currentGradeYear: 2,
                major: "사회학과",
                stats: { create: expect.objectContaining({ academic: expect.any(Number), charm: expect.any(Number) }) },
                hiddenState: {
                  create: expect.objectContaining({
                    burnoutRisk: 2,
                    eventFlags: expect.objectContaining({
                      characterProfile: expect.objectContaining({ ageBand: "standard", gradeBand: "middle" }),
                      lifeStage: { id: "college_mid" },
                      academicTerm: expect.objectContaining({ gradeYear: 2, semester: 1, label: "2학년 1학기" }),
                      graduation: { state: "normal" },
                    }),
                  }),
                },
              }),
            );
            expect(data.relationships).toBeUndefined();
            return { id: "char-1" };
          }),
          update: vi.fn(async ({ data }) => {
            expect(data).toEqual({ currentEventId: "event-1" });
            return created;
          }),
        },
        event: {
          create: vi.fn(async ({ data }) => {
            expect(data).toEqual(
              expect.objectContaining({
                characterRunId: "char-1",
                source: "STATIC",
                status: "ACTIVE",
                safetyChecked: true,
                choices: expect.arrayContaining([expect.objectContaining({ id: "ask_senior_internship" })]),
              }),
            );
            return { id: "event-1" };
          }),
        },
      }),
    );

    const response = await createCharacter(
      jsonRequest({ name: "한서윤", age: 21, residence: "studio", preferredStats: ["academic", "mental"], startGradeYear: 2, major: "사회학과" }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.character.name).toBe("한서윤");
    expect(body.character.major).toBe("사회학과");
    expect(body.character.currentEventId).toBe("event-1");
  });

  it("lists only the authenticated user's characters", async () => {
    sessionMock.requireCurrentUserId.mockResolvedValueOnce("user-1");
    prismaMock.characterRun.findMany.mockResolvedValueOnce([characterRecord()]);

    const response = await listCharacters();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prismaMock.characterRun.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-1" } }));
    expect(body.characters).toHaveLength(1);
    expect(body.characters[0].name).toBe("한서윤");
    expect(body.characters[0].progressLabel).toBe("2학년 1학기");
    expect(body.characters[0].lifeStage.lifeStage).toBe("college_mid");
  });

  it("fetches a character through an owner-scoped lookup", async () => {
    sessionMock.requireCurrentUserId.mockResolvedValueOnce("user-1");
    prismaMock.characterRun.findFirst.mockResolvedValueOnce(characterRecord());

    const response = await getCharacter(new Request("http://localhost/api/characters/char-1"), {
      params: Promise.resolve({ id: "char-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prismaMock.characterRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "char-1", userId: "user-1" },
      }),
    );
    expect(body.currentEvent.title).toBe("봄 학기 첫 갈림길");
  });

  it("returns the current profile with daily AI usage summary", async () => {
    sessionMock.requireCurrentUserId.mockResolvedValueOnce("user-1");
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      email: "player@example.com",
      createdAt: new Date("2026-07-06T00:00:00.000Z"),
    });
    prismaMock.aiUsage.findUnique.mockResolvedValueOnce({ date: "2026-07-06", count: 7 });

    const response = await getMe();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.user.email).toBe("player@example.com");
    expect(body.aiUsage).toEqual({ date: "2026-07-06", count: 7, limit: null, remaining: null });
  });
});
