import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoadingPanel, PlaySurface, RecordCardShell, type SharedCharacterView, type SharedChoiceFeedbackView, type SharedEventView } from "./App";

const character: SharedCharacterView = {
  name: "한서윤",
  age: 24,
  major: "컴퓨터공학",
  academicStatus: "ENROLLED",
  stats: { academic: 5, practical: 4, health: 6, mental: 7, wealth: 120, reputation: 3 },
  relationships: [],
  eventHistory: [],
  currentGradeYear: 3,
  startGradeYear: 1,
  progressLabel: "3학년 2학기",
};

const event: SharedEventView = {
  id: "event-1",
  title: "첫 사건",
  body: "오늘의 선택이 시작됩니다.",
  source: "AI",
  choices: [
    { id: "choice-1", label: "첫 번째 선택" },
    { id: "choice-2", label: "두 번째 선택" },
  ],
};

const feedback: SharedChoiceFeedbackView = {
  statDelta: { mental: 1, wealth: -2 },
  relationshipDelta: [{ name: "민준", trust: 4 }],
  summary: "조금 더 단단해졌다.",
};

let container: HTMLDivElement;
let root: Root;

function render(element: React.ReactElement) {
  act(() => root.render(element));
}

beforeEach(() => {
  vi.restoreAllMocks();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("game-ui shared play surfaces", () => {
  it("exposes a restored record title as a heading", () => {
    render(<RecordCardShell expanded={false} id="record-1" title="한서윤의 새로운 결말" />);

    const heading = container.querySelector("h3");
    expect(heading?.textContent).toBe("한서윤의 새로운 결말");
  });

  it("announces the loading state through a live region with the approved Korean copy", () => {
    render(<LoadingPanel />);

    expect(container.textContent).toContain("당신이 모르는 곳에서,");
    expect(container.textContent).toContain("다음 일이 시작되고 있습니다...");
    expect(container.textContent).toContain("선택의 시간이 곧 찾아옵니다.");
    expect(container.querySelector(".event-loading-panel")?.getAttribute("aria-live")).toBe("polite");
    expect(container.querySelector(".event-loading-panel")?.getAttribute("aria-busy")).toBe("true");
  });

  it("marks reduced-motion loading panels when the host requests it", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));

    render(<LoadingPanel />);

    expect(container.querySelector(".event-loading-panel")?.getAttribute("data-reduced-motion")).toBe("true");
  });

  it("shows the loading panel immediately and then renders one final authoritative event", () => {
    render(
      <PlaySurface
        currentCharacter={character}
        currentEvent={null}
        feedback={feedback}
        loading
        onChoose={vi.fn()}
        onContinueToNextEvent={vi.fn()}
      />,
    );

    expect(container.textContent).toContain("당신이 모르는 곳에서,");
    expect(container.querySelector('h2')?.textContent).not.toBe("첫 사건");

    render(
      <PlaySurface
        currentCharacter={character}
        currentEvent={event}
        feedback={feedback}
        loading={false}
        onChoose={vi.fn()}
        onContinueToNextEvent={vi.fn()}
      />,
    );

    expect(container.textContent).not.toContain("당신이 모르는 곳에서,");
    expect(container.querySelector('h2')?.textContent).toBe("첫 사건");
    expect(container.querySelectorAll("h2")).toHaveLength(1);
    expect(container.textContent).toContain("첫 번째 선택");
  });
});
