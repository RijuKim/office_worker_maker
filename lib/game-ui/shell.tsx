"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import {
  CharacterSheet,
  PixelScene,
  PlaySurface,
  RelationshipsSheet,
} from "./App";
import type { SharedCharacterView } from "./App";

export { CharacterSheet, PixelScene, PlaySurface, RelationshipsSheet };

export interface SharedGameWorkspaceProps {
  mode?: "web" | "mobile";
  character: SharedCharacterView | null;
  activeTab: "play" | "character" | "relationships";
  onTabChange(tab: "play" | "character" | "relationships"): void;
  onOpenRecords(): void;
  onOpenAccount?(): void;
  accountLabel?: string;
  mobileStatsOpen?: boolean;
  onMobileStatsChange?(open: boolean): void;
  children: ReactNode;
  rightContent?: ReactNode;
}

const WORKSPACE_STATS = [
  ["academic", "학업", "BK"], ["practical", "실무", "TL"], ["health", "건강", "HP"],
  ["mental", "멘탈", "MP"], ["wealth", "자산", "CO"], ["charm", "매력", "CH"], ["reputation", "평판", "RP"],
] as const;

function workspaceStatLevel(value: number) { return Math.max(1, Math.min(10, Math.round(value))); }
function workspaceTrustHearts(trust: number) {
  const count = Math.max(1, Math.min(5, Math.ceil(Math.abs(trust) / 20)));
  return trust >= 0 ? "♥".repeat(count) : "💀".repeat(count);
}

/** The Production web workspace shared by the Next app and the Toss bundle. */
export function SharedGameWorkspace({
  mode = "web", character, activeTab, onTabChange, onOpenRecords, onOpenAccount, accountLabel = "로그인/저장",
  mobileStatsOpen = false, onMobileStatsChange, children, rightContent,
}: SharedGameWorkspaceProps) {
  if (mode === "mobile") {
    return <main className="shared-game-workspace-mobile">{children}</main>;
  }

  return (
    <div className="shared-game-workspace app-layout pixel-shell min-h-screen text-[#2a241e]">
      <aside className="sidebar border-r border-[#3b3025] bg-[#231d17] p-[22px] text-[#f7efe2]">
        <div className="sidebar-profile min-w-0">
          <h1 className="text-[22px] font-bold leading-tight">{character?.name ?? "..."}</h1>
          {character && <p className="sidebar-major text-xs text-[#d9c9b5]">{character.major}</p>}
        </div>
        <nav className="sidebar-nav mt-[22px] grid gap-2">
          <button className={activeTab === "play" ? "active" : ""} onClick={() => onTabChange("play")} type="button">진행</button>
          <button className={activeTab === "character" ? "active" : ""} onClick={() => onTabChange("character")} type="button">캐릭터</button>
          <button className={activeTab === "relationships" ? "active" : ""} onClick={() => onTabChange("relationships")} type="button">관계</button>
          <button onClick={onOpenRecords} type="button">기록</button>
          {onMobileStatsChange && <button aria-expanded={mobileStatsOpen} onClick={() => onMobileStatsChange(!mobileStatsOpen)} type="button">능력치</button>}
          {onOpenAccount && <button onClick={onOpenAccount} type="button">{accountLabel}</button>}
        </nav>
        {character && <section className={`sidebar-stats mt-3.5 rounded-lg border border-[#4d3d2f] bg-[#1b1612] p-3.5 ${mobileStatsOpen ? "sidebar-stats-open" : ""}`}>
          <h2 className="text-base font-bold">능력치</h2>
          <dl className="mt-2 grid gap-2">
            {WORKSPACE_STATS.map(([key, label, icon]) => {
              const level = workspaceStatLevel(character.stats[key] ?? 0);
              return <div className="rounded-md bg-[#2c231b] px-2.5 py-2 text-[13px]" key={key}>
                <dt className="flex items-center justify-between gap-2"><span><span className="mr-1.5 text-[11px] text-[#d79b52]">{icon}</span>{label}</span><span className="text-[#c4b39c]">{key === "wealth" ? `${character.stats[key] ?? 0}만원` : `${level}/10`}</span></dt>
                {key !== "wealth" && <dd className="mt-1.5 flex gap-1">{Array.from({ length: 10 }, (_, index) => <span className={`h-1.5 flex-1 rounded-full ${index < level ? "bg-[#d79b52]" : "bg-[#4c4035]"}`} key={index} />)}</dd>}
              </div>;
            })}
          </dl>
        </section>}
      </aside>
      <main className="play-main bg-[#f7efe2] px-11 py-[34px]">{children}</main>
      <aside className="right-sidebar border-l border-[#3b3025] bg-[#241b15] p-[22px] text-[#fff3d7]">
        <h2 className="text-[22px] font-black leading-tight">기억과 관계</h2>
        <section className="pixel-panel-dark mt-3.5 p-3.5"><h3 className="font-bold">주요 인물</h3><div className="mt-2 space-y-1">
          {character?.relationships?.slice(0, 3).map((rel) => <p className="text-[13px] leading-relaxed text-[#d9c9b5]" key={rel.name}>{rel.name} · {rel.role}<br /><span className="text-[11px]">{workspaceTrustHearts(rel.trust)}</span></p>)}
          {(!character?.relationships || character.relationships.length === 0) && <p className="text-[13px] text-[#d9c9b5]">정보 없음</p>}
        </div></section>
        <section className="pixel-panel-dark mt-3.5 p-3.5"><h3 className="font-bold">최근 기억</h3><div className="mt-2 flex flex-wrap gap-1">
          {character?.eventHistory?.slice(0, 5).map((entry, index) => <span className="border-2 border-[#0f0b08] bg-[#35261c] px-2 py-1 text-xs text-[#f7d08b]" key={index}>{entry.summary.slice(0, 15)}</span>)}
          {(!character?.eventHistory || character.eventHistory.length === 0) && <span className="text-xs text-[#d9c9b5]">아직 기록 없음</span>}
        </div></section>
        {rightContent}
      </aside>
    </div>
  );
}

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

  useLayoutEffect(() => {
    if (!menuOpen) return;
    const firstAction = menuRef.current?.querySelector<HTMLButtonElement>("button");
    firstAction?.focus();
  }, [menuOpen]);

  const closeMenu = useCallback(() => {
    onMenuOpenChange(false);
    menuButtonRef.current?.focus();
  }, [onMenuOpenChange]);

  useEffect(() => {
    if (!menuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeMenu();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen, closeMenu]);

  return (
    <section className="hero-panel" data-audio-ready={audioReady ? "true" : "false"}>
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
                  closeMenu();
                }}
              >
                진행
              </button>
            )}
            <button type="button" onClick={() => { onOpenRecords(); closeMenu(); }}>기록</button>
            <button type="button" onClick={() => { onStartNewSimulation(); closeMenu(); }}>새 시뮬레이션</button>
            {showAccountAction && onOpenAccount && <button type="button" onClick={() => { onOpenAccount(); closeMenu(); }}>{accountLabel ?? "계정"}</button>}
            {onOpenPrivacy && <button type="button" onClick={() => { onOpenPrivacy(); closeMenu(); }}>개인정보처리방침</button>}
            <div className="menu-settings">
              {([["music", "배경음"], ["sfx", "효과음"], ["haptics", "햅틱"]] as const).map(([key, label]) => (
                <label className="audio-toggle menu-row" key={key}>
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
    <section className={`screen-stack onboarding-panel ${props.variant === "web" ? "onboarding-panel-web" : ""}`}>
      {props.step === "intro" && (
        <section className="create-step">
          <div className="create-hero-art intro-dawn-art" data-testid="intro-dawn-art">
            <PixelScene scene="intro" label="오전 6시 07분의 밝은 새벽 방 픽셀아트" />
          </div>
          <h2 className="create-question">낯선 아침이 시작됩니다.</h2>
          <div className="create-copy space-y-3">
            <p>눈을 뜨니 오전 6시 07분입니다. 휴대폰에는 읽지 않은 카톡 알림이 수북하게 쌓여 있습니다.</p>
            <p>학과 단체방 공지, 새로 올라온 동아리 모집 글, 아르바이트 연락, 그리고 아직 열어보지 않은 메시지 하나가 화면 위에 겹쳐 있습니다. 마지막 메시지에는 짧은 문장만 남아 있습니다. “이번에는 어떤 사람이 될 수 있을까요?”</p>
            <p>오늘은 평범한 학기의 첫날일 수도, 오래 미뤄둔 변화를 시작하는 날일 수도 있습니다. 지금 고르는 작은 선택들은 수업과 관계, 생활과 진로를 조금씩 다른 방향으로 이끌게 될 것입니다.</p>
            <p className="disclaimer">이 이야기는 실제 진로 예측이 아닌 재미를 위한 허구의 시뮬레이션입니다.</p>
          </div>
          <button className="pixel-button-dark" type="button" onClick={() => props.onStepChange("name")}>시작하기</button>
        </section>
      )}

      {props.step === "name" && (
        <section className="create-step">
          <h2>당신의 이름은 무엇인가요?</h2>
          <input aria-label="당신의 이름은 무엇인가요?" className="text-input" type="text" maxLength={24} value={props.name} onChange={(event) => props.onNameChange(event.target.value)} />
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
