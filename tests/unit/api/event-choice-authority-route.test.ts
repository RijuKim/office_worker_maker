import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentUserId: vi.fn(),
  characterFindFirst: vi.fn(),
  transaction: vi.fn(),
  eventUpdate: vi.fn(),
  historyCreate: vi.fn(),
  runUpdate: vi.fn(),
}));

vi.mock("@/lib/server/session", () => ({
  requireCurrentUserId: mocks.requireCurrentUserId,
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    characterRun: { findFirst: mocks.characterFindFirst, update: mocks.runUpdate },
    characterStats: { update: vi.fn(async () => ({})) },
    hiddenState: { update: vi.fn(async () => ({})) },
    event: { update: mocks.eventUpdate },
    eventHistory: { create: mocks.historyCreate },
    relationship: { updateMany: vi.fn(async () => ({ count: 0 })), create: vi.fn(async () => ({})) },
    careerEndingRecord: { create: vi.fn(async () => ({})), findFirst: vi.fn() },
    jobApplication: { update: vi.fn(async () => ({})), create: vi.fn(async () => ({})) },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/game/openrouter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/game/openrouter")>();
  return { ...actual, generateAiEnding: vi.fn() };
});

import { POST as choose } from "@/app/api/characters/[id]/choices/route";

function activeEvent(id: string, title: string) {
  return {
    id,
    title,
    body: `${title} 본문`,
    source: "AI",
    status: "ACTIVE",
    tags: ["관계"],
    choices: [{
      id: `${id}-choice`,
      label: "차분히 대응한다",
      summary: `${title}에서 차분히 대응했다.`,
      statDelta: { mental: 1 },
      relationshipDelta: [],
      flagDelta: { authoritativeChoice: true },
    }],
  };
}

function character(events: ReturnType<typeof activeEvent>[], currentEventId: string | null) {
  return {
    id: "run-1",
    userId: "user-1",
    name: "한서윤",
    age: 21,
    major: "사회학과",
    currentGradeYear: 2,
    academicStatus: "ENROLLED",
    coreEventCount: 2,
    majorEventCount: 1,
    currentEventId,
    stats: {
      academic: 50, practical: 50, communication: 50, creativity: 50,
      health: 70, mental: 70, network: 40, wealth: 30, reputation: 50, charm: 50,
    },
    hiddenState: { burnoutRisk: 10, eventFlags: {}, familyState: {} },
    relationships: [],
    events,
    eventHistory: [],
    jobApplications: [],
    specScore: 0,
  };
}

function request() {
  return new Request("http://localhost/api/characters/run-1/choices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ choiceIndex: 0 }),
  });
}

describe("choice event authority", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentUserId.mockResolvedValue("user-1");
    mocks.eventUpdate.mockResolvedValue({});
    mocks.historyCreate.mockResolvedValue({});
    mocks.runUpdate.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (operations: Promise<unknown>[]) => Promise.all(operations));
  });

  it("consumes exactly currentEventId, records its history, and ignores a newer orphan ACTIVE row", async () => {
    const authoritative = activeEvent("authoritative", "확정된 사건");
    const newerOrphan = activeEvent("orphan-newer", "고아 사건");
    mocks.characterFindFirst.mockResolvedValue(character([newerOrphan, authoritative], authoritative.id));

    const response = await choose(request(), { params: Promise.resolve({ id: "run-1" }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.result).toMatchObject({
      choiceId: "authoritative-choice",
      summary: "확정된 사건에서 차분히 대응했다.",
      eventResolved: true,
    });
    expect(mocks.eventUpdate).toHaveBeenCalledWith({
      where: { id: authoritative.id },
      data: { status: "RESOLVED" },
    });
    expect(mocks.historyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventId: authoritative.id, choiceId: "authoritative-choice" }),
    });
    expect(mocks.runUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "run-1" },
      data: expect.objectContaining({ currentEventId: null }),
    }));
    expect(JSON.stringify(mocks.eventUpdate.mock.calls)).not.toContain(newerOrphan.id);
  });

  it("returns the existing no-active response when only orphan ACTIVE rows exist", async () => {
    mocks.characterFindFirst.mockResolvedValue(character(
      [activeEvent("orphan-newer", "고아 사건")],
      "consumed-winner",
    ));

    const response = await choose(request(), { params: Promise.resolve({ id: "run-1" }) });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "진행 중인 이벤트가 없습니다." });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.eventUpdate).not.toHaveBeenCalled();
  });
});
