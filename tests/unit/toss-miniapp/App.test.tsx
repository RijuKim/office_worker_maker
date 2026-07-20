import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../../../apps/toss-miniapp/src/App";

const apiMocks = vi.hoisted(() => ({
  characters: vi.fn(async () => ({ ok: true, status: 200, data: { characters: [] } })),
  createCharacter: vi.fn(async () => ({ ok: false, status: 400, data: { error: "not submitted" } })),
  createTossSession: vi.fn(async () => ({ ok: true, status: 200, data: {} })),
}));

vi.mock("../../../apps/toss-miniapp/src/api", () => ({
  api: { ...apiMocks, character: vi.fn(), choose: vi.fn(), nextEvent: vi.fn(), records: vi.fn(async () => ({ ok: true, status: 200, data: { records: [] } })) },
}));
vi.mock("../../../apps/toss-miniapp/src/toss-auth", () => ({ getTossAnonymousKey: vi.fn(async () => "anonymous") }));
vi.mock("../../../apps/toss-miniapp/src/audio", () => ({ playCue: vi.fn(), startBgm: vi.fn(), stopBgm: vi.fn(), vibrate: vi.fn() }));

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
    const setter = Object.getOwnPropertyDescriptor(element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype, "value")?.set;
    setter?.call(element, value);
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("Toss entry refresh", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function renderApp() {
    act(() => root.render(<App />));
  }

  it("shows the two-line title and one combined menu with navigation and settings", () => {
    renderApp();
    expect([...container.querySelectorAll(".app-title > span")].map((node) => node.textContent)).toEqual(["일어나보니", "대한민국 취준생"]);
    expect(container.querySelector('[aria-label="설정"]')).toBeNull();
    click(button("메뉴"));
    expect(button("새 시뮬레이션")).toBeTruthy();
    expect(container.textContent).not.toContain("새 이야기");
    const toggles = [...container.querySelectorAll<HTMLInputElement>('.menu-row input[type="checkbox"]')];
    expect(toggles.map((toggle) => [toggle.getAttribute("aria-label"), toggle.checked])).toEqual([["배경음", false], ["효과음", true], ["햅틱", true]]);
    expect(container.querySelectorAll(".menu-popover > button, .menu-popover > .menu-row")).toHaveLength(6);
  });

  it("resets wrong-typed stored settings and persists valid toggle changes", () => {
    localStorage.setItem("sano-toss-audio", JSON.stringify({ music: "yes", sfx: false, haptics: true }));
    renderApp();
    click(button("메뉴"));
    const music = container.querySelector<HTMLInputElement>('[aria-label="배경음"]')!;
    const sfx = container.querySelector<HTMLInputElement>('[aria-label="효과음"]')!;
    expect([music.checked, sfx.checked]).toEqual([false, true]);
    click(music);
    expect(JSON.parse(localStorage.getItem("sano-toss-audio")!)).toEqual({ music: true, sfx: true, haptics: true });
  });

  it("advances one approved onboarding question at a time and retains age and residence", () => {
    renderApp();
    expect(container.querySelector("h2")?.textContent).toBe("낯선 아침이 시작됩니다.");
    expect(container.textContent).toContain("눈을 뜨니 오전 6시 07분입니다. 휴대폰에는 읽지 않은 카톡 알림이 수북하게 쌓여 있습니다.");
    expect(container.textContent).toContain("이 이야기는 실제 진로 예측이 아닌 재미를 위한 허구의 시뮬레이션입니다.");
    expect(container.querySelector('[data-testid="pixel-scene-intro"]')?.getAttribute("data-palette")).toBe("blue-lilac-apricot-cream");
    expect(container.querySelectorAll('[data-testid="intro-scene-svg"] [data-part*="cross"]')).toHaveLength(0);

    click(button("시작하기"));
    expect(container.querySelector("h2")?.textContent).toBe("당신의 이름은 무엇인가요?");
    expect(container.textContent).not.toContain("당신의 나이는 몇 살인가요?");
    change(container.querySelector<HTMLInputElement>('[aria-label="당신의 이름은 무엇인가요?"]')!, "한서윤");
    click(button("다음"));
    const age = container.querySelector<HTMLSelectElement>('[aria-label="당신의 나이는 몇 살인가요?"]')!;
    expect([...age.options].map((option) => option.value)).toEqual(Array.from({ length: 63 }, (_, index) => String(index + 18)));
    change(age, "80");
    click(button("다음"));
    expect([...container.querySelectorAll(".residence-grid strong")].map((node) => node.textContent)).toEqual(["본가", "자취방", "기숙사"]);
    expect(container.textContent).not.toMatch(/선택됨\s*·/);
    const dorm = [...container.querySelectorAll(".residence-grid button")].find((node) => node.textContent?.startsWith("기숙사"))!;
    click(dorm);
    expect(dorm.getAttribute("aria-pressed")).toBe("true");
    click(button("이전"));
    expect(container.querySelector<HTMLSelectElement>('[aria-label="당신의 나이는 몇 살인가요?"]')?.value).toBe("80");
  });
});
