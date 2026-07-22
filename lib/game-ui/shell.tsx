"use client";

import { useEffect, useRef } from "react";

import {
  CharacterSheet,
  PlaySurface,
  RelationshipsSheet,
} from "./App";

export { CharacterSheet, PlaySurface, RelationshipsSheet };

export type AudioSettings = {
  music: boolean;
  sfx: boolean;
  haptics: boolean;
};

export interface SharedGameChromeProps {
  variant: "web" | "toss";
  menuOpen: boolean;
  onMenuOpenChange(open: boolean): void;
  onOpenProgress?: () => void;
  onOpenRecords: () => void;
  onStartNewSimulation: () => void;
  accountLabel?: string;
  showAccountAction?: boolean;
  onOpenAccount?: () => void;
  onOpenPrivacy?: () => void;
  audioSettings: AudioSettings;
  onAudioSettingChange(key: keyof AudioSettings, value: boolean): void;
  audioReady?: boolean;
  currentCharacterName?: string | null;
}

export function SharedGameChrome({
  menuOpen,
  onMenuOpenChange,
  onOpenProgress,
  onOpenRecords,
  onStartNewSimulation,
  accountLabel,
  showAccountAction = false,
  onOpenAccount,
  onOpenPrivacy,
  audioSettings,
  onAudioSettingChange,
  audioReady = true,
  currentCharacterName,
}: SharedGameChromeProps) {
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const firstAction = menuRef.current?.querySelector<HTMLButtonElement>("button");
    firstAction?.focus();
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onMenuOpenChange(false);
      queueMicrotask(() => menuButtonRef.current?.focus());
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen, onMenuOpenChange]);

  return (
    <section className="hero-panel">
      <div className="title-row">
        <h1 className="app-title">
          <span>일어나보니</span>
          <span>대한민국 취준생</span>
        </h1>
        <button
          ref={menuButtonRef}
          className="menu-button"
          type="button"
          aria-label="메뉴"
          aria-expanded={menuOpen}
          onClick={() => onMenuOpenChange(!menuOpen)}
        >
          메뉴
        </button>
        {menuOpen && (
          <nav ref={menuRef} className="app-menu-popover menu-popover" aria-label="메뉴">
            {onOpenProgress && (
              <button
                type="button"
                onClick={() => {
                  onOpenProgress();
                  onMenuOpenChange(false);
                }}
              >
                진행
              </button>
            )}
            <button type="button" onClick={onOpenRecords}>기록</button>
            <button type="button" onClick={onStartNewSimulation}>새 시뮬레이션</button>
            {showAccountAction && onOpenAccount && <button type="button" onClick={onOpenAccount}>{accountLabel ?? "계정"}</button>}
            {onOpenPrivacy && <button type="button" onClick={onOpenPrivacy}>개인정보처리방침</button>}
            <div className="menu-settings">
              {([["music", "배경음"], ["sfx", "효과음"], ["haptics", "햅틱"]] as const).map(([key, label]) => (
                <label className="menu-row" key={key}>
                  <span>{label}</span>
                  <input aria-label={label} type="checkbox" checked={audioSettings[key]} onChange={(event) => onAudioSettingChange(key, event.target.checked)} />
                </label>
              ))}
            </div>
          </nav>
        )}
      </div>
      <div className="status-row">
        <span>{currentCharacterName ? `${currentCharacterName} 진행 중` : "시작 전"}</span>
      </div>
    </section>
  );
}

export interface SharedOnboardingFlowProps {
  variant: "web" | "toss";
  step: "intro" | "name" | "age" | "residence" | "abilities";
  name: string;
  age: number;
  residence: string;
  selectedStats: string[];
  loading: boolean;
  onStepChange(step: "intro" | "name" | "age" | "residence" | "abilities"): void;
  onNameChange(value: string): void;
  onAgeChange(value: number): void;
  onResidenceChange(value: string): void;
  onToggleStat(stat: string): void;
  onSubmit(): void;
  submitDisabled: boolean;
}

const AGE_OPTIONS = Array.from({ length: 63 }, (_, index) => index + 18);
const RESIDENCE_OPTIONS = [
  { id: "family_home", label: "본가", description: "익숙한 가족의 생활 소리 속에서 시작합니다." },
  { id: "studio", label: "자취방", description: "작지만 온전히 내 몫인 방에서 시작합니다." },
  { id: "dorm", label: "기숙사", description: "학교와 가까운 공동생활 공간에서 시작합니다." },
] as const;
const PREFERRED_STATS = ["academic", "practical", "health", "mental", "wealth", "reputation"] as const;
const STAT_LABELS: Record<string, string> = {
  academic: "학업",
  practical: "실무",
  health: "건강",
  mental: "멘탈",
  wealth: "자산",
  reputation: "평판",
};

export function SharedOnboardingFlow(props: SharedOnboardingFlowProps) {
  return (
    <section className="screen-stack onboarding-panel">
      {props.step === "intro" && (
        <section className="create-step">
          <div className="intro-dawn-art" data-testid="intro-dawn-art">
            <div className="pixel-scene-intro" aria-label="오전 6시 07분의 밝은 새벽 방 픽셀아트" data-palette="blue-lilac-apricot-cream" data-testid="pixel-scene-intro">
              <svg aria-hidden="true" data-testid="intro-scene-svg" shapeRendering="crispEdges" viewBox="0 0 320 180">
                <rect data-part="room-blue" width="320" height="180" fill="#536f9b" />
                <rect data-part="lilac-wall" y="55" width="320" height="60" fill="#d98f83" />
                <rect data-part="apricot-dawn" y="82" width="320" height="33" fill="#f3b477" />
                <rect data-part="room-shadow" y="115" width="320" height="65" fill="#51404a" />
                <rect data-part="window-cream" x="16" y="17" width="136" height="100" fill="#f5d7a0" />
                <rect data-part="window-blue" x="23" y="24" width="122" height="86" fill="#718fbb" />
                <rect data-part="window-apricot" x="23" y="70" width="122" height="40" fill="#f0a06f" />
                <rect data-part="window-cream-light" x="23" y="91" width="122" height="19" fill="#ffd58f" />
                <rect data-part="computer-desk" x="197" y="106" width="94" height="13" fill="#352b31" />
                <rect data-part="computer" x="207" y="70" width="62" height="37" fill="#2f3542" />
                <rect data-part="computer-screen" x="214" y="77" width="48" height="24" fill="#bdeee6" />
                <rect data-part="computer-line-primary" x="222" y="82" width="31" height="4" fill="#ffffff" />
                <rect data-part="computer-line-secondary" x="222" y="90" width="24" height="3" fill="#6fa3aa" />
                <rect data-part="bed" x="164" y="120" width="132" height="45" fill="#72566b" />
                <rect data-part="phone" x="176" y="111" width="72" height="20" fill="#96788d" />
                <rect data-part="floor" y="154" width="320" height="26" fill="#302931" />
              </svg>
            </div>
          </div>
          <h2>낯선 아침이 시작됩니다.</h2>
          <p>눈을 뜨니 오전 6시 07분입니다. 휴대폰에는 읽지 않은 카톡 알림이 수북하게 쌓여 있습니다.</p>
          <p>학과 단체방 공지, 새로 올라온 동아리 모집 글, 아르바이트 연락, 그리고 아직 열어보지 않은 메시지 하나가 화면 위에 겹쳐 있습니다. 마지막 메시지에는 짧은 문장만 남아 있습니다. “이번에는 어떤 사람이 될 수 있을까요?”</p>
          <p>오늘은 평범한 학기의 첫날일 수도, 오래 미뤄둔 변화를 시작하는 날일 수도 있습니다. 지금 고르는 작은 선택들은 수업과 관계, 생활과 진로를 조금씩 다른 방향으로 이끌게 될 것입니다.</p>
          <p className="disclaimer">이 이야기는 실제 진로 예측이 아닌 재미를 위한 허구의 시뮬레이션입니다.</p>
          <button className="primary-button" type="button" onClick={() => props.onStepChange("name")}>시작하기</button>
        </section>
      )}

      {props.step === "name" && (
        <section className="create-step">
          <h2>당신의 이름은 무엇인가요?</h2>
          <input aria-label="당신의 이름은 무엇인가요?" className="text-input" maxLength={24} value={props.name} onChange={(event) => props.onNameChange(event.target.value)} />
          <div className="onboarding-actions">
            <button onClick={() => props.onStepChange("intro")}>이전</button>
            <button disabled={!props.name.trim()} onClick={() => props.onStepChange("age")}>다음</button>
          </div>
        </section>
      )}

      {props.step === "age" && (
        <section className="create-step">
          <h2>당신의 나이는 몇 살인가요?</h2>
          <select aria-label="당신의 나이는 몇 살인가요?" className="text-input" value={props.age} onChange={(event) => props.onAgeChange(Number(event.target.value))}>
            {AGE_OPTIONS.map((option) => <option key={option} value={option}>{option}세</option>)}
          </select>
          <div className="onboarding-actions">
            <button onClick={() => props.onStepChange("name")}>이전</button>
            <button onClick={() => props.onStepChange("residence")}>다음</button>
          </div>
        </section>
      )}

      {props.step === "residence" && (
        <section className="create-step">
          <h2>당신은 어디에서 깨어났나요?</h2>
          <div className="residence-grid">
            {RESIDENCE_OPTIONS.map((option) => (
              <button
                aria-pressed={props.residence === option.id}
                className={props.residence === option.id ? "selected" : ""}
                key={option.id}
                type="button"
                onClick={() => props.onResidenceChange(option.id)}
              >
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </button>
            ))}
          </div>
          <div className="onboarding-actions">
            <button onClick={() => props.onStepChange("age")}>이전</button>
            <button disabled={!props.residence} onClick={() => props.onStepChange("abilities")}>다음</button>
          </div>
        </section>
      )}

      {props.step === "abilities" && (
        <section className="create-step">
          <h2>당신이 믿고 싶은 능력 두 가지는 무엇인가요? ({props.selectedStats.length}/2)</h2>
          <div className="chip-grid">
            {PREFERRED_STATS.map((stat) => (
              <button aria-pressed={props.selectedStats.includes(stat)} className={props.selectedStats.includes(stat) ? "selected" : ""} key={stat} type="button" onClick={() => props.onToggleStat(stat)}>
                {STAT_LABELS[stat] ?? stat}
              </button>
            ))}
          </div>
          <p className="muted">선택한 두 능력은 첫 능력치에 조금 더 높게 반영됩니다.</p>
          <div className="onboarding-actions">
            <button onClick={() => props.onStepChange("residence")}>이전</button>
            <button disabled={props.loading || props.submitDisabled} onClick={props.onSubmit}>눈을 뜬다</button>
          </div>
        </section>
      )}
    </section>
  );
}
