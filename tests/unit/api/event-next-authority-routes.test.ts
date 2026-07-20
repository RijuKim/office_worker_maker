import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentUserId: vi.fn(),
  characterFindFirst: vi.fn(),
  eventFindFirst: vi.fn(),
  generateAiEvent: vi.fn(),
  generateAiEventStream: vi.fn(),
  isEventAllowedForLifeStage: vi.fn(),
  runUpdateMany: vi.fn(),
  eventCreate: vi.fn(),
  eventUpdateMany: vi.fn(),
  hiddenStateUpdate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/server/session", () => ({
  requireCurrentUserId: mocks.requireCurrentUserId,
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    characterRun: {
      findFirst: mocks.characterFindFirst,
      updateMany: mocks.runUpdateMany,
    },
    event: {
      findFirst: mocks.eventFindFirst,
      create: mocks.eventCreate,
      updateMany: mocks.eventUpdateMany,
    },
    hiddenState: { update: mocks.hiddenStateUpdate },
    eventHistory: { findMany: vi.fn() },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/game/openrouter", () => ({
  checkDailyAiLimit: vi.fn(),
  generateAiEvent: mocks.generateAiEvent,
  generateAiEventStream: mocks.generateAiEventStream,
  incrementAiUsage: vi.fn(),
}));

vi.mock("@/lib/game/event-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/game/event-engine")>();
  return { ...actual, isEventAllowedForLifeStage: mocks.isEventAllowedForLifeStage };
});

import { POST as nextJson } from "@/app/api/characters/[id]/events/next/route";
import { POST as nextStream } from "@/app/api/characters/[id]/events/next/stream/route";

const choices = [
  { id: "accept", label: "제안을 받아들인다" },
  { id: "decline", label: "정중히 거절한다" },
];

const committed = {
  id: "event-committed",
  source: "AI",
  status: "ACTIVE",
  title: "이미 도착한 제안",
  body: "이 사건은 플레이어가 선택할 때까지 어떤 재검사에도 교체되지 않습니다.",
  choices,
  tags: ["진로"],
};

function arrangeCommittedCharacter(source: "AI" | "STATIC" | "FORCED" = "AI") {
  const selected = {
    ...committed,
    source,
    title: "자퇴 뒤 수강 신청",
    tags: ["수업", "학점"],
  };
  mocks.characterFindFirst
    .mockResolvedValueOnce({
      id: "run-1",
      academicStatus: "DROPPED_OUT",
      currentGradeYear: 4,
      coreEventCount: 40,
      hiddenState: { eventFlags: { lifeStage: { id: "dropout" } } },
    })
    .mockResolvedValueOnce({ currentEventId: selected.id });
  mocks.eventFindFirst.mockResolvedValueOnce(selected);
  return selected;
}

describe("next-event route committed recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentUserId.mockResolvedValue("user-1");
  });

  it.each([
    ["JSON", nextJson, "http://localhost/api/characters/run-1/events/next"],
    ["SSE", nextStream, "http://localhost/api/characters/run-1/events/next/stream"],
  ] as const)("rejects unauthenticated %s requests before persistence", async (_label, handler, url) => {
    mocks.requireCurrentUserId.mockResolvedValueOnce(null);

    const response = await handler(new Request(url, { method: "POST" }), {
      params: Promise.resolve({ id: "run-1" }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "로그인이 필요합니다." });
    expect(mocks.characterFindFirst).not.toHaveBeenCalled();
  });

  it.each([
    ["JSON", nextJson, "http://localhost/api/characters/run-1/events/next"],
    ["SSE", nextStream, "http://localhost/api/characters/run-1/events/next/stream"],
  ] as const)("does not expose a non-owned character through %s", async (label, handler, url) => {
    mocks.characterFindFirst.mockResolvedValueOnce(null);

    const response = await handler(new Request(url, { method: "POST" }), {
      params: Promise.resolve({ id: "other-user-run" }),
    });

    if (label === "JSON") {
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: "캐릭터를 찾을 수 없습니다." });
    } else {
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/event-stream");
      expect(await response.text()).toBe(
        'event: status\ndata: {"message":"선택의 시간이 다가오고 있습니다..."}\n\n' +
        'event: error\ndata: {"error":"캐릭터를 찾을 수 없습니다."}\n\n',
      );
    }
    expect(mocks.characterFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "other-user-run", userId: "user-1" },
    }));
  });

  it.each(["AI", "STATIC", "FORCED"] as const)("returns an ineligible pre-existing %s pointer event unchanged", async (source) => {
    const selected = arrangeCommittedCharacter(source);

    const response = await nextJson(new Request("http://localhost/api/characters/run-1/events/next", {
      method: "POST",
    }), { params: Promise.resolve({ id: "run-1" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      event: {
        id: selected.id,
        title: selected.title,
        body: selected.body,
        choices,
        source,
        forced: source === "FORCED",
      },
    });
    expect(mocks.generateAiEvent).not.toHaveBeenCalled();
    expect(mocks.isEventAllowedForLifeStage).not.toHaveBeenCalled();
  });

  it("lets SSE disconnect recovery resolve the same committed event without generation", async () => {
    const selected = arrangeCommittedCharacter();

    const response = await nextStream(new Request("http://localhost/api/characters/run-1/events/next/stream", {
      method: "POST",
    }), { params: Promise.resolve({ id: "run-1" }) });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(body).toContain(`event: event\ndata: ${JSON.stringify({
      event: {
        id: committed.id,
        title: selected.title,
        body: selected.body,
        choices,
        source: "AI",
        forced: false,
      },
    })}`);
    expect(mocks.generateAiEventStream).not.toHaveBeenCalled();
    expect(mocks.generateAiEvent).not.toHaveBeenCalled();
  });

  it.each(["AI", "STATIC", "FORCED"] as const)("streams an ineligible pre-existing %s pointer event unchanged", async (source) => {
    const selected = arrangeCommittedCharacter(source);

    const response = await nextStream(new Request("http://localhost/api/characters/run-1/events/next/stream", {
      method: "POST",
    }), { params: Promise.resolve({ id: "run-1" }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    await expect(response.text()).resolves.toBe(
      'event: status\ndata: {"message":"선택의 시간이 다가오고 있습니다..."}\n\n' +
      `event: event\ndata: ${JSON.stringify({
        event: {
          id: selected.id,
          title: selected.title,
          body: selected.body,
          choices,
          source,
          forced: source === "FORCED",
        },
      })}\n\n`,
    );
    expect(mocks.generateAiEventStream).not.toHaveBeenCalled();
    expect(mocks.generateAiEvent).not.toHaveBeenCalled();
    expect(mocks.eventCreate).not.toHaveBeenCalled();
    expect(mocks.eventUpdateMany).not.toHaveBeenCalled();
    expect(mocks.runUpdateMany).not.toHaveBeenCalled();
    expect(mocks.hiddenStateUpdate).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.isEventAllowedForLifeStage).not.toHaveBeenCalled();
  });
});
