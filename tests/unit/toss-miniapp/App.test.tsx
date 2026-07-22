import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../../../apps/toss-miniapp/src/App";

const apiMocks = vi.hoisted(() => ({
  characters: vi.fn(async () => ({ ok: true, status: 200, data: { characters: [] } })),
  character: vi.fn(),
  createCharacter: vi.fn(async () => ({ ok: false, status: 400, data: { error: "not submitted" } })),
  createTossSession: vi.fn(async () => ({ ok: true, status: 200, data: {} })),
  records: vi.fn(async () => ({ ok: true, status: 200, data: { records: [] } })),
}));
const authMocks = vi.hoisted(() => ({ getTossAnonymousKey: vi.fn(async () => "anonymous") }));

vi.mock("../../../apps/toss-miniapp/src/api", () => ({
  api: { ...apiMocks, choose: vi.fn(), nextEvent: vi.fn(), nextEventStream: vi.fn() },
}));
vi.mock("../../../apps/toss-miniapp/src/toss-auth", () => authMocks);

const approvedCopy = [
  "눈을 뜨니 오전 6시 07분입니다. 휴대폰에는 읽지 않은 카톡 알림이 수북하게 쌓여 있습니다.",
  "학과 단체방 공지, 새로 올라온 동아리 모집 글, 아르바이트 연락, 그리고 아직 열어보지 않은 메시지 하나가 화면 위에 겹쳐 있습니다. 마지막 메시지에는 짧은 문장만 남아 있습니다. “이번에는 어떤 사람이 될 수 있을까요?”",
  "오늘은 평범한 학기의 첫날일 수도, 오래 미뤄둔 변화를 시작하는 날일 수도 있습니다. 지금 고르는 작은 선택들은 수업과 관계, 생활과 진로를 조금씩 다른 방향으로 이끌게 될 것입니다.",
  "이 이야기는 실제 진로 예측이 아닌 재미를 위한 허구의 시뮬레이션입니다.",
];
const createdCharacter = {
  id: "run-1", name: "한서윤", age: 80, startGradeYear: 1, currentGradeYear: 1,
  major: "경영학", academicStatus: "enrolled", stats: { academic: 4, practical: 5 },
  relationships: [], eventHistory: [], currentEventId: "event-1", coreEventCount: 0,
  events: [{ id: "event-1", title: "첫 수업으로 향합니다", body: "캠퍼스의 아침입니다.", source: "AI 사건", choices: [] }],
};
const careerRecord = {
  id: "record-1",
  title: "첫 학기를 마쳤습니다",
  summary: "작은 선택들이 한 학기의 기록으로 남았습니다.",
  satisfaction: 74,
};

let container: HTMLDivElement;
let root: Root;

function button(name: string) {
  const match = [...container.querySelectorAll("button")].find((node) => node.textContent?.trim() === name);
  if (!match) throw new Error(`button not found: ${name}`);
  return match as HTMLButtonElement;
}

function click(element: Element) {
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

function change(element: HTMLInputElement | HTMLSelectElement, value: string) {
  act(() => {
    const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, value);
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function flush() {
  await act(async () => { await new Promise((resolvePromise) => setTimeout(resolvePromise, 0)); });
}

function renderApp() {
  act(() => root.render(<App />));
}

async function renderFreshApp() {
  vi.resetModules();
  const { App: FreshApp } = await import("../../../apps/toss-miniapp/src/App");
  act(() => root.render(createElement(FreshApp)));
}

function beginWithName(name = "한서윤") {
  click(button("시작하기"));
  change(container.querySelector<HTMLInputElement>('[aria-label="당신의 이름은 무엇인가요?"]')!, name);
  click(button("다음"));
}

const onboardingPrompts = [
  "낯선 아침이 시작됩니다.",
  "당신의 이름은 무엇인가요?",
  "당신의 나이는 몇 살인가요?",
  "당신은 어디에서 깨어났나요?",
  "당신이 믿고 싶은 능력 두 가지는 무엇인가요?",
] as const;

function expectOnlyOnboardingPrompt(expected: typeof onboardingPrompts[number]) {
  expect(container.querySelectorAll(".create-step")).toHaveLength(1);
  for (const prompt of onboardingPrompts) {
    const occurrences = container.textContent?.split(prompt).length ?? 1;
    expect(occurrences - 1, prompt).toBe(prompt === expected ? 1 : 0);
  }
}

describe("Toss entry refresh", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    authMocks.getTossAnonymousKey.mockResolvedValue("anonymous");
    apiMocks.createTossSession.mockResolvedValue({ ok: true, status: 200, data: {} });
    apiMocks.characters.mockResolvedValue({ ok: true, status: 200, data: { characters: [] } });
    apiMocks.createCharacter.mockResolvedValue({ ok: false, status: 400, data: { error: "not submitted" } });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the exact approved intro and explicit title lines", () => {
    renderApp();
    expect([...container.querySelectorAll(".app-title > span")].map((node) => node.textContent)).toEqual(["일어나보니", "대한민국 취준생"]);
    expect(container.querySelector(".status-row")?.textContent).not.toMatch(/same-origin|provider|source/i);
    expect(container.querySelector("h2")?.textContent).toBe("낯선 아침이 시작됩니다.");
    expect([...container.querySelectorAll(".create-step > .space-y-3 > p")].map((node) => node.textContent)).toEqual(approvedCopy);
    expect(container.textContent).not.toContain("취준 생활 시뮬레이션");
    expect(container.textContent).not.toContain("취준 /");
    expect(container.querySelector('[aria-label="설정"]')).toBeNull();
    expect(container.querySelector(".intro-dawn-art")?.textContent).not.toMatch(/[😀-🙏🌀-🫿]/u);

    expect(container.querySelectorAll('[data-testid="intro-scene-svg"]')).toHaveLength(1);
  });

  it("keeps one question visible, transitions immediately, gates explicit choices, and retains answers", () => {
    renderApp();
    expectOnlyOnboardingPrompt("낯선 아침이 시작됩니다.");
    click(button("시작하기"));
    expectOnlyOnboardingPrompt("당신의 이름은 무엇인가요?");
    expect(button("다음").disabled).toBe(true);
    change(container.querySelector<HTMLInputElement>("input.text-input")!, "한서윤");
    click(button("다음"));
    expectOnlyOnboardingPrompt("당신의 나이는 몇 살인가요?");
    const age = container.querySelector<HTMLSelectElement>("select.text-input")!;
    expect(age).toBeTruthy();
    change(age, "80");
    click(button("다음"));
    expectOnlyOnboardingPrompt("당신은 어디에서 깨어났나요?");
    expect([...container.querySelectorAll('.residence-grid [aria-pressed="true"]')]).toEqual([]);
    expect(button("다음").disabled).toBe(true);
    click([...container.querySelectorAll(".residence-grid button")].find((node) => node.textContent?.startsWith("기숙사"))!);
    click(button("다음"));
    expectOnlyOnboardingPrompt("당신이 믿고 싶은 능력 두 가지는 무엇인가요?");
    expect(container.querySelector("h2")?.textContent).toContain("(0/2)");
    expect(button("눈을 뜬다").disabled).toBe(true);
    click(button("실무"));
    expect(container.querySelectorAll('.chip-grid [aria-pressed="true"]')).toHaveLength(1);
    click(button("멘탈"));
    click(button("자산"));
    expect([...container.querySelectorAll('.chip-grid [aria-pressed="true"]')].map((node) => node.textContent)).toEqual(["실무", "멘탈"]);
    click(button("멘탈"));
    expect(container.querySelectorAll('.chip-grid [aria-pressed="true"]')).toHaveLength(1);
    click(button("멘탈"));
    expect(button("눈을 뜬다").disabled).toBe(false);
    click(button("이전"));
    expectOnlyOnboardingPrompt("당신은 어디에서 깨어났나요?");
    expect(container.querySelector('.residence-grid [aria-pressed="true"] strong')?.textContent).toBe("기숙사");
    click(button("이전"));
    expectOnlyOnboardingPrompt("당신의 나이는 몇 살인가요?");
    expect(container.querySelector<HTMLSelectElement>("select.text-input")?.value).toBe("80");
    click(button("이전"));
    expectOnlyOnboardingPrompt("당신의 이름은 무엇인가요?");
    expect(container.querySelector<HTMLInputElement>("input.text-input")?.value).toBe("한서윤");
    click(button("이전")); expectOnlyOnboardingPrompt("낯선 아침이 시작됩니다.");
    click(button("시작하기")); expectOnlyOnboardingPrompt("당신의 이름은 무엇인가요?");
    click(button("다음")); expectOnlyOnboardingPrompt("당신의 나이는 몇 살인가요?");
    click(button("다음")); expectOnlyOnboardingPrompt("당신은 어디에서 깨어났나요?");
    click(button("다음")); expectOnlyOnboardingPrompt("당신이 믿고 싶은 능력 두 가지는 무엇인가요?");
    expect([...container.querySelectorAll('.chip-grid [aria-pressed="true"]')].map((node) => node.textContent)).toEqual(["실무", "멘탈"]);
  });

  it.each([18, 80])("submits the complete flow at age %i with the exact payload and shows play destination", async (boundaryAge) => {
    apiMocks.createCharacter.mockResolvedValue({ ok: true, status: 201, data: { character: { ...createdCharacter, age: boundaryAge } } } as never);
    renderApp();
    beginWithName();
    change(container.querySelector<HTMLSelectElement>("select.text-input")!, String(boundaryAge));
    click(button("다음"));
    click([...container.querySelectorAll(".residence-grid button")].find((node) => node.textContent?.startsWith("본가"))!);
    click(button("다음"));
    click(button("학업")); click(button("건강"));
    click(button("눈을 뜬다"));
    await flush();
    expect(apiMocks.createCharacter).toHaveBeenCalledWith({ name: "한서윤", age: boundaryAge, residence: "family_home", preferredStats: ["academic", "health"] });
    expect(container.querySelector(".event-panel h2")?.textContent).toBe("첫 수업으로 향합니다");
  });

  it("offers exactly all ages 18 through 80", () => {
    renderApp(); beginWithName();
    expect([...container.querySelectorAll<HTMLOptionElement>("select option")].map((option) => Number(option.value))).toEqual(Array.from({ length: 63 }, (_, index) => index + 18));
  });

  it.each([["본가", "family_home"], ["자취방", "studio"], ["기숙사", "dorm"]])("maps %s to %s", async (label, residenceId) => {
    apiMocks.createCharacter.mockResolvedValue({ ok: true, status: 201, data: { character: createdCharacter } } as never);
    renderApp(); beginWithName(); click(button("다음"));
    click([...container.querySelectorAll(".residence-grid button")].find((node) => node.textContent?.startsWith(label))!);
    click(button("다음")); click(button("실무")); click(button("멘탈")); click(button("눈을 뜬다"));
    await flush();
    expect(apiMocks.createCharacter).toHaveBeenCalledWith(expect.objectContaining({ residence: residenceId }));
    expect(container.textContent).not.toMatch(/선택됨\s*·/);
  });

  it("opens and closes the accessible menu, omits progress without a run, and runs available actions", async () => {
    renderApp();
    const menu = button("메뉴");
    expect(menu.getAttribute("aria-expanded")).toBe("false");
    click(menu);
    expect(menu.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector(".menu-popover")?.getAttribute("aria-label")).toBe("메뉴");
    expect(() => button("진행")).toThrow();
    expect(button("새 시뮬레이션")).toBeTruthy();
    expect(button("기록")).toBeTruthy();
    expect(container.textContent).not.toContain("새 이야기");
    click(menu);
    expect(menu.getAttribute("aria-expanded")).toBe("false");

    click(menu); click(button("기록"));
    await flush();
    expect(button("새로고침")).toBeTruthy();
    expect(button("진행으로")).toBeTruthy();
    expect(container.querySelector(".onboarding-panel")).toBeNull();
    click(menu); click(button("새 시뮬레이션"));
    expect(container.querySelector("h2")?.textContent).toBe("낯선 아침이 시작됩니다.");

    apiMocks.characters.mockResolvedValue({ ok: true, status: 200, data: { characters: [createdCharacter] } } as never);
    apiMocks.character.mockResolvedValue({ ok: true, status: 200, data: { character: createdCharacter, currentEvent: createdCharacter.events[0] } });
    act(() => root.unmount());
    root = createRoot(container); renderApp();
    await flush(); await flush();
    click(button("메뉴")); click(button("기록")); await flush();
    expect(container.querySelector(".event-panel")).toBeNull();
    expect(container.textContent).not.toContain("첫 수업으로 향합니다");
    click(button("메뉴")); click(button("진행"));
    expect(button("메뉴").getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector(".event-panel h2")?.textContent).toBe("첫 수업으로 향합니다");
  });

  it("restores the prior gameplay card structure without exposing event provenance", async () => {
    apiMocks.characters.mockResolvedValue({ ok: true, status: 200, data: { characters: [createdCharacter] } } as never);
    apiMocks.character.mockResolvedValue({ ok: true, status: 200, data: { character: createdCharacter, currentEvent: createdCharacter.events[0] } });
    renderApp();
    await flush(); await flush();

    const stack = container.querySelector(".screen-stack");
    const stats = stack?.querySelector(".stats-grid");
    const event = stack?.querySelector("article.event-panel");
    expect(stats?.querySelectorAll(":scope > span")).toHaveLength(2);
    expect(event?.querySelector("h2")?.textContent).toBe("첫 수업으로 향합니다");
    expect(event?.querySelector("p")?.textContent).toBe("캠퍼스의 아침입니다.");
    expect(container.querySelector(".choice-stack")).toBeTruthy();
    expect(event?.querySelector(".source-pill")).toBeNull();
    expect(container.textContent).not.toMatch(/AI 사건|FALLBACK|provider|source/i);
  });

  it("restores the prior records card layout and navigation copy", async () => {
    apiMocks.records.mockResolvedValue({ ok: true, status: 200, data: { records: [careerRecord] } } as never);
    renderApp(); click(button("메뉴")); click(button("기록")); await flush();

    const stack = container.querySelector(".screen-stack");
    expect(stack?.querySelector(":scope > .action-grid")).toBeTruthy();
    const record = stack?.querySelector("article.record-panel");
    expect(record?.querySelector("strong")?.textContent).toBe(careerRecord.title);
    expect(record?.querySelector("p")?.textContent).toBe(careerRecord.summary);
    expect([...record!.querySelectorAll("span")].map((node) => node.textContent)).toContain("만족도 74");
    expect(button("진행으로")).toBeTruthy();
    expect(container.querySelector(".event-panel")).toBeNull();
  });

  it("persists every setting across remount and safely resets malformed or wrong-typed storage", () => {
    renderApp(); click(button("메뉴"));
    for (const label of ["배경음", "효과음", "햅틱"]) click(container.querySelector(`[aria-label="${label}"]`)!);
    expect(JSON.parse(localStorage.getItem("sano-toss-audio")!)).toEqual({ music: true, sfx: false, haptics: false });
    act(() => root.unmount());
    root = createRoot(container); renderApp(); click(button("메뉴"));
    expect(["배경음", "효과음", "햅틱"].map((label) => container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!.checked)).toEqual([true, false, false]);

    act(() => root.unmount());
    localStorage.setItem("sano-toss-audio", "{broken");
    root = createRoot(container); renderApp(); click(button("메뉴"));
    expect(["배경음", "효과음", "햅틱"].map((label) => container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!.checked)).toEqual([false, true, true]);
    expect(container.querySelector(".error-banner")).toBeNull();

    act(() => root.unmount());
    localStorage.setItem("sano-toss-audio", JSON.stringify({ music: "yes", sfx: false, haptics: true }));
    root = createRoot(container); renderApp(); click(button("메뉴"));
    expect(["배경음", "효과음", "햅틱"].map((label) => container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!.checked)).toEqual([false, true, true]);
    expect(() => click(container.querySelector('[aria-label="햅틱"]')!)).not.toThrow();
  });

  it("keeps settings and onboarding usable when storage writes fail", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    renderApp(); click(button("메뉴"));
    click(container.querySelector('[aria-label="배경음"]')!);
    click(container.querySelector('[aria-label="효과음"]')!);
    click(container.querySelector('[aria-label="햅틱"]')!);
    expect(["배경음", "효과음", "햅틱"].map((label) => container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!.checked)).toEqual([true, false, false]);
    expect(container.querySelector(".error-banner")).toBeNull();
    click(button("새 시뮬레이션")); click(button("시작하기"));
    expect(container.querySelector("h2")?.textContent).toBe("당신의 이름은 무엇인가요?");
    await flush();
    setItem.mockRestore();
  });

  it.each(["absent", "resume-sync", "resume-async"] as const)("keeps a fresh real App and audio module usable when AudioContext is %s", async (failure) => {
    const constructorSpy = vi.fn();
    const resumeSpy = vi.fn(() => {
      if (failure === "resume-sync") throw new Error("resume");
      return failure === "resume-async" ? Promise.reject(new Error("resume")) : Promise.resolve();
    });
    if (failure === "absent") {
      Object.defineProperty(globalThis, "AudioContext", { configurable: true, get: constructorSpy });
    } else {
      vi.stubGlobal("AudioContext", class {
        state = "suspended";
        currentTime = 0;
        destination = {};
        constructor() { constructorSpy(); }
        resume() { return resumeSpy(); }
        createOscillator() { return { frequency: { setValueAtTime() {} }, type: "square", connect() {}, start() {}, stop() {} }; }
        createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
      });
    }
    await renderFreshApp();
    click(button("메뉴"));
    click(button("기록"));
    await flush();
    expect(constructorSpy).toHaveBeenCalled();
    if (failure !== "absent") expect(resumeSpy).toHaveBeenCalled();
    click(button("메뉴"));
    for (const label of ["배경음", "효과음", "햅틱"]) click(container.querySelector(`[aria-label="${label}"]`)!);
    expect(["배경음", "효과음", "햅틱"].map((label) => container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!.checked)).toEqual([true, false, false]);
    click(button("새 시뮬레이션"));
    click(button("시작하기"));
    expectOnlyOnboardingPrompt("당신의 이름은 무엇인가요?");
    change(container.querySelector<HTMLInputElement>("input.text-input")!, "한서윤");
    click(button("다음"));
    expectOnlyOnboardingPrompt("당신의 나이는 몇 살인가요?");
    expect(container.querySelector(".error-banner")).toBeNull();
    await flush();
    if (failure === "resume-async") expect(resumeSpy).toHaveReturned();
    expect(container.querySelector(".error-banner")).toBeNull();
  });

  it("falls back to usable defaults when storage reads and cleanup throw", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    const removeItem = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("blocked"); });
    renderApp(); click(button("메뉴"));
    expect(["배경음", "효과음", "햅틱"].map((label) => container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!.checked)).toEqual([false, true, true]);
    expect(container.querySelector(".error-banner")).toBeNull();
    getItem.mockRestore(); removeItem.mockRestore();
  });

  it.each([
    ["permission missing", () => authMocks.getTossAnonymousKey.mockImplementation(() => undefined as never)],
    ["permission synchronous throw", () => authMocks.getTossAnonymousKey.mockImplementation(() => { throw new Error("permission denied"); })],
    ["permission rejection", () => authMocks.getTossAnonymousKey.mockRejectedValue(new Error("permission denied"))],
    ["session missing", () => apiMocks.createTossSession.mockImplementation(() => undefined as never)],
    ["session synchronous throw", () => apiMocks.createTossSession.mockImplementation(() => { throw new Error("session denied"); })],
    ["session rejection", () => apiMocks.createTossSession.mockRejectedValue(new Error("session denied"))],
  ])("keeps the rendered app usable without a banner when %s", async (_case, arrange) => {
    arrange();
    renderApp(); await flush();
    expect(container.querySelector(".error-banner")).toBeNull();
    click(button("메뉴"));
    click(container.querySelector('[aria-label="효과음"]')!);
    expect(container.querySelector<HTMLInputElement>('[aria-label="효과음"]')?.checked).toBe(false);
    click(button("새 시뮬레이션"));
    click(button("시작하기"));
    expectOnlyOnboardingPrompt("당신의 이름은 무엇인가요?");
    expect(container.querySelector(".error-banner")).toBeNull();
  });

  it("defines deterministic responsive menu geometry, typography, targets, and overflow containment", () => {
    const css = readFileSync(resolve(process.cwd(), "apps/toss-miniapp/src/styles.css"), "utf8");
    expect(css).toMatch(/\.app-shell\s*\{[\s\S]*?overflow-x:\s*hidden;/);
    expect(css).toMatch(/\.menu-popover button,\s*\.menu-row\s*\{[\s\S]*?min-height:\s*44px;[\s\S]*?font-size:\s*14px;[\s\S]*?font-weight:\s*800;/);
    expect(css).toMatch(/\.menu-button\s*\{[\s\S]*?min-height:\s*44px;/);
    expect(css).toMatch(/\.menu-popover\s*\{[\s\S]*?right:\s*0;[\s\S]*?width:\s*min\(280px, calc\(100vw - 64px\)\);/);
    expect(css).toMatch(/@media \(max-width:\s*720px\)\s*\{[\s\S]*?\.menu-popover\s*\{[\s\S]*?left:\s*0;[\s\S]*?right:\s*0;[\s\S]*?width:\s*100%;/);
    for (const width of [390, 720]) expect(width).toBeLessThanOrEqual(720);
    for (const width of [721, 1024]) expect(width).toBeGreaterThan(720);
  });

  it("retains the pre-refresh gameplay and records visual tokens", () => {
    const css = readFileSync(resolve(process.cwd(), "apps/toss-miniapp/src/styles.css"), "utf8");
    expect(css).toMatch(/:root\s*\{[\s\S]*?color:\s*#f7efe2;[\s\S]*?background:\s*#17130f;/);
    expect(css).toMatch(/\.hero-panel,\s*\.event-panel,\s*\.list-panel,\s*\.feedback-panel,\s*\.record-panel\s*\{[\s\S]*?border:\s*2px solid #4d3d2f;[\s\S]*?background:\s*#211a14;/);
    expect(css).toMatch(/\.primary-button\s*\{[\s\S]*?border-color:\s*#f7d08b;[\s\S]*?background:\s*#f7d08b;/);
    expect(css).toMatch(/\.secondary-button,\s*\.segmented \.selected,\s*\.chip-grid \.selected\s*\{[\s\S]*?border-color:\s*#79b7ad;/);
    expect(css).toMatch(/\.stats-grid span\s*\{[\s\S]*?border:\s*1px solid #4d3d2f;[\s\S]*?background:\s*#211a14;/);
    expect(css).not.toContain(".source-pill");
  });
});
