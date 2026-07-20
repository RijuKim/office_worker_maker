import { act } from "react";
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
const audioMocks = vi.hoisted(() => ({ playCue: vi.fn(), startBgm: vi.fn(), stopBgm: vi.fn(), vibrate: vi.fn() }));
const authMocks = vi.hoisted(() => ({ getTossAnonymousKey: vi.fn(async () => "anonymous") }));

vi.mock("../../../apps/toss-miniapp/src/api", () => ({
  api: { ...apiMocks, choose: vi.fn(), nextEvent: vi.fn() },
}));
vi.mock("../../../apps/toss-miniapp/src/toss-auth", () => authMocks);
vi.mock("../../../apps/toss-miniapp/src/audio", () => audioMocks);

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
  events: [{ id: "event-1", title: "첫 수업으로 향합니다", body: "캠퍼스의 아침입니다.", source: "core", choices: [] }],
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

function beginWithName(name = "한서윤") {
  click(button("시작하기"));
  change(container.querySelector<HTMLInputElement>('[aria-label="당신의 이름은 무엇인가요?"]')!, name);
  click(button("다음"));
}

function rgb(hex: string) {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
}

function luminance(hex: string) {
  const channels = rgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function hue(hex: string) {
  const [red, green, blue] = rgb(hex).map((channel) => channel / 255);
  const max = Math.max(red, green, blue); const min = Math.min(red, green, blue); const delta = max - min;
  if (!delta) return 0;
  const sector = max === red ? ((green - blue) / delta) % 6 : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4;
  return (sector * 60 + 360) % 360;
}

describe("Toss entry refresh", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    authMocks.getTossAnonymousKey.mockResolvedValue("anonymous");
    apiMocks.characters.mockResolvedValue({ ok: true, status: 200, data: { characters: [] } });
    apiMocks.createCharacter.mockResolvedValue({ ok: false, status: 400, data: { error: "not submitted" } });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("renders the exact approved intro, explicit title lines, and inspected cross-free bright SVG", () => {
    renderApp();
    expect([...container.querySelectorAll(".app-title > span")].map((node) => node.textContent)).toEqual(["일어나보니", "대한민국 취준생"]);
    expect([...container.querySelectorAll(".create-step > p")].map((node) => node.textContent)).toEqual(approvedCopy);
    expect(container.querySelector("h2")?.textContent).toBe("낯선 아침이 시작됩니다.");
    expect(container.textContent).not.toContain("취준 생활 시뮬레이션");
    expect(container.textContent).not.toContain("취준 /");
    expect(container.querySelector('[aria-label="설정"]')).toBeNull();
    expect(container.querySelector(".intro-dawn-art")?.textContent).not.toMatch(/[😀-🙏🌀-🫿]/u);

    const svg = container.querySelector<SVGSVGElement>('[data-testid="intro-scene-svg"]')!;
    const primitives = [...svg.querySelectorAll<SVGGraphicsElement>("rect,circle,ellipse,line,path,polygon,polyline")];
    expect(primitives.length).toBeGreaterThan(10);
    expect([...svg.children].every((node) => ["rect", "circle", "ellipse", "line", "path", "polygon", "polyline"].includes(node.tagName))).toBe(true);
    const fills = primitives.map((node) => node.getAttribute("fill")).filter((fill): fill is string => /^#[0-9a-f]{6}$/i.test(fill ?? ""));
    const dawnFills = primitives.filter((node) => /dawn|cream|window-(blue|apricot)/.test(node.getAttribute("data-part") ?? "")).map((node) => node.getAttribute("fill")!);
    expect(dawnFills.some((fill) => luminance(fill) > 0.55)).toBe(true);
    expect(dawnFills.some((fill) => { const value = hue(fill); return value >= 20 && value <= 50; })).toBe(true);
    expect(fills.some((fill) => { const value = hue(fill); return value >= 205 && value <= 245; })).toBe(true);

    type Box = { left: number; right: number; top: number; bottom: number; width: number; height: number };
    const boxes = primitives.flatMap((node): Box[] => {
      if (node.tagName !== "rect") return [];
      const left = Number(node.getAttribute("x") ?? 0); const top = Number(node.getAttribute("y") ?? 0);
      const width = Number(node.getAttribute("width") ?? 0); const height = Number(node.getAttribute("height") ?? 0);
      return [{ left, right: left + width, top, bottom: top + height, width, height }];
    });
    const aboveRightComputer = boxes.filter((box) => box.left >= 190 && box.bottom <= 70);
    const intersectsAsCross = (a: Box, b: Box) => {
      const perpendicular = (a.width >= a.height * 2 && b.height >= b.width * 2) || (b.width >= b.height * 2 && a.height >= a.width * 2);
      const intersects = a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      return perpendicular && intersects;
    };
    expect(aboveRightComputer.some((first, index) => aboveRightComputer.slice(index + 1).some((second) => intersectsAsCross(first, second)))).toBe(false);
  });

  it("keeps one question visible, transitions immediately, gates explicit choices, and retains answers", () => {
    renderApp();
    click(button("시작하기"));
    expect(container.querySelectorAll(".create-step")).toHaveLength(1);
    expect(container.querySelector("h2")?.textContent).toBe("당신의 이름은 무엇인가요?");
    expect(button("다음").disabled).toBe(true);
    change(container.querySelector<HTMLInputElement>("input.text-input")!, "한서윤");
    click(button("다음"));
    const age = container.querySelector<HTMLSelectElement>("select.text-input")!;
    expect(age).toBeTruthy();
    change(age, "80");
    click(button("다음"));
    expect(container.querySelector("h2")?.textContent).toBe("당신은 어디에서 깨어났나요?");
    expect([...container.querySelectorAll('.residence-grid [aria-pressed="true"]')]).toEqual([]);
    expect(button("다음").disabled).toBe(true);
    click([...container.querySelectorAll(".residence-grid button")].find((node) => node.textContent?.startsWith("기숙사"))!);
    click(button("다음"));
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
    expect(container.querySelector('.residence-grid [aria-pressed="true"] strong')?.textContent).toBe("기숙사");
    click(button("이전"));
    expect(container.querySelector<HTMLSelectElement>("select.text-input")?.value).toBe("80");
    click(button("이전"));
    expect(container.querySelector<HTMLInputElement>("input.text-input")?.value).toBe("한서윤");
    click(button("다음")); click(button("다음")); click(button("다음"));
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
    expect(button("이어가기")).toBeTruthy();
    expect(container.querySelector(".onboarding-panel")).toBeNull();
    click(menu); click(button("새 시뮬레이션"));
    expect(container.querySelector("h2")?.textContent).toBe("낯선 아침이 시작됩니다.");

    apiMocks.characters.mockResolvedValue({ ok: true, status: 200, data: { characters: [createdCharacter] } } as never);
    apiMocks.character.mockResolvedValue({ ok: true, status: 200, data: { character: createdCharacter, currentEvent: createdCharacter.events[0] } });
    act(() => root.unmount());
    root = createRoot(container); renderApp();
    await flush(); await flush();
    click(button("메뉴")); click(button("진행"));
    expect(button("메뉴").getAttribute("aria-expanded")).toBe("false");
    expect(container.textContent).toContain("이어하기");
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

  it("keeps settings and onboarding usable when every optional caller throws or rejects", async () => {
    audioMocks.playCue.mockImplementation(() => { throw new Error("cue"); });
    audioMocks.vibrate.mockImplementation(() => { throw new Error("haptic"); });
    audioMocks.startBgm.mockRejectedValue(new Error("music"));
    audioMocks.stopBgm.mockImplementation(() => { throw new Error("stop"); });
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

  it("falls back to usable defaults when storage reads and cleanup throw", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    const removeItem = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("blocked"); });
    renderApp(); click(button("메뉴"));
    expect(["배경음", "효과음", "햅틱"].map((label) => container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!.checked)).toEqual([false, true, true]);
    expect(container.querySelector(".error-banner")).toBeNull();
    getItem.mockRestore(); removeItem.mockRestore();
  });

  it("keeps onboarding usable without a banner when the host permission API rejects", async () => {
    authMocks.getTossAnonymousKey.mockRejectedValue(new Error("permission denied"));
    renderApp(); await flush();
    expect(container.querySelector(".error-banner")).toBeNull();
    click(button("시작하기"));
    expect(container.querySelector("h2")?.textContent).toBe("당신의 이름은 무엇인가요?");
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
});
