import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const ALLOWED_EVENT_STAT_KEYS = new Set([
  "academic", "practical", "health", "mental", "wealth", "reputation", "charm",
]);

function expectPlainObject(value: unknown): asserts value is Record<string, unknown> {
  expect(value).not.toBeNull();
  expect(typeof value).toBe("object");
  expect(Array.isArray(value)).toBe(false);
  expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
}

function expectJsonValue(value: unknown): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    expect(Number.isFinite(value)).toBe(true);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(expectJsonValue);
    return;
  }
  expectPlainObject(value);
  Object.values(value).forEach(expectJsonValue);
}

function expectValidFallbackEvent(event: StoredEvent): void {
  expect(event.title.trim().length).toBeGreaterThan(0);
  expect(event.body.trim().length).toBeGreaterThan(0);
  expect(event.tags.length).toBeGreaterThan(0);
  event.tags.forEach((tag) => {
    expect(typeof tag).toBe("string");
    expect(tag.trim().length).toBeGreaterThan(0);
  });
  expect(event.choices.length).toBeGreaterThanOrEqual(2);
  expect(event.choices.length).toBeLessThanOrEqual(4);

  for (const rawChoice of event.choices) {
    expectPlainObject(rawChoice);
    for (const field of ["id", "label", "summary"] as const) {
      expect(typeof rawChoice[field]).toBe("string");
      expect((rawChoice[field] as string).trim().length).toBeGreaterThan(0);
    }

    expectPlainObject(rawChoice.statDelta);
    for (const [key, value] of Object.entries(rawChoice.statDelta)) {
      expect(ALLOWED_EVENT_STAT_KEYS.has(key)).toBe(true);
      expect(Number.isInteger(value)).toBe(true);
      const minimum = key === "health" ? -1 : -15;
      expect(value).toBeGreaterThanOrEqual(minimum);
      expect(value).toBeLessThanOrEqual(15);
    }

    expectPlainObject(rawChoice.flagDelta);
    Object.values(rawChoice.flagDelta).forEach(expectJsonValue);
  }
}

const fixture = vi.hoisted(() => ({
  pointer: null as string | null,
  generationToken: null as string | null,
  generationStartedAt: null as Date | null,
  events: new Map<string, StoredEvent>(),
  createWaiters: [] as (() => void)[],
  generationBarrier: false,
  hiddenFlags: {} as Record<string, unknown>,
  generationCalls: 0,
  consumeWinnerOnCas: false,
  aiEnabled: false,
  commitDelayMs: 0,
  characterName: "한서윤",
  age: 21,
  residence: "studio",
  disappearBeforeLease: false,
  characterLookupBarrier: null as Promise<void> | null,
  leaseAcquisitionBarrier: null as Promise<void> | null,
  injectedFailure: null as "candidate_create" | "usage_update" | "transaction_commit" | "ownership_loss" | "provider_reject" | null,
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
    id: "run-1", userId: "user-1", name: fixture.characterName, age: fixture.age, startGradeYear: 2,
    currentGradeYear: 2, major: "사회학과", academicStatus: "ENROLLED", lifeStatus: [],
    majorEventCount: 1, coreEventCount: 2, currentEventId: fixture.pointer,
    createdAt: new Date("2026-07-20T00:00:00Z"), updatedAt: new Date("2026-07-20T00:00:00Z"),
    stats: fixture.aiEnabled ? {
      academic: 50, practical: 50, communication: 50, creativity: 50, health: 8,
      mental: 50, network: 50, wealth: 50, reputation: 50, charm: 50,
    } : null,
    hiddenState: { burnoutRisk: 10, eventFlags: fixture.hiddenFlags, familyState: { residence: fixture.residence } },
    relationships: [], specs: [], jobApplications: [], careerPaths: [], eventHistory: [], records: [],
    events: [...fixture.events.values()].filter((event) => event.status === "ACTIVE"),
  };
}

const prismaMock = vi.hoisted(() => ({
  characterRun: {
    findFirst: vi.fn(async (query: { select?: unknown }) => {
      if (!query.select && fixture.characterLookupBarrier) await fixture.characterLookupBarrier;
      return query.select
        ? (fixture.disappearBeforeLease ? null : { currentEventId: fixture.pointer, eventGenerationToken: fixture.generationToken, eventGenerationStartedAt: fixture.generationStartedAt })
        : fullCharacter();
    }),
    updateMany: vi.fn(async ({ where, data }: { where: { currentEventId?: null; eventGenerationToken?: string; OR?: Array<{ eventGenerationStartedAt?: { lt: Date } }> }; data: { currentEventId?: string; eventGenerationToken?: string | null; eventGenerationStartedAt?: Date | null } }) => {
      if (where.eventGenerationToken && where.eventGenerationToken !== fixture.generationToken) return { count: 0 };
      if (data.currentEventId === undefined) {
        if (fixture.disappearBeforeLease) return { count: 0 };
        if (data.eventGenerationStartedAt instanceof Date && data.eventGenerationToken === undefined) {
          if (fixture.pointer !== null || fixture.generationToken === null) return { count: 0 };
          fixture.generationStartedAt = data.eventGenerationStartedAt;
          return { count: 1 };
        }
        if (data.eventGenerationToken === null) {
          fixture.generationToken = null;
          fixture.generationStartedAt = null;
        } else if (fixture.pointer === null && (
          fixture.generationToken === null ||
          where.OR?.some((condition) => condition.eventGenerationStartedAt?.lt &&
            fixture.generationStartedAt !== null && fixture.generationStartedAt < condition.eventGenerationStartedAt.lt)
        )) {
          fixture.generationToken = data.eventGenerationToken ?? null;
          fixture.generationStartedAt = data.eventGenerationStartedAt ?? null;
          if (fixture.leaseAcquisitionBarrier) await fixture.leaseAcquisitionBarrier;
        } else return { count: 0 };
        return { count: 1 };
      }
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
        fixture.generationToken = null;
        fixture.generationStartedAt = null;
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
      if (fixture.injectedFailure === "candidate_create") throw new Error("injected candidate create failure");
      if (fixture.commitDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, fixture.commitDelayMs));
      }
      fixture.generationCalls += 1;
      const candidateNumber = fixture.generationCalls;
      const stored = {
        ...data,
        title: `${data.title} 후보 ${candidateNumber}`,
        body: `${data.body} 후보 본문 ${candidateNumber}`,
        tags: [...data.tags, `후보-${candidateNumber}`],
        choices: data.choices.map((choice, index) => ({
          ...(choice as Record<string, unknown>),
          id: `candidate-${candidateNumber}-choice-${index + 1}`,
          summary: `후보 ${candidateNumber}의 선택 ${index + 1}`,
        })),
        status: "DISCARDED",
      };
      fixture.events.set(stored.id, stored);
      if (fixture.injectedFailure === "ownership_loss") {
        fixture.generationToken = "replacement-owner";
        fixture.generationStartedAt = new Date();
      }
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
      if (fixture.injectedFailure === "transaction_commit") throw new Error("injected transactional hidden-state failure");
      fixture.hiddenFlags = data.eventFlags;
      return {};
    }),
  },
  eventHistory: { findMany: vi.fn(async () => []) },
  $transaction: vi.fn(async (operation: (tx: typeof prismaMock) => Promise<unknown>) => {
    const snapshot = {
      pointer: fixture.pointer,
      generationToken: fixture.generationToken,
      generationStartedAt: fixture.generationStartedAt,
      hiddenFlags: fixture.hiddenFlags,
      events: new Map([...fixture.events].map(([id, event]) => [id, { ...event }])),
    };
    try {
      return await operation(prismaMock);
    } catch (error) {
      fixture.pointer = snapshot.pointer;
      fixture.generationToken = snapshot.generationToken;
      fixture.generationStartedAt = snapshot.generationStartedAt;
      fixture.hiddenFlags = snapshot.hiddenFlags;
      fixture.events = snapshot.events;
      throw error;
    }
  }),
}));

const aiMocks = vi.hoisted(() => ({
  checkDailyAiLimit: vi.fn(), generateAiEvent: vi.fn(), generateAiEventStream: vi.fn(), incrementAiUsage: vi.fn(),
  getOpenRouterTimeoutMs: vi.fn(() => 60_000),
}));
const engineMocks = vi.hoisted(() => ({ selectNextEvent: vi.fn() }));

vi.mock("@/lib/server/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/server/session", () => ({ requireCurrentUserId: vi.fn(async () => "user-1") }));
vi.mock("@/lib/game/openrouter", () => ({
  ...aiMocks,
}));
vi.mock("@/lib/game/event-engine", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/game/event-engine")>(),
  getStoryArc: vi.fn(() => ({ phase: "growth" })),
  isEventAllowedForLifeStage: vi.fn(() => true),
  selectNextEvent: engineMocks.selectNextEvent,
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
import { createNextEventStreamPost } from "@/app/api/characters/[id]/events/next/stream/handler";

function eventFromSse(text: string) {
  const line = text.split("\n").find((entry) => entry.startsWith("data: {\"event\""));
  if (!line) throw new Error("SSE event payload was not emitted");
  return JSON.parse(line.slice(6)).event;
}

function serializeForLeakCheck(value: unknown) {
  const seen = new WeakSet<object>();

  function normalize(current: unknown): unknown {
    if (typeof current === "bigint") return `${current}n`;
    if (typeof current === "symbol" || typeof current === "function") return String(current);
    if (current === null || typeof current !== "object") return current;
    if (seen.has(current)) return "[Circular]";
    seen.add(current);

    if (current instanceof Error) {
      const serialized: Record<string, unknown> = {
        name: current.name,
        message: current.message,
        stack: current.stack ?? null,
        cause: current.cause === undefined ? null : normalize(current.cause),
      };
      for (const key of Object.keys(current)) {
        if (key in serialized) continue;
        try {
          serialized[key] = normalize((current as unknown as Record<string, unknown>)[key]);
        } catch (error) {
          serialized[key] = `[Unreadable: ${error instanceof Error ? error.message : String(error)}]`;
        }
      }
      return serialized;
    }

    if (Array.isArray(current)) return current.map(normalize);

    const serialized: Record<string, unknown> = {};
    for (const key of Object.keys(current)) {
      try {
        serialized[key] = normalize((current as Record<string, unknown>)[key]);
      } catch (error) {
        serialized[key] = `[Unreadable: ${error instanceof Error ? error.message : String(error)}]`;
      }
    }
    return serialized;
  }

  return JSON.stringify(normalize(value));
}

function spyOnSerializedLoggerOutput() {
  const spies = [
    vi.spyOn(console, "info").mockImplementation(() => {}),
    vi.spyOn(console, "warn").mockImplementation(() => {}),
    vi.spyOn(console, "error").mockImplementation(() => {}),
  ];
  return {
    serialized: () => serializeForLeakCheck(spies.flatMap((spy) => spy.mock.calls)),
  };
}

describe("stateful JSON/SSE event authority", () => {
  afterEach(() => {
    delete process.env.OLLAMA_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_TIMEOUT_MS;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    fixture.pointer = null;
    fixture.generationToken = null;
    fixture.generationStartedAt = null;
    fixture.events.clear();
    fixture.createWaiters = [];
    fixture.generationBarrier = false;
    fixture.hiddenFlags = {};
    fixture.generationCalls = 0;
    fixture.consumeWinnerOnCas = false;
    fixture.aiEnabled = false;
    fixture.commitDelayMs = 0;
    fixture.characterName = "한서윤";
    fixture.age = 21;
    fixture.residence = "studio";
    fixture.disappearBeforeLease = false;
    fixture.characterLookupBarrier = null;
    fixture.leaseAcquisitionBarrier = null;
    fixture.injectedFailure = null;
    aiMocks.checkDailyAiLimit.mockResolvedValue({ allowed: true });
    engineMocks.selectNextEvent.mockReturnValue({ type: "static", event: routeEvent });
  });

  it.each([
    { kind: "JSON", age: 18, residence: "family_home" }, { kind: "JSON", age: 40, residence: "studio" }, { kind: "JSON", age: 80, residence: "dorm" },
    { kind: "SSE", age: 18, residence: "family_home" }, { kind: "SSE", age: 40, residence: "studio" }, { kind: "SSE", age: 80, residence: "dorm" },
  ] as const)("returns $kind event content derived from age $age and $residence", async ({ kind, age, residence }) => {
    fixture.age = age;
    fixture.residence = residence;
    fixture.aiEnabled = true;
    const generated = (state: { age: number; residence: string }) => ({
      success: true as const, event: {
        ...routeEvent,
        title: `${state.age}세 ${state.residence}의 아침`,
        body: `${state.age}세 주인공이 ${state.residence}에서 받은 사건입니다.`,
      },
      providerId: "ollama",
      providerElapsedMs: 5,
      totalElapsedMs: 5,
      slow: false,
      providerFailures: [],
    });
    aiMocks.generateAiEvent.mockImplementation(async (state) => generated(state));
    aiMocks.generateAiEventStream.mockImplementation(async (state) => generated(state));

    const response = kind === "JSON"
      ? await nextJson(new Request("http://localhost/api/characters/run-1/events/next", { method: "POST" }), { params: Promise.resolve({ id: "run-1" }) })
      : await nextStream(new Request("http://localhost/api/characters/run-1/events/next/stream", { method: "POST" }), { params: Promise.resolve({ id: "run-1" }) });
    const text = await response.text();
    const event = kind === "JSON" ? JSON.parse(text).event : eventFromSse(text);
    expect(event.title).toContain(`${age}세 ${residence}`);
    expect(event.body).toContain(`${age}세 주인공이 ${residence}`);
  });

  it("cancels while provider generation is held, stops the owned lease, and fences the late candidate", async () => {
    fixture.aiEnabled = true;
    let finishProvider!: (value: unknown) => void;
    const heldProvider = new Promise((resolve) => { finishProvider = resolve; });
    aiMocks.generateAiEventStream.mockReturnValue(heldProvider);

    const response = await nextStream(
      new Request("http://localhost/api/characters/run-1/events/next/stream", { method: "POST" }),
      { params: Promise.resolve({ id: "run-1" }) },
    );
    const reader = response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain("event: status");
    await vi.waitFor(() => expect(aiMocks.generateAiEventStream).toHaveBeenCalledOnce());
    const ownedToken = fixture.generationToken;
    expect(ownedToken).toEqual(expect.any(String));

    await reader.cancel("client disconnected");

    expect(fixture.generationToken).toBeNull();
    expect(fixture.generationStartedAt).toBeNull();
    finishProvider({
      success: true, event: routeEvent, providerId: "ollama", providerElapsedMs: 100,
      totalElapsedMs: 100, slow: false, retryUsed: false, providerFailures: [],
    });
    await vi.waitFor(() => expect(aiMocks.incrementAiUsage).not.toHaveBeenCalled());
    expect(prismaMock.event.create).not.toHaveBeenCalled();

    expect(fixture.pointer).toBeNull();
    expect(fixture.generationToken).not.toBe(ownedToken);
    expect([...fixture.events.values()].filter((event) => event.status === "ACTIVE")).toHaveLength(0);
  });

  it("cancels before lease acquisition and fences every later SSE side effect", async () => {
    fixture.aiEnabled = true;
    let releaseLookup!: () => void;
    fixture.characterLookupBarrier = new Promise<void>((resolve) => { releaseLookup = resolve; });
    aiMocks.generateAiEventStream.mockResolvedValue({
      success: true, event: routeEvent, providerId: "ollama", providerElapsedMs: 1,
      totalElapsedMs: 1, slow: false, retryUsed: false, providerFailures: [],
    });

    const response = await nextStream(
      new Request("http://localhost/api/characters/run-1/events/next/stream", { method: "POST" }),
      { params: Promise.resolve({ id: "run-1" }) },
    );
    const reader = response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain("event: status");

    const closed = reader.closed;
    await reader.cancel("disconnect before character lookup finishes");
    releaseLookup();
    await expect(closed).resolves.toBeUndefined();
    await vi.waitFor(() => expect(prismaMock.characterRun.findFirst).toHaveBeenCalledOnce());

    expect(aiMocks.generateAiEventStream).not.toHaveBeenCalled();
    expect(aiMocks.incrementAiUsage).not.toHaveBeenCalled();
    expect(prismaMock.event.create).not.toHaveBeenCalled();
    expect(prismaMock.hiddenState.update).not.toHaveBeenCalled();
    expect(fixture.pointer).toBeNull();
    expect(fixture.generationToken).toBeNull();
    expect([...fixture.events.values()].filter((event) => event.status === "ACTIVE")).toHaveLength(0);
  });

  it("does not release a replacement owner when cancellation lands inside role resolution", async () => {
    fixture.aiEnabled = true;
    let releaseLeaseResolution!: () => void;
    fixture.leaseAcquisitionBarrier = new Promise<void>((resolve) => { releaseLeaseResolution = resolve; });
    aiMocks.generateAiEventStream.mockResolvedValue({
      success: true, event: routeEvent, providerId: "ollama", providerElapsedMs: 1,
      totalElapsedMs: 1, slow: false, retryUsed: false, providerFailures: [],
    });

    const response = await nextStream(
      new Request("http://localhost/api/characters/run-1/events/next/stream", { method: "POST" }),
      { params: Promise.resolve({ id: "run-1" }) },
    );
    const reader = response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain("event: status");
    await vi.waitFor(() => expect(fixture.generationToken).toEqual(expect.any(String)));
    const ownedToken = fixture.generationToken;

    const closed = reader.closed;
    await reader.cancel("disconnect while generation role is resolving");
    expect(fixture.generationToken).toBe(ownedToken);
    const replacementStartedAt = new Date("2026-07-21T03:04:05.678Z");
    fixture.generationToken = "replacement-owner-during-role-resolution";
    fixture.generationStartedAt = replacementStartedAt;
    releaseLeaseResolution();
    await expect(closed).resolves.toBeUndefined();
    await vi.waitFor(() => expect(fixture.generationToken).toBe("replacement-owner-during-role-resolution"));

    expect(aiMocks.generateAiEventStream).not.toHaveBeenCalled();
    expect(aiMocks.incrementAiUsage).not.toHaveBeenCalled();
    expect(prismaMock.event.create).not.toHaveBeenCalled();
    expect(prismaMock.hiddenState.update).not.toHaveBeenCalled();
    expect(fixture.pointer).toBeNull();
    expect(fixture.generationStartedAt).toBe(replacementStartedAt);
    expect([...fixture.events.values()].filter((event) => event.status === "ACTIVE")).toHaveLength(0);
    expect(prismaMock.characterRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ eventGenerationToken: ownedToken }),
      data: { eventGenerationToken: null, eventGenerationStartedAt: null },
    }));
  });

  it.each([
    { kind: "JSON", failure: "candidate_create" },
    { kind: "SSE", failure: "candidate_create" },
    { kind: "JSON", failure: "provider_reject" },
    { kind: "SSE", failure: "provider_reject" },
    { kind: "JSON", failure: "usage_update" },
    { kind: "SSE", failure: "usage_update" },
    { kind: "JSON", failure: "transaction_commit" },
    { kind: "SSE", failure: "transaction_commit" },
    { kind: "JSON", failure: "ownership_loss" },
    { kind: "SSE", failure: "ownership_loss" },
  ] as const)("fences $kind route state after injected $failure failure", async ({ kind, failure }) => {
    fixture.injectedFailure = failure;
    if (failure === "provider_reject") vi.useFakeTimers();
    if (failure === "usage_update" || failure === "provider_reject") {
      fixture.aiEnabled = true;
      const result = {
        success: true as const, event: routeEvent, providerId: "ollama",
        providerElapsedMs: 2, totalElapsedMs: 2, slow: false, retryUsed: false, providerFailures: [],
      };
      aiMocks.generateAiEvent.mockResolvedValue(result);
      aiMocks.generateAiEventStream.mockResolvedValue(result);
      if (failure === "usage_update") {
        aiMocks.incrementAiUsage.mockRejectedValue(new Error("injected AI usage failure"));
      } else {
        aiMocks.generateAiEvent.mockRejectedValue(new Error("injected provider rejection"));
        aiMocks.generateAiEventStream.mockRejectedValue(new Error("injected provider rejection"));
      }
    }
    vi.spyOn(console, "error").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    const response = kind === "JSON"
      ? await nextJson(new Request("http://localhost/api/characters/run-1/events/next", { method: "POST" }), { params: Promise.resolve({ id: "run-1" }) })
      : await nextStream(new Request("http://localhost/api/characters/run-1/events/next/stream", { method: "POST" }), { params: Promise.resolve({ id: "run-1" }) });
    if (kind === "SSE" && failure === "provider_reject") await vi.advanceTimersByTimeAsync(100);
    const text = await response.text();
    const ownershipLost = failure === "ownership_loss";
    const providerRejected = failure === "provider_reject";

    if (providerRejected) {
      const event = kind === "JSON" ? JSON.parse(text).event : eventFromSse(text);
      const active = [...fixture.events.values()].filter((item) => item.status === "ACTIVE");
      const persisted = active[0];
      const expectedPublicEvent = {
        id: persisted.id,
        title: persisted.title,
        body: persisted.body,
        choices: persisted.choices,
        source: persisted.source,
        forced: false,
      };
      expect(response.status).toBe(200);
      expect(active).toHaveLength(1);
      expect(persisted).toMatchObject({ id: fixture.pointer, source: "FALLBACK", status: "ACTIVE" });
      expectValidFallbackEvent(persisted);
      expect(event).toEqual(expectedPublicEvent);
      expect(text).not.toContain("event: error");
      expect(text).not.toContain("다음 사건을 생성하지 못했습니다.");
      expect(kind === "JSON" ? JSON.parse(text).error : undefined).toBeUndefined();

      const renewalCallsAtCompletion = prismaMock.characterRun.updateMany.mock.calls.filter(([argument]) => {
        const data = (argument as { data?: { eventGenerationStartedAt?: Date; eventGenerationToken?: unknown } }).data;
        return data?.eventGenerationStartedAt instanceof Date && data.eventGenerationToken === undefined;
      }).length;
      await vi.advanceTimersByTimeAsync(120_000);
      const renewalCallsAfterMultipleIntervals = prismaMock.characterRun.updateMany.mock.calls.filter(([argument]) => {
        const data = (argument as { data?: { eventGenerationStartedAt?: Date; eventGenerationToken?: unknown } }).data;
        return data?.eventGenerationStartedAt instanceof Date && data.eventGenerationToken === undefined;
      }).length;
      expect(renewalCallsAfterMultipleIntervals - renewalCallsAtCompletion).toBe(0);
    } else if (kind === "JSON") {
      expect(response.status).toBe(ownershipLost ? 400 : 500);
      expect(JSON.parse(text)).toEqual({
        error: ownershipLost ? "진행 중인 이벤트가 없습니다." : "다음 사건을 생성하지 못했습니다.",
      });
    } else {
      expect(response.status).toBe(200);
      expect(text).toContain("event: status");
      expect(text).toContain("event: error");
      expect(text).toContain(ownershipLost ? "진행 중인 이벤트가 없습니다." : "다음 사건을 생성하지 못했습니다.");
      expect(text).not.toContain("event: event");
    }

    if (providerRejected) expect(fixture.pointer).toEqual(expect.any(String));
    else expect(fixture.pointer).toBeNull();
    expect([...fixture.events.values()].filter((event) => event.status === "ACTIVE")).toHaveLength(providerRejected ? 1 : 0);
    expect(prismaMock.characterRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ eventGenerationToken: expect.any(String) }),
      data: { eventGenerationToken: null, eventGenerationStartedAt: null },
    }));
    if (providerRejected) {
      expect(fixture.events.get(fixture.pointer!)).toMatchObject({ status: "ACTIVE", source: "FALLBACK" });
      expect(fixture.generationToken).toBeNull();
      expect(fixture.generationStartedAt).toBeNull();
      const completionMessage = kind === "JSON" ? "이벤트 생성 완료" : "스트림 이벤트 생성 완료";
      expect(info).toHaveBeenCalledWith(expect.stringContaining(completionMessage), expect.objectContaining({
        eventId: fixture.pointer,
        source: "FALLBACK",
        generationReason: "api_error",
        generationStage: "provider",
        fallbackUsed: true,
      }));
    } else if (ownershipLost) {
      expect(fixture.generationToken).toBe("replacement-owner");
      expect(fixture.events.size).toBe(1);
      expect([...fixture.events.values()][0]).toMatchObject({ status: "DISCARDED" });
    } else {
      expect(fixture.generationToken).toBeNull();
      expect(fixture.generationStartedAt).toBeNull();
    }
  });

  it.each(["JSON", "SSE"] as const)("derives validated %s fallback content from age and residence context", async (kind) => {
    fixture.age = 80;
    fixture.residence = "dorm";
    fixture.aiEnabled = true;
    engineMocks.selectNextEvent.mockImplementation((context: { age: number; residence: string }) => ({
      type: "static",
      event: { ...routeEvent, title: `${context.age}세의 대안`, body: `${context.residence} 생활에 맞춘 검증된 대안입니다.` },
    }));
    const failure = { success: false as const, reason: "timeout", providerId: "ollama", providerElapsedMs: 5, totalElapsedMs: 5, slow: false, providerFailures: [] };
    aiMocks.generateAiEvent.mockResolvedValue(failure);
    aiMocks.generateAiEventStream.mockResolvedValue(failure);
    const response = kind === "JSON"
      ? await nextJson(new Request("http://localhost/api/characters/run-1/events/next", { method: "POST" }), { params: Promise.resolve({ id: "run-1" }) })
      : await nextStream(new Request("http://localhost/api/characters/run-1/events/next/stream", { method: "POST" }), { params: Promise.resolve({ id: "run-1" }) });
    const text = await response.text();
    const event = kind === "JSON" ? JSON.parse(text).event : eventFromSse(text);
    expect(event).toMatchObject({ title: expect.stringContaining("80세의 대안"), body: expect.stringContaining("dorm 생활"), source: "FALLBACK" });
  });

  it("uses the non-production fixture flag to commit a real fallback without calling a provider", async () => {
    fixture.aiEnabled = true;
    fixture.hiddenFlags = { testForceProviderFailure: true };

    const response = await nextJson(
      new Request("http://localhost/api/characters/run-1/events/next", { method: "POST" }),
      { params: Promise.resolve({ id: "run-1" }) },
    );
    const event = (await response.json()).event;

    expect(response.status).toBe(200);
    expect(event.source).toBe("FALLBACK");
    expect(aiMocks.generateAiEvent).not.toHaveBeenCalled();
    expect(fixture.events.get(event.id)).toMatchObject({ source: "FALLBACK", status: "ACTIVE" });
  });

  it.each(["JSON", "SSE"] as const)("takes over an expired persisted lease through %s, commits, and cleans up", async (kind) => {
    fixture.generationToken = "crashed-owner";
    fixture.generationStartedAt = new Date(Date.now() - 70_000);

    const response = kind === "JSON"
      ? await nextJson(new Request("http://localhost/api/characters/run-1/events/next", { method: "POST" }), { params: Promise.resolve({ id: "run-1" }) })
      : await nextStream(new Request("http://localhost/api/characters/run-1/events/next/stream", { method: "POST" }), { params: Promise.resolve({ id: "run-1" }) });
    const text = await response.text();
    const committed = kind === "JSON" ? JSON.parse(text).event : eventFromSse(text);

    expect(committed.id).toBe(fixture.pointer);
    expect(fixture.events.get(committed.id)).toMatchObject({ status: "ACTIVE" });
    expect([...fixture.events.values()].filter((item) => item.status === "ACTIVE")).toHaveLength(1);
    expect(fixture.generationToken).toBeNull();
    expect(fixture.generationStartedAt).toBeNull();
  });

  it.each(["JSON", "SSE"] as const)("terminates %s when the run disappears before lease acquisition", async (kind) => {
    fixture.disappearBeforeLease = true;
    const response = kind === "JSON"
      ? await nextJson(new Request("http://localhost/api/characters/run-1/events/next", { method: "POST" }), { params: Promise.resolve({ id: "run-1" }) })
      : await nextStream(new Request("http://localhost/api/characters/run-1/events/next/stream", { method: "POST" }), { params: Promise.resolve({ id: "run-1" }) });
    const text = await response.text();

    if (kind === "JSON") {
      expect(response.status).toBe(404);
      expect(JSON.parse(text)).toEqual({ error: "캐릭터를 찾을 수 없습니다." });
    } else {
      expect(response.status).toBe(200);
      expect(text).toContain("event: error");
      expect(text).toContain("캐릭터를 찾을 수 없습니다.");
    }
    expect(aiMocks.generateAiEvent).not.toHaveBeenCalled();
    expect(aiMocks.generateAiEventStream).not.toHaveBeenCalled();
    expect(fixture.events.size).toBe(0);
  });

  it("keeps a slow SSE AI leader authoritative while JSON and SSE followers wait", async () => {
    vi.useFakeTimers();
    fixture.aiEnabled = true;
    // Route lease = provider timeout + 5s. A zero provider timeout keeps this
    // acceptance race short while preserving the production formula.
    aiMocks.getOpenRouterTimeoutMs.mockReturnValue(0);
    const leaseMs = 5_000;
    let finishProvider!: (value: unknown) => void;
    const provider = new Promise((resolve) => { finishProvider = resolve; });
    aiMocks.generateAiEventStream.mockReturnValue(provider);
    const aiEvent = {
      ...routeEvent,
      title: "느린 공급자의 권위 있는 사건",
      body: "당신은 오래 기다린 끝에 도착한 하나의 제안을 읽었다. 이 본문은 커밋되기 전에는 어떤 팔로워에게도 보이지 않고, 커밋된 뒤에만 선택지와 함께 전달된다. 빠른 정적 대안이 준비되어 있어도 살아 있는 생성 리더를 밀어내지 않는다.",
    };
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    const leaderResponse = await nextStream(new Request("http://localhost/api/characters/run-1/events/next/stream", { method: "POST" }), { params: Promise.resolve({ id: "run-1" }) });
    const reader = leaderResponse.body!.getReader();
    const firstFrame = new TextDecoder().decode((await reader.read()).value);
    expect(firstFrame).toContain("event: status");
    expect(firstFrame).not.toContain("body_delta");
    expect(firstFrame).not.toContain("event: event");
    expect(fixture.pointer).toBeNull();
    await vi.waitFor(() => expect(aiMocks.generateAiEventStream).toHaveBeenCalledTimes(1), { timeout: 1_000 });

    await vi.advanceTimersByTimeAsync(leaseMs);
    const jsonFollower = nextJson(new Request("http://localhost/api/characters/run-1/events/next", { method: "POST" }), { params: Promise.resolve({ id: "run-1" }) });
    await vi.advanceTimersByTimeAsync(leaseMs);
    const sseFollower = nextStream(new Request("http://localhost/api/characters/run-1/events/next/stream", { method: "POST" }), { params: Promise.resolve({ id: "run-1" }) });
    await vi.advanceTimersByTimeAsync(leaseMs);
    const renewalCount = prismaMock.characterRun.updateMany.mock.calls.filter(([argument]) => {
      const data = (argument as { data?: { eventGenerationStartedAt?: Date; eventGenerationToken?: unknown } }).data;
      return data?.eventGenerationStartedAt instanceof Date && data.eventGenerationToken === undefined;
    }).length;
    expect(renewalCount).toBeGreaterThanOrEqual(3);
    finishProvider({
      success: true, event: aiEvent, providerId: "ollama", providerElapsedMs: 12_000,
      totalElapsedMs: 12_000, slow: true, retryUsed: false, providerFailures: [],
    });

    await vi.runAllTimersAsync();

    let leaderRest = "";
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      leaderRest += new TextDecoder().decode(chunk.value);
    }
    const jsonPayload = await (await jsonFollower).json();
    const followerText = await (await sseFollower).text();
    const leaderEvent = eventFromSse(leaderRest);

    expect(jsonPayload.event).toEqual(leaderEvent);
    expect(eventFromSse(followerText)).toEqual(leaderEvent);
    expect(leaderRest).not.toContain("event: body_delta");
    expect(leaderRest).toContain("event: event");
    expect(aiMocks.generateAiEventStream).toHaveBeenCalledTimes(1);
    expect(aiMocks.generateAiEvent).not.toHaveBeenCalled();
    expect(engineMocks.selectNextEvent).not.toHaveBeenCalled();
    expect([...fixture.events.values()].filter((item) => item.status === "ACTIVE")).toHaveLength(1);
    expect(leaderEvent.source).toBe("AI");
    expect(info).toHaveBeenCalledWith(expect.stringContaining("스트림 이벤트 생성 완료"), expect.objectContaining({
      eventId: leaderEvent.id, fallbackUsed: false, slow: true,
      timeToFirstVisibleBodyMs: expect.any(Number), timeToFinalEventMs: expect.any(Number),
    }));
    const timing = info.mock.calls.find(([message]) => String(message).includes("스트림 이벤트 생성 완료"))?.[1] as {
      timeToFirstVisibleBodyMs: number; timeToFinalEventMs: number;
    };
    expect(timing.timeToFirstVisibleBodyMs).toBeLessThanOrEqual(timing.timeToFinalEventMs);
  });

  it.each([
    { outcome: "AI", result: { success: true as const, event: routeEvent, providerId: "ollama", providerElapsedMs: 190, totalElapsedMs: 190, slow: false, retryUsed: false, providerFailures: [] } },
    { outcome: "FALLBACK", result: { success: false as const, reason: "timeout", providerId: "openrouter", providerElapsedMs: 190, totalElapsedMs: 190, slow: false, retryUsed: false, providerFailures: [{ providerId: "openrouter", providerElapsedMs: 190, reason: "timeout", stage: "provider" as const }] } },
  ])("delivers one complete SSE event after generation for $outcome", async ({ outcome, result }) => {
    fixture.aiEnabled = true;
    const clock = [1_000, 1_001, 1_100, 1_200, 1_300, 1_400, 1_500];
    const now = vi.fn(() => {
      const value = clock.shift();
      if (value === undefined) throw new Error("unexpected clock sample");
      return value;
    });
    const sends: Array<{ event: string; elapsedMs: number }> = [];
    aiMocks.generateAiEventStream.mockImplementation(async (_state, onText: (text: string) => void) => {
      onText("provider-first-body");
      return result;
    });
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const post = createNextEventStreamPost({ now, observeSend: (observation) => sends.push(observation) });

    const response = await post(
      new Request("http://localhost/api/characters/run-1/events/next/stream", { method: "POST" }),
      { params: Promise.resolve({ id: "run-1" }) },
    );
    const text = await response.text();
    const event = eventFromSse(text);
    const logged = info.mock.calls.find(([message]) => String(message).includes("스트림 이벤트 생성 완료"))?.[1] as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(event).toMatchObject({ id: fixture.pointer, source: outcome });
    expect(sends).toEqual([
      { event: "status", elapsedMs: 1 },
      { event: "event", elapsedMs: 300 },
    ]);
    expect({
      providerFirstBodyMs: logged.providerFirstBodyMs,
      generationCompleteMs: logged.generationCompleteMs,
      timeToFirstVisibleBodyMs: logged.timeToFirstVisibleBodyMs,
      timeToFinalEventMs: logged.timeToFinalEventMs,
      totalElapsedMs: logged.totalElapsedMs,
      eventId: logged.eventId,
      source: logged.source,
      fallbackUsed: logged.fallbackUsed,
      generationReason: logged.generationReason,
      generationStage: logged.generationStage,
    }).toEqual({
      providerFirstBodyMs: 100,
      generationCompleteMs: 200,
      timeToFirstVisibleBodyMs: 300,
      timeToFinalEventMs: 300,
      totalElapsedMs: 400,
      eventId: fixture.pointer,
      source: outcome,
      fallbackUsed: outcome === "FALLBACK",
      generationReason: outcome === "FALLBACK" ? "timeout" : null,
      generationStage: outcome === "FALLBACK" ? "provider" : null,
    });
  });

  it("preserves nested and cyclic Error logger arguments for leakage detection", () => {
    const logger = spyOnSerializedLoggerOutput();
    const sentinel = "PROVIDER_ERROR_SENTINEL";
    const cause = new Error(`${sentinel}_CAUSE`);
    const providerError = new Error(`${sentinel}_MESSAGE`, { cause });
    providerError.stack = `${providerError.name}: ${providerError.message}\n${sentinel}_STACK`;
    const cyclic: { error: Error; nested?: unknown } = { error: providerError };
    cyclic.nested = [cyclic, { cause }];

    console.error("provider failure", cyclic);

    const serializedLogs = logger.serialized();
    expect(serializedLogs).toContain(`${sentinel}_MESSAGE`);
    expect(serializedLogs).toContain(`${sentinel}_CAUSE`);
    expect(serializedLogs).toContain(`${sentinel}_STACK`);
    expect(serializedLogs).toContain("[Circular]");
  });

  it("does not mark a FORCED event as fallback after AI failure", async () => {
    fixture.aiEnabled = true;
    engineMocks.selectNextEvent.mockReturnValue({ type: "forced", event: routeEvent });
    aiMocks.generateAiEvent.mockResolvedValue({
      success: false, reason: "api_error", providerId: "openrouter", providerElapsedMs: 10,
      totalElapsedMs: 10, slow: false, providerFailures: [],
    });
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    const response = await nextJson(new Request("http://localhost/api/characters/run-1/events/next", { method: "POST" }), { params: Promise.resolve({ id: "run-1" }) });
    const payload = await response.json();

    expect(payload.event).toMatchObject({ source: "FORCED", forced: true });
    expect(info).toHaveBeenCalledWith(expect.stringContaining("이벤트 생성 완료"), expect.objectContaining({ source: "FORCED", fallbackUsed: false }));
    expect(fixture.hiddenFlags).not.toHaveProperty("lastAiFallbackReason");
  });

  it.each([
    ["JSON", "timeout"], ["SSE", "timeout"],
    ["JSON", "malformed_json"], ["SSE", "malformed_json"],
    ["JSON", "quality"], ["SSE", "quality"],
  ] as const)("commits a validated FALLBACK after a %s %s failure without exposing the internal error", async (kind, failureKind) => {
    fixture.aiEnabled = true;
    const failure = failureKind === "quality" ? {
      success: true as const,
      event: {
        title: "품질 거절 후보", body: "짧다", tags: ["진로"],
        choices: [
          { id: "a", label: "합격한다", summary: "당신은 갔다.", statDelta: { mental: -1 } },
          { id: "b", label: "남는다", summary: "당신은 남았다.", statDelta: { wealth: -1 } },
        ],
      },
      providerId: "openrouter", providerLabel: "OpenRouter", providerElapsedMs: 25,
      totalElapsedMs: 25, slow: false, providerFailures: [],
    } : {
      success: false as const,
      reason: failureKind,
      providerId: "openrouter",
      providerLabel: "OpenRouter",
      providerElapsedMs: 5_000,
      totalElapsedMs: 5_000,
      slow: false,
      providerFailures: [{ providerId: "openrouter", providerLabel: "OpenRouter", providerElapsedMs: 5_000, reason: failureKind, stage: failureKind === "malformed_json" ? "parse" : "provider" }],
    };
    aiMocks.generateAiEvent.mockResolvedValue(failure);
    aiMocks.generateAiEventStream.mockResolvedValue(failure);
    const logger = spyOnSerializedLoggerOutput();
    const info = vi.mocked(console.info);

    const response = kind === "JSON"
      ? await nextJson(new Request("http://localhost/api/characters/run-1/events/next", { method: "POST" }), { params: Promise.resolve({ id: "run-1" }) })
      : await nextStream(new Request("http://localhost/api/characters/run-1/events/next/stream", { method: "POST" }), { params: Promise.resolve({ id: "run-1" }) });
    const text = await response.text();
    const event = kind === "JSON" ? JSON.parse(text).event : eventFromSse(text);

    expect(response.status).toBe(200);
    expect(event).toMatchObject({ id: fixture.pointer, source: "FALLBACK", forced: false });
    expect(text).not.toContain(failureKind);
    expect(text).not.toContain("error");
    expect([...fixture.events.values()].filter((item) => item.status === "ACTIVE")).toHaveLength(1);
    expect(info).toHaveBeenCalledWith(expect.stringContaining(kind === "JSON" ? "이벤트 생성 완료" : "스트림 이벤트 생성 완료"), expect.objectContaining({
      eventId: fixture.pointer,
      source: "FALLBACK",
      providerId: "openrouter",
      providerElapsedMs: failureKind === "quality" ? 25 : 5_000,
      totalElapsedMs: expect.any(Number),
      slow: false,
      generationReason: failureKind === "quality" ? "post_parse_quality_failure" : failureKind,
      generationStage: failureKind === "quality" ? "quality" : failureKind === "malformed_json" ? "parse" : "provider",
      retryUsed: false,
      fallbackUsed: true,
      providerFailures: failureKind === "quality" ? [] : [expect.objectContaining({ providerId: "openrouter", reason: failureKind, providerElapsedMs: 5_000 })],
      ...(kind === "SSE" ? {
        timeToFirstVisibleBodyMs: expect.any(Number),
        timeToFinalEventMs: expect.any(Number),
      } : {}),
    }));
    expect(kind === "JSON" ? aiMocks.generateAiEvent : aiMocks.generateAiEventStream).toHaveBeenCalledTimes(1);
    expect(fixture.generationToken).toBeNull();
    expect(fixture.generationStartedAt).toBeNull();
    const logged = logger.serialized();
    expect(logged).not.toContain("API_KEY");
    expect(logged).not.toContain("prompt");
    expect(logged).not.toContain("raw");
  });

  it("commits one slow primary-provider result through the real generator without retry or fallback", async () => {
    vi.useFakeTimers();
    fixture.aiEnabled = true;
    const secret = "PRIMARY_ROUTE_KEY_SENTINEL_7c93";
    const prompt = "PRIMARY_PROMPT_STATE_SENTINEL_14bd";
    const raw = "PRIMARY_RAW_PROVIDER_SENTINEL_826a";
    const providerError = "PRIMARY_PROVIDER_ERROR_SENTINEL_3e71";
    process.env.OPENROUTER_API_KEY = secret;
    delete process.env.OLLAMA_API_KEY;
    fixture.characterName = prompt;
    const aiEvent = {
      title: "느리지만 한 번에 도착한 제안",
      body: "당신은 늦은 오후 도서관 창가에서 지원서를 펼쳤다. 빗소리 사이로 새로운 제안이 도착했고, 담당자는 오늘 안에 답을 달라고 했다. 조건은 매력적이지만 준비하던 계획과 충돌했다. 당신은 비용과 가능성을 차분히 비교했다. 어떤 답이든 다음 일정과 관계가 달라질 순간이었다.",
      tags: ["진로"],
      choices: routeEvent.choices,
    };
    const providerResponseBody = JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ ...aiEvent, providerDebug: raw, providerError }) } }],
    });
    const actual = await vi.importActual<typeof import("@/lib/game/openrouter")>("@/lib/game/openrouter");
    aiMocks.generateAiEvent.mockImplementation(actual.generateAiEvent);
    const providerInputs: string[] = [];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise((resolve) => {
      setTimeout(() => {
        providerInputs.push(providerResponseBody);
        resolve(new Response(providerResponseBody));
      }, 12_000);
    }));
    const logger = spyOnSerializedLoggerOutput();
    const info = vi.mocked(console.info);

    const pending = nextJson(new Request("http://localhost/api/characters/run-1/events/next", { method: "POST" }), { params: Promise.resolve({ id: "run-1" }) });
    await vi.advanceTimersByTimeAsync(12_000);
    const response = await pending;
    const payload = await response.json();
    const serializedResponse = JSON.stringify(payload);
    const serializedLogs = logger.serialized();
    const serializedRequest = JSON.stringify(fetchMock.mock.calls);

    expect(response.status).toBe(200);
    expect(payload.event).toMatchObject({ id: fixture.pointer, source: "AI", title: expect.stringContaining(aiEvent.title) });
    expect(fixture.events.get(fixture.pointer!)).toMatchObject({ id: fixture.pointer, source: "AI", status: "ACTIVE" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(aiMocks.generateAiEvent).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith(expect.stringContaining("이벤트 생성 완료"), expect.objectContaining({
      eventId: fixture.pointer, providerId: "openrouter", providerElapsedMs: 12_000,
      totalElapsedMs: 12_000, retryUsed: false, fallbackUsed: false, slow: true,
      providerFailures: [],
    }));
    expect(serializedRequest).toContain(secret);
    expect(serializedRequest).toContain(prompt);
    expect(JSON.stringify(providerInputs)).toContain(raw);
    expect(JSON.stringify(providerInputs)).toContain(providerError);
    for (const sentinel of [secret, prompt, raw, providerError]) {
      expect(serializedResponse).not.toContain(sentinel);
      expect(serializedLogs).not.toContain(sentinel);
    }
    delete process.env.OPENROUTER_API_KEY;
    vi.useRealTimers();
  });

  it("logs a timed primary failure and commits a slow secondary AI result through real provider attempts", async () => {
    vi.useFakeTimers();
    fixture.aiEnabled = true;
    const primarySecret = "RETRY_PRIMARY_KEY_SENTINEL_37a1";
    const secondarySecret = "RETRY_SECONDARY_KEY_SENTINEL_911f";
    const prompt = "RETRY_PROMPT_STATE_SENTINEL_5de2";
    const primaryRaw = "RETRY_PRIMARY_ERROR_SENTINEL_b804";
    const secondaryRaw = "RETRY_SECONDARY_RAW_SENTINEL_c67e";
    process.env.OLLAMA_API_KEY = primarySecret;
    process.env.OPENROUTER_API_KEY = secondarySecret;
    fixture.characterName = prompt;
    const aiEvent = {
      title: "두 번째 공급자의 제안",
      body: "당신은 늦은 오후 도서관 창가에서 지원서를 펼쳤다. 빗소리 사이로 새로운 제안이 도착했고, 담당자는 오늘 안에 답을 달라고 했다. 조건은 매력적이지만 준비하던 계획과 충돌했다. 당신은 비용과 가능성을 차분히 비교했다. 어떤 답이든 다음 일정과 관계가 달라질 순간이었다.",
      tags: ["진로"],
      choices: routeEvent.choices,
    };
    const secondaryResponseBody = JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ ...aiEvent, providerDebug: secondaryRaw }) } }],
    });
    const actual = await vi.importActual<typeof import("@/lib/game/openrouter")>("@/lib/game/openrouter");
    aiMocks.generateAiEvent.mockImplementation(actual.generateAiEvent);
    let attempt = 0;
    const providerInputs: string[] = [];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise((resolve) => {
      attempt += 1;
      if (attempt === 1) {
        setTimeout(() => {
          providerInputs.push(primaryRaw);
          resolve(new Response(primaryRaw, { status: 429 }));
        }, 5_000);
        return;
      }
      setTimeout(() => {
        providerInputs.push(secondaryResponseBody);
        resolve(new Response(secondaryResponseBody));
      }, 7_000);
    }));
    const logger = spyOnSerializedLoggerOutput();
    const info = vi.mocked(console.info);

    const pending = nextJson(new Request("http://localhost/api/characters/run-1/events/next", { method: "POST" }), { params: Promise.resolve({ id: "run-1" }) });
    await vi.advanceTimersByTimeAsync(5_000);
    await vi.advanceTimersByTimeAsync(7_000);
    const response = await pending;
    const payload = await response.json();
    const serializedResponse = JSON.stringify(payload);
    const serializedLogs = logger.serialized();
    const serializedRequests = JSON.stringify(fetchMock.mock.calls);

    expect(response.status).toBe(200);
    expect(payload.event).toMatchObject({ id: fixture.pointer, source: "AI", title: expect.stringContaining(aiEvent.title) });
    expect(fixture.events.get(fixture.pointer!)).toMatchObject({ id: fixture.pointer, source: "AI", status: "ACTIVE" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(info).toHaveBeenCalledWith(expect.stringContaining("이벤트 생성 완료"), expect.objectContaining({
      eventId: fixture.pointer, providerId: "ollama", providerElapsedMs: 7_000,
      totalElapsedMs: 12_000, retryUsed: true, fallbackUsed: false, slow: true,
      providerFailures: [expect.objectContaining({
        providerId: "openrouter", stage: "provider", reason: "rate_limited", providerElapsedMs: 5_000,
      })],
    }));
    for (const sentinel of [primarySecret, secondarySecret, prompt]) {
      expect(serializedRequests).toContain(sentinel);
    }
    expect(fetchMock.mock.calls).toHaveLength(2);
    expect(JSON.stringify(providerInputs)).toContain(primaryRaw);
    expect(JSON.stringify(providerInputs)).toContain(secondaryRaw);
    for (const sentinel of [primarySecret, secondarySecret, prompt, primaryRaw, secondaryRaw]) {
      expect(serializedResponse).not.toContain(sentinel);
      expect(serializedLogs).not.toContain(sentinel);
    }
    delete process.env.OLLAMA_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    vi.useRealTimers();
  });

  it("marks fallback validation and commit overhead over ten seconds as slow without failing", async () => {
    vi.useFakeTimers();
    fixture.aiEnabled = true;
    fixture.commitDelayMs = 11_000;
    aiMocks.generateAiEvent.mockResolvedValue({
      success: false, reason: "timeout", providerId: "openrouter", providerLabel: "OpenRouter",
      providerElapsedMs: 5_000, totalElapsedMs: 5_000, slow: false, retryUsed: false,
      providerFailures: [{ providerId: "openrouter", providerLabel: "OpenRouter", providerElapsedMs: 5_000, stage: "provider", reason: "timeout" }],
    });
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    const pending = nextJson(new Request("http://localhost/api/characters/run-1/events/next", { method: "POST" }), { params: Promise.resolve({ id: "run-1" }) });
    await vi.advanceTimersByTimeAsync(11_000);
    const response = await pending;
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.event).toMatchObject({ id: fixture.pointer, source: "FALLBACK" });
    expect(info).toHaveBeenCalledWith(expect.stringContaining("이벤트 생성 완료"), expect.objectContaining({
      eventId: fixture.pointer, totalElapsedMs: 11_000, slow: true, retryUsed: false, fallbackUsed: true,
    }));
    vi.useRealTimers();
  });

  it("honors the configured provider timeout at route level and commits a validated fallback", async () => {
    vi.useFakeTimers();
    fixture.aiEnabled = true;
    aiMocks.checkDailyAiLimit.mockResolvedValue({ allowed: false });
    process.env.OLLAMA_API_KEY = "ROUTE_TIMEOUT_SECRET_SENTINEL";
    process.env.OPENROUTER_TIMEOUT_MS = "5000";
    const rawSentinel = "ROUTE_RAW_RESPONSE_SENTINEL";
    const actual = await vi.importActual<typeof import("@/lib/game/openrouter")>("@/lib/game/openrouter");
    aiMocks.generateAiEvent.mockImplementation(actual.generateAiEvent);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      void rawSentinel;
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }));
    const logger = spyOnSerializedLoggerOutput();
    const info = vi.mocked(console.info);

    const pending = nextJson(new Request("http://localhost/api/characters/run-1/events/next", { method: "POST" }), { params: Promise.resolve({ id: "run-1" }) });
    await vi.advanceTimersByTimeAsync(5_000);
    const response = await pending;
    const responseText = await response.text();
    const serializedLogs = logger.serialized();

    expect(response.status).toBe(200);
    expect(JSON.parse(responseText).event).toMatchObject({ id: fixture.pointer, source: "FALLBACK" });
    expect(responseText).not.toContain("error");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(info).toHaveBeenCalledWith(expect.stringContaining("이벤트 생성 완료"), expect.objectContaining({
      eventId: fixture.pointer, source: "FALLBACK", providerId: "ollama",
      providerElapsedMs: 5_000, totalElapsedMs: 5_000, generationStage: "provider",
      generationReason: "timeout", retryUsed: false, fallbackUsed: true, slow: false,
      providerFailures: [expect.objectContaining({ providerId: "ollama", reason: "timeout", providerElapsedMs: 5_000 })],
    }));
    for (const sentinel of [process.env.OLLAMA_API_KEY!, "FULL_PROMPT_SENTINEL", rawSentinel]) {
      expect(responseText).not.toContain(sentinel);
      expect(serializedLogs).not.toContain(sentinel);
    }
    delete process.env.OLLAMA_API_KEY;
    delete process.env.OPENROUTER_TIMEOUT_MS;
    vi.useRealTimers();
  });

  it("overlaps fresh JSON and SSE generation and converges on one exact authoritative payload", async () => {
    const jsonPromise = nextJson(new Request("http://localhost/api/characters/run-1/events/next", { method: "POST" }), {
      params: Promise.resolve({ id: "run-1" }),
    });
    const streamPromise = nextStream(new Request("http://localhost/api/characters/run-1/events/next/stream", { method: "POST" }), {
      params: Promise.resolve({ id: "run-1" }),
    }).then(async (response) => eventFromSse(await response.text()));

    const [jsonResponse, streamEvent] = await Promise.all([jsonPromise, streamPromise]);
    const jsonEvent = (await jsonResponse.json()).event;
    const active = [...fixture.events.values()].filter((event) => event.status === "ACTIVE");
    const persistedWinner = fixture.events.get(fixture.pointer!);
    const winnerPayload = persistedWinner && {
      id: persistedWinner.id,
      title: persistedWinner.title,
      body: persistedWinner.body,
      source: persistedWinner.source,
      choices: persistedWinner.choices,
      forced: false,
    };

    expect(jsonEvent).toEqual(streamEvent);
    expect(jsonEvent).toEqual(winnerPayload);
    expect(fixture.generationCalls).toBe(1);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(fixture.pointer);
    expect([...fixture.events.values()]).toHaveLength(1);
  });

  it("converges twenty concurrent JSON generation requests to one ACTIVE event and identical payloads", async () => {
    const count = 20;
    const promises = Array.from({ length: count }, () =>
      nextJson(new Request("http://localhost/api/characters/run-1/events/next", { method: "POST" }), {
        params: Promise.resolve({ id: "run-1" }),
      }).then(async (response) => ({ status: response.status, payload: await response.json() })),
    );

    const results = await Promise.all(promises);
    const active = [...fixture.events.values()].filter((event) => event.status === "ACTIVE");
    const persistedWinner = fixture.events.get(fixture.pointer!);
    const winnerPayload = persistedWinner && {
      id: persistedWinner.id,
      title: persistedWinner.title,
      body: persistedWinner.body,
      source: persistedWinner.source,
      choices: persistedWinner.choices,
      forced: false,
    };

    expect(fixture.generationCalls).toBe(1);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(fixture.pointer);
    expect([...fixture.events.values()]).toHaveLength(1);

    for (const result of results) {
      expect(result.status).toBe(200);
      expect(result.payload.event).toEqual(winnerPayload);
    }
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

    const persistedWinner = fixture.events.get(committedId!);
    expect(getPayload.currentEvent).toMatchObject({ id: committedId, body: persistedWinner?.body });
    expect(getPayload.currentEvent.id).not.toBe("orphan-newer");
    expect(jsonPayload.event).toMatchObject({ id: committedId, body: persistedWinner?.body, choices: persistedWinner?.choices });
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
    const lateCandidate = [...fixture.events.values()].find((event) => event.title.startsWith(routeEvent.title));
    expect(lateCandidate?.status).toBe("DISCARDED");
    expect([...fixture.events.values()].some((event) => event.status === "ACTIVE")).toBe(false);
  });
});
