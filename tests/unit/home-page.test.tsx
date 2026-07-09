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
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    json: async () => ({ characters: [] }),
  })));
});

afterEach(() => {
  mockedSessionStatus = "unauthenticated";
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("Home page scaffold", () => {
  it("renders the new run screen when unauthenticated", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<Home />);
    });

    expect(container.textContent).toContain("NEW RUN");
    expect(container.textContent).toContain("새 이야기");
    expect(container.textContent).toContain("로그인/저장");

    act(() => {
      root.unmount();
    });
    container.remove();
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
