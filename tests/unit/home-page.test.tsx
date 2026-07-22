import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";

let mockedSessionStatus: "authenticated" | "unauthenticated" | "loading" = "unauthenticated";

vi.mock("next-auth/react", async () => {
  const actual = await vi.importActual("next-auth/react");
  return {
    ...actual,
    useSession: vi.fn(() => ({
      data: null,
      status: mockedSessionStatus,
      update: vi.fn(),
    })),
    signIn: vi.fn(),
    signOut: vi.fn(),
  };
});

const character = {
  id: "char-1",
  name: "한서윤",
  age: 21,
  startGradeYear: 1,
  currentGradeYear: 4,
  major: "컴퓨터공학",
  academicStatus: "ENROLLED",
  stats: { academic: 5, practical: 5, health: 5, mental: 5, wealth: 5, charm: 5, reputation: 5 },
  relationships: [],
  eventHistory: [],
  currentEventId: "event-1",
  coreEventCount: 14,
  specScore: 13,
  progressLabel: "4학년 2학기 · 졸업요건 점검",
  lifeStage: {
    lifeStage: "college_late",
    graduation: "gate_ready",
    term: { label: "4학년 2학기" },
  },
};

async function waitForAssertion(assertion: () => void) {
  const started = Date.now();
  let lastError: unknown;
  while (Date.now() - started < 1000) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
    }
  }
  throw lastError;
}

function findButton(container: HTMLElement, label: RegExp | string) {
  const buttons = Array.from(container.querySelectorAll("button"));
  const matcher = typeof label === "string" ? (text: string) => text.trim() === label : (text: string) => label.test(text);
  const button = buttons.find((candidate) => matcher(candidate.textContent ?? ""));
  if (!button) throw new Error(`Button not found: ${label.toString()}`);
  return button;
}

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    json: async () => ({ characters: [] }),
  })));
});

afterEach(() => {
  mockedSessionStatus = "unauthenticated";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("Home page scaffold", () => {
  it("renders the approved intro and combined title menu when unauthenticated", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<Home />);
    });

    expect(container.querySelector(".app-title")?.textContent).toBe("일어나보니대한민국 취준생");
    expect(container.querySelectorAll(".app-title > span")).toHaveLength(2);
    expect(container.querySelector(".app-title > span:first-child")?.textContent).toBe("일어나보니");
    expect(container.querySelector(".app-title > span:last-child")?.textContent).toBe("대한민국 취준생");
    expect(container.textContent).toContain("낯선 아침이 시작됩니다.");
    expect(container.textContent).toContain("눈을 뜨니 오전 6시 07분입니다.");
    expect(container.textContent).toContain("이 이야기는 실제 진로 예측이 아닌 재미를 위한 허구의 시뮬레이션입니다.");
    expect(container.textContent).not.toContain("취준 생활 시뮬레이션");
    expect(container.textContent).not.toContain("새 이야기");
    const intro = container.querySelector("section.create-step")!;
    expect(intro.querySelector("h2")?.textContent).toBe("낯선 아침이 시작됩니다.");
    const copy = intro.querySelector(".space-y-3")!;
    expect(Array.from(copy.children, (node) => node.textContent)).toEqual([
      "눈을 뜨니 오전 6시 07분입니다. 휴대폰에는 읽지 않은 카톡 알림이 수북하게 쌓여 있습니다.",
      "학과 단체방 공지, 새로 올라온 동아리 모집 글, 아르바이트 연락, 그리고 아직 열어보지 않은 메시지 하나가 화면 위에 겹쳐 있습니다. 마지막 메시지에는 짧은 문장만 남아 있습니다. “이번에는 어떤 사람이 될 수 있을까요?”",
      "오늘은 평범한 학기의 첫날일 수도, 오래 미뤄둔 변화를 시작하는 날일 수도 있습니다. 지금 고르는 작은 선택들은 수업과 관계, 생활과 진로를 조금씩 다른 방향으로 이끌게 될 것입니다.",
      "이 이야기는 실제 진로 예측이 아닌 재미를 위한 허구의 시뮬레이션입니다.",
    ]);
    const svg = intro.querySelector("svg")!;
    const rects = Array.from(svg.querySelectorAll("rect"), (rect) => ({
      x: Number(rect.getAttribute("x") ?? 0), y: Number(rect.getAttribute("y") ?? 0),
      width: Number(rect.getAttribute("width")), height: Number(rect.getAttribute("height")), fill: rect.getAttribute("fill"),
    }));
    expect(rects.map((rect) => rect.fill)).toEqual(expect.arrayContaining(["#536f9b", "#718fbb", "#d98f83", "#f3b477", "#ffd58f"]));
    expect(rects.some((rect) => rect.x === 16 && rect.y === 17 && rect.width === 136 && rect.height === 100)).toBe(true);
    expect(rects.some((rect) => rect.x === 207 && rect.y === 70 && rect.width === 62 && rect.height === 37)).toBe(true);
    expect(rects.some((horizontal) => rects.some((vertical) => horizontal !== vertical
      && horizontal.y < 70 && vertical.y < 70 && horizontal.x < 269 && horizontal.x + horizontal.width > 207
      && vertical.x < horizontal.x + horizontal.width && vertical.x + vertical.width > horizontal.x
      && horizontal.width > horizontal.height * 2 && vertical.height > vertical.width * 2))).toBe(false);
    expect(intro.textContent).not.toMatch(/\p{Extended_Pictographic}/u);

    act(() => (container.querySelector("button[aria-label='메뉴']") as HTMLButtonElement).click());
    expect(container.textContent).toContain("로그인/저장");
    expect(container.textContent).toContain("배경음");
    expect(container.textContent).toContain("효과음");
    expect(container.textContent).toContain("햅틱");

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("shows one onboarding question at a time and preserves age on back", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<Home />));

    act(() => findButton(container, "시작하기").click());
    expect(container.textContent).toContain("당신의 이름은 무엇인가요?");
    expect(container.textContent).not.toContain("당신의 나이는 몇 살인가요?");

    const name = container.querySelector("input[aria-label='당신의 이름은 무엇인가요?']") as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(name, "한서윤");
      name.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => findButton(container, "다음").click());
    const age = container.querySelector("select[aria-label='당신의 나이는 몇 살인가요?']") as HTMLSelectElement;
    expect(age.options).toHaveLength(63);
    expect(Array.from(age.options, (option) => Number(option.value))).toEqual(Array.from({ length: 63 }, (_, index) => index + 18));
    act(() => {
      age.value = "80";
      age.dispatchEvent(new Event("change", { bubbles: true }));
      findButton(container, "다음").click();
    });
    expect(container.textContent).toContain("본가");
    expect(container.textContent).not.toContain("선택됨 ·");
    act(() => findButton(container, "이전").click());
    expect((container.querySelector("select") as HTMLSelectElement).value).toBe("80");

    act(() => root.unmount());
    container.remove();
  });

  it("submits the retained onboarding choices exactly and opens the created run", async () => {
    let postedBody: unknown;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://localhost").pathname;
      if (url === "/api/characters" && init?.method === "POST") {
        postedBody = JSON.parse(String(init.body));
        return Response.json({
          character: {
            ...character,
            age: 80,
            events: [{
              id: "event-created",
              title: "첫 아침의 선택",
              body: "새로운 하루가 시작됩니다.",
              choices: [{ id: "begin", label: "하루를 시작한다", statDelta: {} }],
              source: "STATIC",
            }],
          },
        }, { status: 201 });
      }
      return Response.json({ characters: [] });
    }));
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<Home />));

    act(() => findButton(container, "시작하기").click());
    expect(findButton(container, "다음").hasAttribute("disabled")).toBe(true);
    const name = container.querySelector("input[aria-label='당신의 이름은 무엇인가요?']") as HTMLInputElement;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(name, "한서윤");
      name.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => findButton(container, "다음").click());
    const age = container.querySelector("select") as HTMLSelectElement;
    act(() => {
      age.value = "80";
      age.dispatchEvent(new Event("change", { bubbles: true }));
    });
    act(() => findButton(container, "다음").click());
    act(() => findButton(container, /^기숙사/).click());
    act(() => findButton(container, "이전").click());
    expect((container.querySelector("select") as HTMLSelectElement).value).toBe("80");
    act(() => findButton(container, "다음").click());
    expect(findButton(container, /^기숙사/).getAttribute("aria-pressed")).toBe("true");
    act(() => findButton(container, "다음").click());
    expect(container.textContent).toContain("(0/2)");
    expect(findButton(container, "눈을 뜬다").hasAttribute("disabled")).toBe(true);
    act(() => findButton(container, /학업/).click());
    act(() => findButton(container, /멘탈/).click());
    expect(container.textContent).toContain("(2/2)");
    act(() => findButton(container, /멘탈/).click());
    expect(container.textContent).toContain("(1/2)");
    expect(findButton(container, "눈을 뜬다").hasAttribute("disabled")).toBe(true);
    act(() => findButton(container, /멘탈/).click());

    await waitForAssertion(() => expect(findButton(container, "눈을 뜬다").hasAttribute("disabled")).toBe(false));
    const submit = findButton(container, "눈을 뜬다");
    act(() => submit.click());
    await waitForAssertion(() => expect(postedBody).toBeDefined());
    expect(postedBody).toEqual({
      name: "한서윤",
      age: 80,
      residence: "dorm",
      preferredStats: ["academic", "mental"],
    });
    await waitForAssertion(() => expect(container.textContent).toContain("첫 아침의 선택"));

    act(() => (container.querySelector("button[aria-label='메뉴']") as HTMLButtonElement).click());
    act(() => findButton(container, "새 시뮬레이션").click());
    expect(container.textContent).toContain("낯선 아침이 시작됩니다.");
    act(() => findButton(container, "시작하기").click());
    expect((container.querySelector("input") as HTMLInputElement).value).toBe("");
    act(() => findButton(container, "이전").click());

    act(() => root.unmount());
    container.remove();
  });

  it("enumerates every preserved run menu destination and restores focus", async () => {
    mockedSessionStatus = "authenticated";
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input), "http://localhost").pathname;
      if (path === "/api/characters") return Response.json({ characters: [character] });
      if (path === "/api/characters/char-1") return Response.json({ character, currentEvent: { id: "event-1", title: "현재 사건", body: "진행 중", choices: [], source: "STATIC" } });
      if (path === "/api/characters/char-1/specs") return Response.json({ specs: [{ specType: "PORTFOLIO", specName: "서비스 기획 포트폴리오", status: "COMPLETED", score: "우수" }] });
      if (path === "/api/records") return Response.json({ records: [] });
      return Response.json({});
    }));
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => root.render(<Home />));
    await waitForAssertion(() => expect(container.textContent).toContain("현재 사건"));
    expect(container.querySelector('[data-testid="spec-panel"]')?.textContent).toContain("서비스 기획 포트폴리오");
    expect(container.querySelector('[data-testid="spec-score"]')?.textContent).toBe("총점 13");
    const menu = container.querySelector("button[aria-label='메뉴']") as HTMLButtonElement;
    menu.focus();
    act(() => menu.click());
    const panel = container.querySelector(".app-menu-popover")!;
    expect(Array.from(panel.children, (node) => node.textContent?.trim())).toEqual([
      "진행", "기록", "새 시뮬레이션", "계정", "개인정보처리방침", "배경음효과음햅틱",
    ]);
    expect(document.activeElement?.textContent?.trim()).toBe("진행");
    act(() => (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(container.querySelector(".app-menu-popover")).toBeNull();
    expect(document.activeElement).toBe(menu);
    act(() => menu.click());
    act(() => findButton(container, "기록").click());
    await waitForAssertion(() => expect(Array.from(container.querySelectorAll("h1"), (heading) => heading.textContent)).toContain("선택의 결과 기록"));

    act(() => menu.click());
    act(() => findButton(container, "진행").click());
    expect(container.textContent).toContain("현재 사건");

    act(() => menu.click());
    act(() => findButton(container, "계정").click());
    expect(Array.from(container.querySelectorAll("h1"), (heading) => heading.textContent)).toContain("저장된 계정");

    act(() => menu.click());
    act(() => findButton(container, "새 시뮬레이션").click());
    expect(container.querySelector("section.create-step h2")?.textContent).toBe("낯선 아침이 시작됩니다.");

    act(() => menu.click());
    act(() => findButton(container, "개인정보처리방침").click());
    expect(container.querySelector(".app-menu-popover")).toBeNull();

    act(() => root.unmount());
    container.remove();
  });

  it("opens the unauthenticated login and save destination from the menu", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<Home />));

    act(() => (container.querySelector("button[aria-label='메뉴']") as HTMLButtonElement).click());
    act(() => findButton(container, "로그인/저장").click());
    expect(Array.from(container.querySelectorAll("h1"), (heading) => heading.textContent)).toContain("진행 저장하기");
    expect(findButton(container, "로그인")).toBeTruthy();
    expect(container.querySelector("input[type='email']")).toBeTruthy();

    act(() => root.unmount());
    container.remove();
  });

  it("defaults, independently persists settings, and tolerates broken optional WebView APIs", async () => {
    const mount = () => {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);
      act(() => root.render(<Home />));
      act(() => (container.querySelector("button[aria-label='메뉴']") as HTMLButtonElement).click());
      return { container, root };
    };
    let mounted = mount();
    await act(async () => Promise.resolve());
    const toggles = Array.from(mounted.container.querySelectorAll(".audio-toggle input")) as HTMLInputElement[];
    expect(toggles.map((toggle) => toggle.checked)).toEqual([false, true, true]);
    act(() => toggles[0].click());
    await waitForAssertion(() => expect(JSON.parse(window.localStorage.getItem("sano-audio-settings")!)).toEqual({ music: true, sfx: true, haptics: true }));
    act(() => toggles[1].click());
    await waitForAssertion(() => expect(JSON.parse(window.localStorage.getItem("sano-audio-settings")!)).toEqual({ music: true, sfx: false, haptics: true }));
    act(() => toggles[2].click());
    await waitForAssertion(() => expect(JSON.parse(window.localStorage.getItem("sano-audio-settings")!)).toEqual({ music: true, sfx: false, haptics: false }));
    act(() => mounted.root.unmount());
    mounted.container.remove();

    mounted = mount();
    await act(async () => Promise.resolve());
    expect(Array.from(mounted.container.querySelectorAll(".audio-toggle input"), (node) => (node as HTMLInputElement).checked)).toEqual([true, false, false]);
    act(() => mounted.root.unmount());
    mounted.container.remove();

    for (const invalid of ["{broken", "null", "[]", JSON.stringify({ music: false }), JSON.stringify({ music: "yes", sfx: true, haptics: true })]) {
      window.localStorage.setItem("sano-audio-settings", invalid);
      mounted = mount();
      await act(async () => Promise.resolve());
      expect(JSON.parse(window.localStorage.getItem("sano-audio-settings")!)).toEqual({ music: false, sfx: true, haptics: true });
      act(() => mounted.root.unmount());
      mounted.container.remove();
    }

    Object.defineProperty(navigator, "vibrate", { configurable: true, value: undefined });
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementation(() => { throw new Error("play unavailable"); });
    vi.mocked(HTMLMediaElement.prototype.pause).mockImplementation(() => { throw new Error("pause unavailable"); });
    window.localStorage.clear();
    expect(() => {
      mounted = mount();
      const inputs = Array.from(mounted.container.querySelectorAll(".audio-toggle input")) as HTMLInputElement[];
      act(() => inputs[0].click());
      act(() => inputs[0].click());
      act(() => inputs[2].click());
      act(() => inputs[2].click());
    }).not.toThrow();
    act(() => mounted.root.unmount());
    mounted.container.remove();

    Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: undefined });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: undefined });
    mounted = mount();
    const missingMediaInputs = Array.from(mounted.container.querySelectorAll(".audio-toggle input")) as HTMLInputElement[];
    expect(() => { act(() => missingMediaInputs[0].click()); act(() => missingMediaInputs[0].click()); }).not.toThrow();
    await waitForAssertion(() => expect(JSON.parse(window.localStorage.getItem("sano-audio-settings")!)).toEqual({ music: false, sfx: true, haptics: true }));
    act(() => mounted.root.unmount());
    mounted.container.remove();

    Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: vi.fn(() => Promise.reject(new Error("autoplay denied"))) });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: vi.fn() });
    const unhandled = vi.fn();
    window.addEventListener("unhandledrejection", unhandled);
    mounted = mount();
    await act(async () => Promise.resolve());
    const rejectingPlayInputs = Array.from(mounted.container.querySelectorAll(".audio-toggle input")) as HTMLInputElement[];
    act(() => rejectingPlayInputs[0].click());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(unhandled).not.toHaveBeenCalled();
    expect(rejectingPlayInputs[0].checked).toBe(true);
    expect(JSON.parse(window.localStorage.getItem("sano-audio-settings")!)).toEqual({ music: true, sfx: true, haptics: true });
    window.removeEventListener("unhandledrejection", unhandled);
    act(() => mounted.root.unmount());
    mounted.container.remove();

    Object.defineProperty(navigator, "vibrate", { configurable: true, value: () => { throw new Error("vibrate denied"); } });
    mounted = mount();
    const haptics = mounted.container.querySelectorAll(".audio-toggle input")[2] as HTMLInputElement;
    expect(() => { act(() => haptics.click()); act(() => haptics.click()); }).not.toThrow();
    act(() => mounted.root.unmount());
    mounted.container.remove();
  });

  it("uses life-stage progress on play and character detail surfaces", async () => {
    mockedSessionStatus = "authenticated";
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input)).pathname;
      if (url === "/api/characters") {
        return Response.json({ characters: [character] });
      }
      if (url === "/api/characters/char-1") {
        return Response.json({
          character,
          currentEvent: {
            id: "event-1",
            title: "졸업요건 점검",
            body: "교수님은 남은 요건을 차분히 확인해 보자고 말한다.",
            choices: [{ id: "plan", label: "남은 요건을 정리하고 우선순위를 세운다.", statDelta: {} }],
            source: "TEMPLATE",
          },
        });
      }
      return Response.json({});
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<Home />);
    });

    await waitForAssertion(() => expect(container.textContent).toContain("4학년 2학기 · 졸업요건 점검"));
    expect(container.textContent).not.toContain("진행 중인 캐릭터");
    expect(container.textContent).not.toContain("14/15");
    expect(container.textContent).not.toContain("0/15");

    await act(async () => {
      findButton(container, "캐릭터").click();
    });

    expect(container.textContent).toContain("학사 진행: 4학년 2학기 · 졸업요건 점검");
    expect(container.textContent).not.toContain("플레이 진행:");
    expect(container.textContent).not.toContain("/15");

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("hides deprecated route grades from visible record text", async () => {
    mockedSessionStatus = "authenticated";
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input)).pathname;
      if (url === "/api/characters") {
        return Response.json({ characters: [character] });
      }
      if (url === "/api/characters/char-1") {
        return Response.json({
          character,
          currentEvent: {
            id: "event-1",
            title: "졸업요건 점검",
            body: "교수님은 남은 요건을 차분히 확인해 보자고 말한다.",
            choices: [{ id: "plan", label: "남은 요건을 정리하고 우선순위를 세운다.", statDelta: {} }],
            source: "TEMPLATE",
          },
        });
      }
      if (url === "/api/records") {
        return Response.json({
          records: [{
            id: "record-1",
            title: "GOOD ROUTE A등급 개발자",
            summary: "B등급처럼 보였지만 HARD ROUTE를 지나 남은 기록",
            longNarrative: "C등급이라는 말 대신 선택의 비용만 남았다.",
            careerPath: "MIXED ROUTE",
            healthState: "A",
            relationshipState: "B",
            satisfaction: 65,
            growthPotential: 6,
            workLifeBalance: 5,
          }],
        });
      }
      return Response.json({});
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<Home />);
    });

    await waitForAssertion(() => expect(findButton(container, "기록")).toBeTruthy());

    await act(async () => {
      findButton(container, "기록").click();
    });

    await waitForAssertion(() => expect(container.textContent).toContain("개발자"));
    expect(container.textContent).not.toMatch(/\bA\b|\bB\b|\bC\b|GOOD ROUTE|MIXED ROUTE|HARD ROUTE|A등급|B등급|C등급/);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("shows new start instead of progress after a final result", async () => {
    mockedSessionStatus = "authenticated";
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input)).pathname;
      if (url === "/api/characters") {
        return Response.json({ characters: [character] });
      }
      if (url === "/api/characters/char-1") {
        return Response.json({
          character,
          currentEvent: {
            id: "event-1",
            title: "마지막 장면",
            body: "당신은 마지막 선택 앞에 선다.",
            choices: [{ id: "final", label: "마지막 선택을 한다.", statDelta: {} }],
            source: "TEMPLATE",
          },
        });
      }
      if (url === "/api/characters/char-1/choices" && init?.method === "POST") {
        return Response.json({
          result: {
            endingTriggered: true,
            stats: character.stats,
            statDelta: {},
            relationshipDelta: [],
            summary: "당신은 마지막 선택을 기록으로 남겼다.",
          },
        });
      }
      return Response.json({});
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<Home />);
    });

    await waitForAssertion(() => expect(findButton(container, /마지막 선택을 한다/)).toBeTruthy());

    await act(async () => {
      findButton(container, /마지막 선택을 한다/).click();
    });

    await waitForAssertion(() => expect(findButton(container, "새로 시작하기")).toBeTruthy());
    expect(container.textContent).not.toContain("진행으로");

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
