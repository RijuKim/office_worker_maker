import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SharedGameChrome, SharedOnboardingFlow } from "./shell";
import type { AudioSettings, CreateStep } from "./controller";

function mount(element: React.ReactElement) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    container,
    root,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function click(container: HTMLElement, label: string) {
  const button = [...container.querySelectorAll("button")].find((node) => node.textContent?.includes(label));
  if (!button) throw new Error(`Button not found: ${label}`);
  act(() => button.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("shared game shell", () => {
  it("keeps onboarding to one step at a time and enables submit at 2/2", () => {
    let setStep!: React.Dispatch<React.SetStateAction<CreateStep>>;
    let setName!: React.Dispatch<React.SetStateAction<string>>;
    let setAge!: React.Dispatch<React.SetStateAction<number>>;
    let setResidence!: React.Dispatch<React.SetStateAction<string>>;
    let setSelectedStats!: React.Dispatch<React.SetStateAction<string[]>>;

    function Harness() {
      const [step, nextSetStep] = React.useState<CreateStep>("intro");
      const [name, nextSetName] = React.useState("");
      const [age, nextSetAge] = React.useState(22);
      const [residence, nextSetResidence] = React.useState("");
      const [selectedStats, nextSetSelectedStats] = React.useState<string[]>([]);

      setStep = nextSetStep;
      setName = nextSetName;
      setAge = nextSetAge;
      setResidence = nextSetResidence;
      setSelectedStats = nextSetSelectedStats;
      return (
        <SharedOnboardingFlow
          variant="web"
          step={step}
          name={name}
          age={age}
          residence={residence}
          selectedStats={selectedStats}
          loading={false}
          onStepChange={nextSetStep}
          onNameChange={nextSetName}
          onAgeChange={nextSetAge}
          onResidenceChange={nextSetResidence}
          onToggleStat={(stat) => nextSetSelectedStats((current) => current.includes(stat) ? current.filter((item) => item !== stat) : current.length < 2 ? [...current, stat] : current)}
          onSubmit={() => undefined}
          submitDisabled={selectedStats.length !== 2}
        />
      );
    }

    const { container, unmount } = mount(<Harness />);

    expect(container.textContent).toContain("낯선 아침이 시작됩니다.");
    expect(container.textContent).not.toContain("당신의 이름은 무엇인가요?");

    act(() => setStep("name"));
    act(() => setName("한서윤"));
    act(() => setStep("age"));
    act(() => setAge(80));
    act(() => setStep("residence"));
    act(() => setResidence("dorm"));
    act(() => setStep("abilities"));

    expect(container.textContent).toContain("(0/2)");
    expect(container.querySelector('button[disabled]')?.textContent).toBe("눈을 뜬다");

    click(container, "학업");
    expect(container.textContent).toContain("(1/2)");
    expect(container.querySelector('button[disabled]')?.textContent).toBe("눈을 뜬다");

    click(container, "멘탈");
    expect(container.textContent).toContain("(2/2)");
    expect(container.querySelector('button[disabled]')).toBeNull();

    unmount();
  });

  it("focuses the first menu item, closes on Escape, and restores the trigger focus", () => {
    function Harness() {
      const [menuOpen, setMenuOpen] = React.useState(true);
      const audioSettings: AudioSettings = { music: false, sfx: true, haptics: true };

      return (
        <SharedGameChrome
          variant="web"
          menuOpen={menuOpen}
          onMenuOpenChange={setMenuOpen}
          onOpenProgress={() => undefined}
          onOpenRecords={() => undefined}
          onStartNewSimulation={() => undefined}
          accountLabel="로그인/저장"
          showAccountAction
          onOpenAccount={() => undefined}
          onOpenPrivacy={() => undefined}
          audioSettings={audioSettings}
          onAudioSettingChange={() => undefined}
          currentCharacterName="한서윤"
        />
      );
    }

    const { container, root, unmount } = mount(<Harness />);
    expect(container.querySelector(".app-menu-popover")).toBeTruthy();
    expect(document.activeElement?.textContent?.trim()).toBe("진행");

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
    });

    expect(container.querySelector(".app-menu-popover")).toBeNull();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("메뉴");

    unmount();
  });

  it("shows account access on web and hides it on Toss", () => {
    const audioSettings: AudioSettings = { music: false, sfx: true, haptics: true };

    const web = mount(
      <SharedGameChrome
        variant="web"
        menuOpen
        onMenuOpenChange={() => undefined}
        onOpenProgress={() => undefined}
        onOpenRecords={() => undefined}
        onStartNewSimulation={() => undefined}
        accountLabel="로그인/저장"
        showAccountAction
        onOpenAccount={() => undefined}
        onOpenPrivacy={() => undefined}
        audioSettings={audioSettings}
        onAudioSettingChange={() => undefined}
        currentCharacterName="한서윤"
      />,
    );
    expect(web.container.textContent).toContain("로그인/저장");

    web.unmount();

    const toss = mount(
      <SharedGameChrome
        variant="toss"
        menuOpen
        onMenuOpenChange={() => undefined}
        onOpenProgress={() => undefined}
        onOpenRecords={() => undefined}
        onStartNewSimulation={() => undefined}
        accountLabel={undefined}
        showAccountAction={false}
        onOpenAccount={undefined}
        audioSettings={audioSettings}
        onAudioSettingChange={() => undefined}
        currentCharacterName="한서윤"
      />,
    );
    expect(toss.container.textContent).not.toContain("로그인/저장");
    toss.unmount();
  });
});
