import { useEffect, useState, useSyncExternalStore } from "react";

import type {
  CareerRecord,
  CharacterData,
  ChoiceFeedback,
  EventData,
  Screen,
} from "./game-data";
import type { GameHost } from "./host";
import type {
  HostFailure,
  HostRequestCredential,
  RouteIntent,
  SessionBootstrapResult,
} from "./types";
import { createGameApiClient, type JsonApiResult } from "./event-stream";

export type CreateStep = "intro" | "name" | "age" | "residence" | "abilities";

export type AudioSettings = {
  music: boolean;
  sfx: boolean;
  haptics: boolean;
};

export interface CreateCharacterInput {
  name: string;
  age: number;
  residence: string;
  preferredStats: string[];
}

export interface GameControllerApi {
  listCharacters(): Promise<JsonApiResult<{ characters?: CharacterData[]; error?: string }>>;
  createCharacter(input: CreateCharacterInput): Promise<JsonApiResult<{ character?: CharacterData; error?: string }>>;
  getCharacter(id: string): Promise<JsonApiResult<{ character?: CharacterData; currentEvent?: EventData; error?: string }>>;
  choose(characterId: string, choiceIndex: number): Promise<JsonApiResult<{
    result?: {
      stats?: Record<string, number>;
      statDelta?: Record<string, number>;
      relationshipDelta?: { name: string; trust: number }[];
      summary?: string;
      endingTriggered?: boolean;
      endingRecordId?: string;
    };
    error?: string;
  }>>;
  nextEvent?(characterId: string): Promise<JsonApiResult<{ event?: EventData; error?: string }>>;
  /** @deprecated Legacy test/host adapter compatibility; production uses nextEvent. */
  nextEventStream?(characterId: string): Promise<JsonApiResult<{ event?: EventData; error?: string }>>;
  records(): Promise<JsonApiResult<{ records?: CareerRecord[]; error?: string }>>;
}

export interface GameControllerSnapshot {
  hostKind: GameHost["kind"];
  accountSurfaceAvailable: boolean;
  routeIntent: RouteIntent;
  bootstrapStatus: "idle" | "loading" | "ready" | "failed";
  bootstrapFailure: HostFailure | null;
  loadingTask: "bootstrap" | "runs" | "create" | "choice" | "records" | "run" | null;
  screen: Screen | "character" | "relationships" | "settings";
  menuOpen: boolean;
  error: string;
  runs: CharacterData[];
  currentRun: CharacterData | null;
  currentEvent: EventData | null;
  feedback: ChoiceFeedback | null;
  records: CareerRecord[];
  selectedRecordId: string | null;
  create: {
    step: CreateStep;
    name: string;
    age: number;
    residence: string;
    preferredStats: string[];
  };
  settings: AudioSettings;
}

export interface GameController {
  getState(): GameControllerSnapshot;
  subscribe(listener: () => void): () => void;
  dispose(): void;
  bootstrap(): Promise<void>;
  refreshRuns(): Promise<void>;
  resumeRun(runId?: string): Promise<void>;
  createRun(): Promise<void>;
  choose(choiceIndex: number): Promise<void>;
  loadRecords(): Promise<void>;
  startNewSimulation(): void;
  openRecords(recordId?: string | null): void;
  openCharacterDetails(): void;
  openRelationships(): void;
  openSettings(): void;
  openHome(): void;
  openCreate(): void;
  setMenuOpen(open: boolean): void;
  toggleMenu(): void;
  clearError(): void;
  setCreateStep(step: CreateStep): void;
  setCreateName(name: string): void;
  setCreateAge(age: number): void;
  setCreateResidence(residence: string): void;
  togglePreferredStat(stat: string): void;
  setSetting(key: keyof AudioSettings, value: boolean): void;
}

export interface GameControllerOptions {
  host: GameHost;
  apiFactory?: (credential: HostRequestCredential) => GameControllerApi;
  now?: () => number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_AUDIO_SETTINGS: AudioSettings = { music: false, sfx: true, haptics: true };
const AGE_START = 18;
const AGE_END = 80;
const PREFERRED_STATS = ["academic", "practical", "health", "mental", "wealth", "reputation"] as const;

const createInitialCreateState = () => ({
  step: "intro" as CreateStep,
  name: "",
  age: 22,
  residence: "",
  preferredStats: [] as string[],
});

function createInitialSnapshot(host: GameHost, routeIntent: RouteIntent): GameControllerSnapshot {
  return {
    hostKind: host.kind,
    accountSurfaceAvailable: host.capabilities.accountSurface.available,
    routeIntent,
    bootstrapStatus: "idle",
    bootstrapFailure: null,
    loadingTask: null,
    screen: routeIntent.kind === "share" ? "records" : "create",
    menuOpen: false,
    error: "",
    runs: [],
    currentRun: null,
    currentEvent: null,
    feedback: null,
    records: [],
    selectedRecordId: routeIntent.kind === "share" ? routeIntent.recordId : null,
    create: createInitialCreateState(),
    settings: { ...DEFAULT_AUDIO_SETTINGS },
  };
}

function resolveApiError<T>(result: JsonApiResult<T>, fallback: string) {
  if (result.ok) return null;
  if (result.data && typeof result.data === "object" && "error" in result.data) {
    const error = (result.data as { error?: unknown }).error;
    if (typeof error === "string" && error) return error;
  }
  return result.error ?? fallback;
}

function createDefaultGameApi(host: GameHost, credential: HostRequestCredential, options: Pick<GameControllerOptions, "fetchImpl" | "now" | "sleep">): GameControllerApi {
  const transport = createGameApiClient({
    baseUrl: host.api.baseUrl,
    fetchImpl: options.fetchImpl,
    now: options.now,
    sleep: options.sleep,
    headers: () => host.api.headers(credential),
  });

  return {
    listCharacters() {
      return transport.requestJson<{ characters?: CharacterData[]; error?: string }>("/api/characters");
    },
    createCharacter(input: CreateCharacterInput) {
      return transport.requestJson<{ character?: CharacterData; error?: string }>("/api/characters", {
        method: "POST",
        body: input,
      });
    },
    getCharacter(id: string) {
      return transport.requestJson<{ character?: CharacterData; currentEvent?: EventData; error?: string }>(`/api/characters/${id}`);
    },
    choose(characterId: string, choiceIndex: number) {
      return transport.requestJson<{ result?: { stats?: Record<string, number>; statDelta?: Record<string, number>; relationshipDelta?: { name: string; trust: number }[]; summary?: string; endingTriggered?: boolean; endingRecordId?: string }; error?: string }>(`/api/characters/${characterId}/choices`, {
        method: "POST",
        body: { choiceIndex },
      });
    },
    nextEvent(characterId: string) {
      return transport.requestJson<{ event?: EventData; error?: string }>(`/api/characters/${characterId}/events/next`, {
        method: "POST",
      });
    },
    records() {
      return transport.requestJson<{ records?: CareerRecord[]; error?: string }>("/api/records");
    },
  };
}

export function createGameController(options: GameControllerOptions): GameController {
  let snapshot = createInitialSnapshot(options.host, options.host.routing.initialIntent);
  let credential: HostRequestCredential | null = null;
  let api: GameControllerApi | null = null;
  const listeners = new Set<() => void>();
  let disposed = false;

  const notify = () => {
    if (disposed) return;
    for (const listener of listeners) listener();
  };

  const update = (patch: Partial<GameControllerSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    notify();
  };

  const updateCreate = (patch: Partial<GameControllerSnapshot["create"]>) => {
    snapshot = { ...snapshot, create: { ...snapshot.create, ...patch } };
    notify();
  };

  const updateSettings = (patch: Partial<AudioSettings>) => {
    snapshot = { ...snapshot, settings: { ...snapshot.settings, ...patch } };
    notify();
  };

  const ensureApi = () => {
    if (!api) throw new Error("controller has not bootstrapped a session yet");
    return api;
  };

  async function bootstrap() {
    update({ bootstrapStatus: "loading", loadingTask: "bootstrap", error: "", bootstrapFailure: null });
    let result: SessionBootstrapResult;
    try {
      result = await options.host.session.bootstrap();
    } catch {
      const failure: HostFailure = { code: "session-exchange-failed", message: "사용자 정보를 연결하지 못했습니다. 다시 시도해 주세요.", retryable: true };
      update({
        bootstrapStatus: "failed",
        loadingTask: null,
        bootstrapFailure: failure,
        error: failure.message,
        screen: "create",
      });
      return;
    }

    if (!result.ok) {
      update({
        bootstrapStatus: "failed",
        loadingTask: null,
        bootstrapFailure: result.failure,
        error: result.failure.message,
        screen: "create",
      });
      return;
    }

    credential = result.credential;
    api = options.apiFactory?.(credential) ?? createDefaultGameApi(options.host, credential, options);
    update({ bootstrapStatus: "ready", loadingTask: null, error: "" });
    await refreshRuns();
  }

  async function refreshRuns() {
    const currentApi = ensureApi();
    update({ loadingTask: "runs", error: "" });
    const result = await currentApi.listCharacters();
    if (!result.ok) {
      update({
        loadingTask: null,
        error: resolveApiError(result, "진행 목록을 불러오지 못했습니다.") ?? "진행 목록을 불러오지 못했습니다.",
      });
      return;
    }

    const runs = result.data.characters ?? [];
    update({
      loadingTask: null,
      runs,
      error: "",
      screen: snapshot.screen === "create" ? "create" : snapshot.screen,
      currentRun: snapshot.currentRun && runs.some((run: CharacterData) => run.id === snapshot.currentRun?.id) ? snapshot.currentRun : snapshot.currentRun,
    });
  }

  async function resumeRun(runId?: string) {
    const currentApi = ensureApi();
    const targetId = runId ?? snapshot.runs[0]?.id;
    if (!targetId) return;

    update({ loadingTask: "run", error: "" });
    const result = await currentApi.getCharacter(targetId);
    if (!result.ok) {
      update({
        loadingTask: null,
        error: resolveApiError(result, "진행 정보를 불러오지 못했습니다.") ?? "진행 정보를 불러오지 못했습니다.",
      });
      return;
    }

    const currentRun = result.data.character ?? null;
    update({
      loadingTask: null,
      currentRun,
      currentEvent: result.data.currentEvent ?? currentRun?.events?.[0] ?? null,
      feedback: null,
      error: "",
      screen: "play",
    });
  }

  async function createRun() {
    const currentApi = ensureApi();
    const { name, age, residence, preferredStats } = snapshot.create;
    if (!name.trim() || !residence || preferredStats.length !== 2) return;

    update({ loadingTask: "create", error: "" });
    const result = await currentApi.createCharacter({
      name: name.trim(),
      age,
      residence,
      preferredStats,
    });

    if (!result.ok || !result.data.character) {
      update({
        loadingTask: null,
        error: resolveApiError(result, "캐릭터를 만들지 못했습니다.") ?? "캐릭터를 만들지 못했습니다.",
      });
      return;
    }

    update({
      loadingTask: null,
      currentRun: result.data.character,
      currentEvent: result.data.character.events?.[0] ?? null,
      feedback: null,
      error: "",
      screen: "play",
      create: createInitialCreateState(),
    });
  }

  async function choose(choiceIndex: number) {
    const currentRun = snapshot.currentRun;
    const currentEvent = snapshot.currentEvent;
    if (!currentRun || !currentEvent) return;

    const currentApi = ensureApi();
    update({ loadingTask: "choice", error: "" });
    const result = await currentApi.choose(currentRun.id, choiceIndex);
    if (!result.ok) {
      update({
        loadingTask: null,
        error: resolveApiError(result, "선택을 처리하지 못했습니다.") ?? "선택을 처리하지 못했습니다.",
      });
      return;
    }

    const choiceResult = result.data.result;
    if (choiceResult?.stats) {
      update({
        currentRun: snapshot.currentRun ? { ...snapshot.currentRun, stats: choiceResult.stats } : snapshot.currentRun,
      });
    }

    update({
      feedback: {
        statDelta: choiceResult?.statDelta ?? {},
        relationshipDelta: choiceResult?.relationshipDelta ?? [],
        summary: choiceResult?.summary ?? "",
      },
      currentEvent: null,
      loadingTask: "run",
      screen: "play",
    });

    if (choiceResult?.endingTriggered) {
      update({
        loadingTask: null,
        currentEvent: null,
        screen: "records",
        selectedRecordId: choiceResult.endingRecordId ?? null,
      });
      return;
    }

    const nextEventRequest = currentApi.nextEvent ?? currentApi.nextEventStream;
    if (!nextEventRequest) {
      update({ loadingTask: null, error: "다음 사건 API를 사용할 수 없습니다." });
      return;
    }
    const next = await nextEventRequest(currentRun.id);
    if (next.ok && next.data.event) {
      update({
        loadingTask: null,
        currentEvent: next.data.event,
        error: "",
      });
      return;
    }

    update({
      loadingTask: null,
      error: resolveApiError(next, "다음 사건을 생성하지 못했습니다.") ?? "다음 사건을 생성하지 못했습니다.",
    });
  }

  async function loadRecords() {
    const currentApi = ensureApi();
    update({ loadingTask: "records", error: "" });
    const result = await currentApi.records();
    if (!result.ok) {
      update({
        loadingTask: null,
        error: resolveApiError(result, "기록을 불러오지 못했습니다.") ?? "기록을 불러오지 못했습니다.",
      });
      return;
    }

    update({
      loadingTask: null,
      records: result.data.records ?? [],
      screen: "records",
      error: "",
    });
  }

  function startNewSimulation() {
    update({
      screen: "create",
      menuOpen: false,
      loadingTask: null,
      error: "",
      currentRun: null,
      currentEvent: null,
      feedback: null,
      selectedRecordId: null,
      create: createInitialCreateState(),
    });
  }

  function openRecords(recordId: string | null = null) {
    update({
      screen: "records",
      selectedRecordId: recordId,
      menuOpen: false,
      error: "",
    });
  }

  function openCharacterDetails() {
    if (!snapshot.currentRun) return;
    update({ screen: "character", menuOpen: false, error: "" });
  }

  function openRelationships() {
    if (!snapshot.currentRun) return;
    update({ screen: "relationships", menuOpen: false, error: "" });
  }

  function openSettings() {
    update({ screen: "settings", menuOpen: false, error: "" });
  }

  function openHome() {
    update({ screen: "create", menuOpen: false, error: "" });
  }

  function openCreate() {
    update({ screen: "create", menuOpen: false, error: "" });
  }

  function setMenuOpen(open: boolean) {
    update({ menuOpen: open });
  }

  function toggleMenu() {
    update({ menuOpen: !snapshot.menuOpen });
  }

  function clearError() {
    update({ error: "", bootstrapFailure: snapshot.bootstrapFailure });
  }

  function setCreateStep(step: CreateStep) {
    updateCreate({ step });
  }

  function setCreateName(name: string) {
    updateCreate({ name });
  }

  function setCreateAge(age: number) {
    if (!Number.isFinite(age)) return;
    const clamped = Math.max(AGE_START, Math.min(AGE_END, Math.trunc(age)));
    updateCreate({ age: clamped });
  }

  function setCreateResidence(residence: string) {
    updateCreate({ residence });
  }

  function togglePreferredStat(stat: string) {
    if (!PREFERRED_STATS.includes(stat as (typeof PREFERRED_STATS)[number])) return;
    const selected = snapshot.create.preferredStats;
    const next = selected.includes(stat)
      ? selected.filter((item) => item !== stat)
      : selected.length < 2
        ? [...selected, stat]
        : selected;
    updateCreate({ preferredStats: next });
  }

  function setSetting(key: keyof AudioSettings, value: boolean) {
    updateSettings({ [key]: value });
  }

  const controller: GameController = {
    getState: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      disposed = true;
      listeners.clear();
    },
    bootstrap,
    refreshRuns,
    resumeRun,
    createRun,
    choose,
    loadRecords,
    startNewSimulation,
    openRecords,
    openCharacterDetails,
    openRelationships,
    openSettings,
    openHome,
    openCreate,
    setMenuOpen,
    toggleMenu,
    clearError,
    setCreateStep,
    setCreateName,
    setCreateAge,
    setCreateResidence,
    togglePreferredStat,
    setSetting,
  };

  return controller;
}

export function useGameController(options: GameControllerOptions) {
  const [controller] = useState(() => createGameController(options));
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);

  useEffect(() => () => controller.dispose(), [controller]);

  return { controller, state: snapshot };
}
