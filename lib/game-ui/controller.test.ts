import { describe, expect, it, vi } from "vitest";

import { createGameController } from "./controller";
import type { GameHost } from "./host";
import type { CharacterData, EventData } from "./game-data";
import { createSafeAreaInsets } from "./types";

function makeCharacter(overrides: Partial<CharacterData> = {}): CharacterData {
  return {
    id: "run-1",
    name: "한서윤",
    age: 22,
    startGradeYear: 1,
    currentGradeYear: 3,
    major: "사회학과",
    academicStatus: "ENROLLED",
    stats: { academic: 4, practical: 5, health: 6, mental: 7 },
    relationships: [],
    eventHistory: [],
    currentEventId: "event-1",
    coreEventCount: 2,
    events: [{
      id: "event-1",
      title: "첫 사건",
      body: "처음 마주한 사건입니다.",
      choices: [{ id: "choice-1", label: "차분히 대응한다", statDelta: { mental: 1 } }],
      source: "STATIC",
    }],
    ...overrides,
  };
}

function makeEvent(id = "event-2"): EventData {
  return {
    id,
    title: "다음 사건",
    body: "새로운 사건이 확정되었습니다.",
    choices: [{ id: "choice-2", label: "다음으로", statDelta: { practical: 1 } }],
    source: "AI",
  };
}

function makeHost(overrides: Partial<GameHost> = {}): GameHost {
  const bootstrap = vi.fn(async () => ({
    ok: true as const,
    credential: {
      kind: "bearer" as const,
      credentials: "omit" as const,
      token: "signed-token",
      headers: { Authorization: "Bearer signed-token" as const },
    },
  }));

  const host: GameHost = {
    kind: "toss",
    capabilities: {
      kind: "toss",
      accountSurface: { available: false, reason: "hidden" },
      audio: true,
      haptics: true,
    },
    accountSurface: { available: false, label: "계정 없음" },
    session: { bootstrap },
    api: {
      baseUrl: "https://api.example.com",
      headers: (credential) => credential.kind === "bearer" ? credential.headers : {},
    },
    safeArea: {
      get: () => createSafeAreaInsets(),
      subscribe: () => () => undefined,
    },
    routing: { initialIntent: { kind: "play" } },
    sharing: {
      createEndingShareLink: vi.fn(async () => "https://example.com/share/record-1"),
    },
    clipboard: {
      copy: vi.fn(async () => undefined),
    },
    ...overrides,
  };

  return host;
}

function createApiStubs() {
  const runs = [makeCharacter()];
  const currentEvent = makeEvent("event-1");
  const choose = vi.fn(async () => ({
    ok: true as const,
    status: 200,
    data: {
      result: {
        stats: { academic: 5, practical: 6, health: 6, mental: 8 },
        statDelta: { mental: 1 },
        relationshipDelta: [{ name: "지민", trust: 4 }],
        summary: "차분하게 대응했다.",
      },
    },
  }));
  const nextEventStream = vi.fn(async () => ({
    ok: true as const,
    status: 200,
    data: { event: makeEvent("event-2") },
  }));
  const records = vi.fn(async () => ({
    ok: true as const,
    status: 200,
    data: {
      records: [
        { id: "record-1", title: "첫 기록", summary: "한 줄 요약" },
      ],
    },
  }));

  const api = {
    listCharacters: vi.fn(async () => ({ ok: true as const, status: 200, data: { characters: runs } })),
    createCharacter: vi.fn(async () => ({ ok: true as const, status: 201, data: { character: makeCharacter({
      id: "run-2",
      currentEventId: "event-9",
      events: [{
        id: "event-9",
        title: "새로 시작한 사건",
        body: "새로운 선택이 시작됩니다.",
        choices: [{ id: "choice-9", label: "열어본다", statDelta: { practical: 1 } }],
        source: "STATIC",
      }],
    }) } })),
    getCharacter: vi.fn(async () => ({ ok: true as const, status: 200, data: { character: makeCharacter(), currentEvent } })),
    choose,
    nextEventStream,
    records,
  };

  return { api, runs, currentEvent, choose, nextEventStream, records };
}

describe("game controller", () => {
  it("starts from the routed share detail without bootstrapping a session", () => {
    const host = makeHost({
      routing: { initialIntent: { kind: "share", recordId: "record-42" } },
    });
    const controller = createGameController({ host });

    expect(controller.getState()).toMatchObject({
      screen: "records",
      selectedRecordId: "record-42",
      bootstrapStatus: "idle",
      accountSurfaceAvailable: false,
      hostKind: "toss",
    });
  });

  it("boots a session, loads runs, and keeps the initial screen stable", async () => {
    const host = makeHost();
    const stubs = createApiStubs();
    const apiFactory = vi.fn(() => stubs.api);
    const controller = createGameController({ host, apiFactory });

    await controller.bootstrap();

    expect(host.session.bootstrap).toHaveBeenCalledOnce();
    expect(apiFactory).toHaveBeenCalledOnce();
    expect(controller.getState()).toMatchObject({
      bootstrapStatus: "ready",
      loadingTask: null,
      error: "",
      screen: "create",
      runs: [stubs.runs[0]],
    });
    expect(stubs.api.listCharacters).toHaveBeenCalledOnce();
  });

  it("surfaces a bootstrap failure and does not create an api client", async () => {
    const failure = {
      code: "session-exchange-failed" as const,
      message: "사용자 정보를 연결하지 못했습니다. 다시 시도해 주세요.",
      retryable: true,
    };
    const host = makeHost({
      session: {
        bootstrap: vi.fn(async () => ({ ok: false as const, failure })),
      },
    });
    const apiFactory = vi.fn();
    const controller = createGameController({ host, apiFactory });

    await controller.bootstrap();

    expect(apiFactory).not.toHaveBeenCalled();
    expect(controller.getState()).toMatchObject({
      bootstrapStatus: "failed",
      bootstrapFailure: failure,
      error: failure.message,
      screen: "create",
      runs: [],
    });
  });

  it("creates a run from the retained onboarding state and resets the form", async () => {
    const host = makeHost();
    const stubs = createApiStubs();
    const controller = createGameController({ host, apiFactory: () => stubs.api });

    await controller.bootstrap();
    controller.openCreate();
    controller.setCreateName("한서윤");
    controller.setCreateAge(80);
    controller.setCreateResidence("dorm");
    controller.togglePreferredStat("academic");
    controller.togglePreferredStat("mental");

    const createPromise = controller.createRun();
    expect(controller.getState()).toMatchObject({
      loadingTask: "create",
      error: "",
    });
    await createPromise;

    expect(stubs.api.createCharacter).toHaveBeenCalledWith({
      name: "한서윤",
      age: 80,
      residence: "dorm",
      preferredStats: ["academic", "mental"],
    });
    expect(controller.getState()).toMatchObject({
      screen: "play",
      loadingTask: null,
      error: "",
      currentRun: expect.objectContaining({ id: "run-2" }),
      currentEvent: expect.objectContaining({ id: "event-9" }),
      create: {
        step: "intro",
        name: "",
        age: 22,
        residence: "",
        preferredStats: [],
      },
    });
  });

  it("clears the old event, waits for the next stream once, and applies the recovered event", async () => {
    const host = makeHost();
    const stubs = createApiStubs();
    let resolveNext!: (value: { ok: true; status: number; data: { event: EventData } }) => void;
    stubs.nextEventStream.mockImplementation(() => new Promise((resolve) => {
      resolveNext = resolve;
    }));
    const controller = createGameController({ host, apiFactory: () => stubs.api });

    await controller.bootstrap();
    await controller.resumeRun("run-1");

    const choosePromise = controller.choose(0);
    await Promise.resolve();

    expect(stubs.choose).toHaveBeenCalledOnce();
    expect(controller.getState()).toMatchObject({
      loadingTask: "run",
      currentEvent: null,
      feedback: {
        statDelta: { mental: 1 },
        relationshipDelta: [{ name: "지민", trust: 4 }],
        summary: "차분하게 대응했다.",
      },
    });

    resolveNext({
      ok: true,
      status: 200,
      data: { event: makeEvent("event-2") },
    });
    await choosePromise;

    expect(stubs.nextEventStream).toHaveBeenCalledOnce();
    expect(controller.getState()).toMatchObject({
      loadingTask: null,
      error: "",
      currentEvent: expect.objectContaining({ id: "event-2" }),
      screen: "play",
    });
  });

  it("calls nextEventStream exactly once per choose and does not render the same event twice", async () => {
    const host = makeHost();
    const stubs = createApiStubs();
    const events = [makeEvent("event-2"), makeEvent("event-3")];
    let eventIndex = 0;
    stubs.nextEventStream.mockImplementation(async () => {
      const event = events[eventIndex];
      eventIndex += 1;
      return { ok: true as const, status: 200, data: { event } };
    });
    const controller = createGameController({ host, apiFactory: () => stubs.api });

    await controller.bootstrap();
    await controller.resumeRun("run-1");

    await controller.choose(0);
    expect(stubs.nextEventStream).toHaveBeenCalledTimes(1);
    expect(controller.getState()).toMatchObject({
      loadingTask: null,
      currentEvent: expect.objectContaining({ id: "event-2" }),
    });

    await controller.choose(0);
    expect(stubs.nextEventStream).toHaveBeenCalledTimes(2);
    expect(controller.getState()).toMatchObject({
      loadingTask: null,
      currentEvent: expect.objectContaining({ id: "event-3" }),
    });
  });

  it("loads records and exposes settings and detail navigation as state transitions", async () => {
    const host = makeHost();
    const stubs = createApiStubs();
    const controller = createGameController({ host, apiFactory: () => stubs.api });

    await controller.bootstrap();
    await controller.resumeRun("run-1");

    controller.setSetting("music", true);
    controller.setSetting("haptics", false);
    controller.openCharacterDetails();
    expect(controller.getState()).toMatchObject({ screen: "character" });
    controller.openRelationships();
    expect(controller.getState()).toMatchObject({ screen: "relationships" });
    controller.openSettings();
    expect(controller.getState()).toMatchObject({
      screen: "settings",
      settings: { music: true, sfx: true, haptics: false },
    });

    await controller.loadRecords();
    expect(stubs.records).toHaveBeenCalledOnce();
    expect(controller.getState()).toMatchObject({
      screen: "records",
      records: [{ id: "record-1", title: "첫 기록", summary: "한 줄 요약" }],
    });
    controller.openRecords("record-1");
    expect(controller.getState()).toMatchObject({
      screen: "records",
      selectedRecordId: "record-1",
    });
  });
});
