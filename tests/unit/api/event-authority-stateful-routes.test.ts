import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredEvent = {
  id: string;
  characterRunId: string;
  title: string;
  body: string;
  source: string;
  status: string;
  choices: unknown[];
  tags: string[];
};

const fixture = vi.hoisted(() => ({
  pointer: null as string | null,
  events: new Map<string, StoredEvent>(),
  createWaiters: [] as (() => void)[],
  generationBarrier: false,
  hiddenFlags: {} as Record<string, unknown>,
  generationCalls: 0,
  consumeWinnerOnCas: false,
}));

const routeEvent = vi.hoisted(() => ({
  title: "동시에 도착한 권위 이벤트",
  body: "두 요청이 동시에 생성해도 플레이어에게는 하나의 동일한 본문만 전달됩니다.",
  source: "STATIC",
  tags: ["관계"],
  choices: [
    { id: "talk", label: "대화한다", summary: "대화했다.", statDelta: { mental: 1 }, relationshipDelta: [], flagDelta: {} },
    { id: "wait", label: "기다린다", summary: "기다렸다.", statDelta: { health: 1 }, relationshipDelta: [], flagDelta: {} },
  ],
}));

function fullCharacter() {
  return {
    id: "run-1", userId: "user-1", name: "한서윤", age: 21, startGradeYear: 2,
    currentGradeYear: 2, major: "사회학과", academicStatus: "ENROLLED", lifeStatus: [],
    majorEventCount: 1, coreEventCount: 2, currentEventId: fixture.pointer,
    createdAt: new Date("2026-07-20T00:00:00Z"), updatedAt: new Date("2026-07-20T00:00:00Z"),
    stats: null,
    hiddenState: { burnoutRisk: 10, eventFlags: fixture.hiddenFlags, familyState: {} },
    relationships: [], specs: [], jobApplications: [], careerPaths: [], eventHistory: [], records: [],
    events: [...fixture.events.values()].filter((event) => event.status === "ACTIVE"),
  };
}

const prismaMock = vi.hoisted(() => ({
  characterRun: {
    findFirst: vi.fn(async (query: { select?: unknown }) => query.select
      ? { currentEventId: fixture.pointer }
      : fullCharacter()),
    updateMany: vi.fn(async ({ where, data }: { where: { currentEventId: null }; data: { currentEventId: string } }) => {
      if (fixture.consumeWinnerOnCas) {
        fixture.consumeWinnerOnCas = false;
        const winner: StoredEvent = {
          id: "winner-consumed", characterRunId: "run-1", title: "이미 소비된 승자", body: "소비됨",
          source: "AI", status: "RESOLVED", choices: routeEvent.choices, tags: routeEvent.tags,
        };
        fixture.events.set(winner.id, winner);
        fixture.hiddenFlags = { ...fixture.hiddenFlags, choiceCommittedAfterGeneration: true };
        fixture.pointer = null;
        return { count: 0 };
      }
      if (where.currentEventId === null && fixture.pointer === null) {
        fixture.pointer = data.currentEventId;
        return { count: 1 };
      }
      return { count: 0 };
    }),
  },
  event: {
    findFirst: vi.fn(async ({ where }: { where: { id: string; status: string } }) => {
      const event = fixture.events.get(where.id);
      return event?.status === where.status ? event : null;
    }),
    create: vi.fn(async ({ data }: { data: StoredEvent }) => {
      fixture.generationCalls += 1;
      const stored = { ...data, status: "DISCARDED" };
      fixture.events.set(stored.id, stored);
      if (fixture.generationBarrier) {
        await new Promise<void>((resolve) => {
          fixture.createWaiters.push(resolve);
          if (fixture.createWaiters.length === 2) {
            fixture.createWaiters.splice(0).forEach((release) => release());
          }
        });
      }
      return stored;
    }),
    updateMany: vi.fn(async ({ where, data }: { where: { id: string; status: string }; data: { status: string } }) => {
      const event = fixture.events.get(where.id);
      if (!event || event.status !== where.status) return { count: 0 };
      event.status = data.status;
      return { count: 1 };
    }),
  },
  hiddenState: {
    update: vi.fn(async ({ data }: { data: { eventFlags: Record<string, unknown> } }) => {
      fixture.hiddenFlags = data.eventFlags;
      return {};
    }),
  },
  eventHistory: { findMany: vi.fn(async () => []) },
  $transaction: vi.fn(async (operation: (tx: typeof prismaMock) => Promise<unknown>) => operation(prismaMock)),
}));

vi.mock("@/lib/server/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/server/session", () => ({ requireCurrentUserId: vi.fn(async () => "user-1") }));
vi.mock("@/lib/game/openrouter", () => ({
  checkDailyAiLimit: vi.fn(), generateAiEvent: vi.fn(), generateAiEventStream: vi.fn(), incrementAiUsage: vi.fn(),
}));
vi.mock("@/lib/game/event-engine", () => ({
  getStoryArc: vi.fn(() => ({ phase: "growth" })),
  isEventAllowedForLifeStage: vi.fn(() => true),
  selectNextEvent: vi.fn(() => ({ type: "static", event: routeEvent })),
}));
vi.mock("@/lib/game/life-stage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/game/life-stage")>();
  return {
    ...actual,
    deriveLifeStageState: vi.fn(() => ({
      lifeStage: "college_mid", academicPlan: "normal", graduation: "normal",
      destinationCandidates: [], term: { label: "2학년 1학기" },
    })),
  };
});

import { GET as getCharacter } from "@/app/api/characters/[id]/route";
import { POST as nextJson } from "@/app/api/characters/[id]/events/next/route";
import { POST as nextStream } from "@/app/api/characters/[id]/events/next/stream/route";

function eventFromSse(text: string) {
  const line = text.split("\n").find((entry) => entry.startsWith("data: {\"event\""));
  if (!line) throw new Error("SSE event payload was not emitted");
  return JSON.parse(line.slice(6)).event;
}

describe("stateful JSON/SSE event authority", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixture.pointer = null;
    fixture.events.clear();
    fixture.createWaiters = [];
    fixture.generationBarrier = false;
    fixture.hiddenFlags = {};
    fixture.generationCalls = 0;
    fixture.consumeWinnerOnCas = false;
  });

  it("overlaps fresh JSON and SSE generation and converges on one exact authoritative payload", async () => {
    fixture.generationBarrier = true;
    const jsonPromise = nextJson(new Request("http://localhost/api/characters/run-1/events/next", { method: "POST" }), {
      params: Promise.resolve({ id: "run-1" }),
    });
    const streamPromise = nextStream(new Request("http://localhost/api/characters/run-1/events/next/stream", { method: "POST" }), {
      params: Promise.resolve({ id: "run-1" }),
    }).then(async (response) => eventFromSse(await response.text()));

    const [jsonResponse, streamEvent] = await Promise.all([jsonPromise, streamPromise]);
    const jsonEvent = (await jsonResponse.json()).event;
    const active = [...fixture.events.values()].filter((event) => event.status === "ACTIVE");
    const losers = [...fixture.events.values()].filter((event) => event.id !== fixture.pointer);

    expect(jsonEvent).toEqual(streamEvent);
    expect(jsonEvent).toMatchObject({ id: fixture.pointer, body: routeEvent.body, choices: routeEvent.choices });
    expect(fixture.generationCalls).toBe(2);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(fixture.pointer);
    expect(losers).toHaveLength(1);
    expect(losers.every((event) => event.status !== "ACTIVE")).toBe(true);
  });

  it("recovers a committed stream event through GET and JSON when the client ignores the final SSE", async () => {
    const streamResponse = await nextStream(new Request("http://localhost/api/characters/run-1/events/next/stream", { method: "POST" }), {
      params: Promise.resolve({ id: "run-1" }),
    });
    expect(streamResponse.status).toBe(200);
    await streamResponse.text(); // transport completes; the simulated client ignores the final event payload
    const committedId = fixture.pointer;
    expect(committedId).toBeTruthy();
    fixture.events.set("orphan-newer", {
      id: "orphan-newer", characterRunId: "run-1", title: "더 최신인 고아 사건", body: "노출되면 안 됩니다.",
      source: "AI", status: "ACTIVE", choices: routeEvent.choices, tags: routeEvent.tags,
    });

    const getResponse = await getCharacter(new Request("http://localhost/api/characters/run-1"), {
      params: Promise.resolve({ id: "run-1" }),
    });
    const jsonResponse = await nextJson(new Request("http://localhost/api/characters/run-1/events/next", { method: "POST" }), {
      params: Promise.resolve({ id: "run-1" }),
    });
    const getPayload = await getResponse.json();
    const jsonPayload = await jsonResponse.json();

    expect(getPayload.currentEvent).toMatchObject({ id: committedId, body: routeEvent.body });
    expect(getPayload.currentEvent.id).not.toBe("orphan-newer");
    expect(jsonPayload.event).toMatchObject({ id: committedId, body: routeEvent.body, choices: routeEvent.choices });
    expect(fixture.generationCalls).toBe(1);
  });

  it.each(["JSON", "SSE"] as const)("returns exact no-active semantics after a failed CAS winner is consumed through %s", async (kind) => {
    fixture.consumeWinnerOnCas = true;
    if (kind === "JSON") {
      const response = await nextJson(new Request("http://localhost/api/characters/run-1/events/next", { method: "POST" }), {
        params: Promise.resolve({ id: "run-1" }),
      });
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: "진행 중인 이벤트가 없습니다." });
    } else {
      const response = await nextStream(new Request("http://localhost/api/characters/run-1/events/next/stream", { method: "POST" }), {
        params: Promise.resolve({ id: "run-1" }),
      });
      expect(await response.text()).toContain('event: error\ndata: {"error":"진행 중인 이벤트가 없습니다."}');
    }

    expect(fixture.pointer).toBeNull();
    expect(fixture.hiddenFlags.choiceCommittedAfterGeneration).toBe(true);
    expect(prismaMock.hiddenState.update).not.toHaveBeenCalled();
    const lateCandidate = [...fixture.events.values()].find((event) => event.title === routeEvent.title);
    expect(lateCandidate?.status).toBe("DISCARDED");
    expect([...fixture.events.values()].some((event) => event.status === "ACTIVE")).toBe(false);
  });
});
