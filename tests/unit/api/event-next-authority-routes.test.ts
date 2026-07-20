import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  characterFindFirst: vi.fn(),
  eventFindFirst: vi.fn(),
  generateAiEvent: vi.fn(),
  generateAiEventStream: vi.fn(),
}));

vi.mock("@/lib/server/session", () => ({
  requireCurrentUserId: vi.fn(async () => "user-1"),
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    characterRun: {
      findFirst: mocks.characterFindFirst,
      updateMany: vi.fn(),
    },
    event: {
      findFirst: mocks.eventFindFirst,
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    hiddenState: { update: vi.fn() },
    eventHistory: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/game/openrouter", () => ({
  checkDailyAiLimit: vi.fn(),
  generateAiEvent: mocks.generateAiEvent,
  generateAiEventStream: mocks.generateAiEventStream,
  incrementAiUsage: vi.fn(),
}));

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
  const selected = { ...committed, source };
  mocks.characterFindFirst
    .mockResolvedValueOnce({ id: "run-1", hiddenState: { eventFlags: {} } })
    .mockResolvedValueOnce({ currentEventId: selected.id });
  mocks.eventFindFirst.mockResolvedValueOnce(selected);
  return selected;
}

describe("next-event route committed recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it("lets SSE disconnect recovery resolve the same committed event without generation", async () => {
    arrangeCommittedCharacter();

    const response = await nextStream(new Request("http://localhost/api/characters/run-1/events/next/stream", {
      method: "POST",
    }), { params: Promise.resolve({ id: "run-1" }) });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(body).toContain(`event: event\ndata: ${JSON.stringify({
      event: {
        id: committed.id,
        title: committed.title,
        body: committed.body,
        choices,
        source: "AI",
        forced: false,
      },
    })}`);
    expect(mocks.generateAiEventStream).not.toHaveBeenCalled();
    expect(mocks.generateAiEvent).not.toHaveBeenCalled();
  });
});
