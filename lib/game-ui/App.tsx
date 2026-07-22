"use client";

import type { ReactNode } from "react";
import type { GameHost } from "./host";

export type SharedStats = Record<string, number>;

export interface SharedCharacterView {
  name: string;
  age: number;
  major: string;
  academicStatus: string;
  stats: SharedStats;
  relationships: Array<{
    name: string;
    role: string;
    trust: number;
    tags?: string[];
  }>;
  eventHistory?: Array<{ summary: string }>;
  startGradeYear?: number;
  currentGradeYear?: number | null;
  progressLabel?: string;
  lifeStage?: {
    term?: { label?: string };
    lifeStage?: string;
    graduation?: string;
  };
}

export interface SharedChoiceView {
  id: string;
  label: string;
  statDelta?: SharedStats;
}

export interface SharedEventView {
  id: string;
  title: string;
  body: string;
  choices: SharedChoiceView[];
  source: string;
}

export interface SharedChoiceFeedbackView {
  statDelta: SharedStats;
  relationshipDelta: Array<{ name: string; trust: number }>;
  summary: string;
}

const STAT_LABELS: Record<string, string> = {
  academic: "학업",
  practical: "실무",
  health: "건강",
  mental: "멘탈",
  wealth: "자산",
  charm: "매력",
  reputation: "평판",
};

const STAT_ICONS: Record<string, string> = {
  academic: "BK",
  practical: "TL",
  health: "HP",
  mental: "MP",
  wealth: "CO",
  charm: "CH",
  reputation: "RP",
};

function statLevel(value: number) {
  return Math.max(1, Math.min(10, Math.round(value)));
}

function characterProgressLabel(character: SharedCharacterView | null) {
  if (!character) return "시작 전";
  if (character.progressLabel) return character.progressLabel;
  if (character.lifeStage?.term?.label) return character.lifeStage.term.label;
  return `${character.currentGradeYear ?? character.startGradeYear ?? 1}학년`;
}

function formatWealth(value: number) {
  return `${value}만원`;
}

function relationshipState(trust: number) {
  if (trust >= 80) return "연애";
  if (trust >= 45) return "호감";
  if (trust >= 10) return "우호";
  if (trust > -10) return "미묘";
  if (trust > -45) return "불신";
  if (trust > -80) return "적대";
  return "증오";
}

function trustHearts(trust: number) {
  const count = Math.max(1, Math.min(5, Math.ceil(Math.abs(trust) / 20)));
  return trust >= 0 ? "♥".repeat(count) : "💀".repeat(count);
}

function getEventScene(event: SharedEventView) {
  const text = `${event.title} ${event.body}`.toLowerCase();
  if (event.source === "FORCED" || text.includes("번아웃") || text.includes("건강") || text.includes("병원")) return "burnout";
  if (text.includes("코딩테스트") || text.includes("알고리즘") || text.includes("github") || text.includes("깃허브")) return "coding";
  if (text.includes("면접") || text.includes("인성검사") || text.includes("면접관")) return "interview";
  if (text.includes("서류") || text.includes("채용") || text.includes("회사") || text.includes("취업") || text.includes("합격")) return "job";
  if (text.includes("토익") || text.includes("토플") || text.includes("어학") || text.includes("자격증") || text.includes("공모전") || text.includes("포트폴리오") || text.includes("스펙")) return "spec";
  if (text.includes("인턴")) return "internship";
  if (text.includes("워홀") || text.includes("해외") || text.includes("유학") || text.includes("공항") || text.includes("교환학생")) return "overseas";
  if (text.includes("임용") || text.includes("회계사") || text.includes("로스쿨") || text.includes("변리사") || text.includes("국가고시") || text.includes("고시")) return "exam";
  if (text.includes("교수") || text.includes("연구실") || text.includes("추천서") || text.includes("대학원") || text.includes("석사") || text.includes("박사")) return "professor";
  if (text.includes("미대") || text.includes("작업실") || text.includes("음악") || text.includes("연습실") || text.includes("전시") || text.includes("공연") || text.includes("디자인")) return "art";
  if (text.includes("의대") || text.includes("간호") || text.includes("약대") || text.includes("실습") || text.includes("병동") || text.includes("환자")) return "medical";
  if (text.includes("법학") || text.includes("법학관") || text.includes("판례") || text.includes("리걸") || text.includes("소송")) return "law";
  if (text.includes("창업") || text.includes("스타트업") || text.includes("mvp") || text.includes("투자") || text.includes("사업")) return "startup";
  if (text.includes("동아리") || text.includes("모임") || text.includes("연애") || text.includes("고백") || text.includes("호감")) return "club";
  if (text.includes("카페") || text.includes("커피")) return "cafe";
  if (text.includes("운동") || text.includes("헬스") || text.includes("러닝") || text.includes("체육관")) return "exercise";
  if (text.includes("게임") || text.includes("취미") || text.includes("여가")) return "hobby";
  if (text.includes("가족") || text.includes("부모") || text.includes("본가") || text.includes("결혼") || text.includes("아이")) return "family";
  if (text.includes("돈") || text.includes("알바") || text.includes("월세") || text.includes("빚") || text.includes("생활비")) return "money";
  if (text.includes("식당") || text.includes("학식") || text.includes("점심")) return "cafeteria";
  if (text.includes("도서관") || text.includes("열람실")) return "library";
  if (text.includes("발표") || text.includes("프로젝트") || text.includes("mvp") || text.includes("앱")) return "project";
  if (text.includes("수업") || text.includes("강의실") || text.includes("시험") || text.includes("과제")) return "classroom";
  if (text.includes("자취") || text.includes("기숙사") || text.includes("방에서") || text.includes("침대")) return "home";
  return "campus";
}

function PixelScene({ scene, label }: { scene: string; label?: string }) {
  if (scene === "intro") {
    return (
      <div
        className="pixel-scene scene-intro"
        aria-label={label ?? "오전 6시 07분의 밝은 새벽 방 픽셀아트"}
        data-art-structure="dawn-room-window-phone-computer"
        data-palette="blue-lilac-apricot-cream"
        data-testid="pixel-scene-intro"
      >
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
    );
  }

  return (
    <div className={`pixel-scene scene-${scene}`} aria-label={label ?? "장면 삽화"}>
      <div className="scene-sky" />
      {scene === "transition" && (
        <>
          <div className="transition-cloud transition-cloud-a" />
          <div className="transition-cloud transition-cloud-b" />
          <div className="transition-lamp"><i /></div>
        </>
      )}
      <div className="scene-sun" />
      <div className="scene-building scene-building-left" />
      <div className="scene-building scene-building-right" />
      <div className="scene-desk" />
      <div className="scene-screen" />
      <div className="scene-paper scene-paper-a" />
      <div className="scene-paper scene-paper-b" />
      <div className="scene-spark scene-spark-a" />
      <div className="scene-spark scene-spark-b" />
      <div className="scene-person">
        <div className="scene-head" />
        <div className="scene-body" />
      </div>
    </div>
  );
}

function PixelPortrait({ name, compact = false, large = false, variant }: { name?: string; compact?: boolean; large?: boolean; variant?: string }) {
  const refName = variant || name || "";
  const initial = refName.trim().slice(0, 1) || "?";

  let variantClass = "";
  if (refName.includes("지민 선배") || refName.includes("지민")) variantClass = "variant-jimin";
  else if (refName.includes("민하")) variantClass = "variant-minha";
  else if (refName.includes("서연")) variantClass = "variant-seoyeon";
  else if (refName.includes("부모님")) variantClass = "variant-parents";
  else if (refName.includes("상혁") || refName.includes("교수")) variantClass = "variant-professor";
  else if (refName.includes("도윤")) variantClass = "variant-doyoon";
  else if (refName.includes("현우")) variantClass = "variant-hyunwoo";
  else if (refName.includes("은지")) variantClass = "variant-eunji";
  else if (refName.includes("재석")) variantClass = "variant-jaeseok";
  else if (refName.includes("수진")) variantClass = "variant-sujin";
  else if (refName.includes("유진")) variantClass = "variant-yujin";
  else if (refName.includes("준호")) variantClass = "variant-junho";
  else if (refName.includes("동규")) variantClass = "variant-donggyu";
  else if (refName.includes("노인")) variantClass = "variant-oldman";
  else if (refName.includes("중개자")) variantClass = "variant-broker";
  else if (refName.includes("태수")) variantClass = "variant-taesu";
  else if (refName.includes("혜진")) variantClass = "variant-hyejin";
  else if (refName.includes("명수")) variantClass = "variant-myeongsu";
  else if (refName.includes("상혁")) variantClass = "variant-sanghyuk";
  else if (refName.includes("조교")) variantClass = "variant-assistant";
  else if (refName.includes("동기")) variantClass = "variant-peer";
  else if (refName.includes("선배")) variantClass = "variant-senior";
  else if (refName.includes("면접")) variantClass = "variant-interviewer";
  else if (refName.includes("사장") || refName.includes("대표")) variantClass = "variant-founder";
  else if (refName.includes("가족") || refName.includes("부모")) variantClass = "variant-parents";
  else if (refName.includes("해외") || refName.includes("emma") || refName.includes("엠마")) variantClass = "variant-overseas";

  return (
    <div className={`pixel-portrait ${compact ? "pixel-portrait-compact" : ""} ${large ? "pixel-portrait-large" : ""} ${variantClass}`}>
      <div className="portrait-backdrop" />
      <div className="portrait-hair" />
      <div className="portrait-face">
        <span className="portrait-eye portrait-eye-left" />
        <span className="portrait-eye portrait-eye-right" />
        <span className="portrait-cheek portrait-cheek-left" />
        <span className="portrait-cheek portrait-cheek-right" />
        <span className="portrait-mouth" />
        <span className="portrait-initial">{initial}</span>
      </div>
      <div className="portrait-collar" />
      <div className="portrait-body" />
    </div>
  );
}

function statDeltaText(delta: SharedStats) {
  const entries = Object.entries(delta).filter(([, value]) => value !== 0);
  if (entries.length === 0) return "변화 없음";
  return entries.map(([key, value]) => `${STAT_LABELS[key] ?? key} ${value > 0 ? "+" : ""}${value}`).join(" · ");
}

export function LoadingPanel() {
  return (
    <div className="event-loading-panel" aria-busy="true" aria-live="polite" data-reduced-motion={useReducedMotion() ? "true" : "false"}>
      <div className="event-loading-scene" aria-hidden="true">
        <i className="loading-cloud loading-cloud-a" />
        <i className="loading-cloud loading-cloud-b" />
        <span className="loading-building"><i /><i /><i /></span>
        <span className="loading-lamp"><i /></span>
      </div>
      <div className="event-loading-copy">
        <span className="event-loading-badge">새 장면</span>
        <p>당신이 모르는 곳에서,</p>
        <p>다음 일이 시작되고 있습니다<span className="loading-dots"><i>.</i><i>.</i><i>.</i></span></p>
        <small>선택의 시간이 곧 찾아옵니다.</small>
      </div>
    </div>
  );
}

function useReducedMotion() {
  const media = typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;
  return Boolean(media?.matches);
}

export function PlaySurface({
  currentCharacter,
  currentEvent,
  feedback,
  loading,
  pendingNext = false,
  endingNotice = "",
  onChoose,
  onContinueToNextEvent,
  onShowLatestRecord,
  onStartNewCharacter,
  endingActions,
}: {
  currentCharacter: SharedCharacterView | null;
  currentEvent: SharedEventView | null;
  feedback: SharedChoiceFeedbackView | null;
  loading: boolean;
  pendingNext?: boolean;
  endingNotice?: string;
  onChoose(choiceIndex: number): void;
  onContinueToNextEvent?(): void;
  onShowLatestRecord?(): void;
  onStartNewCharacter?(): void;
  endingActions?: ReactNode;
}) {
  return (
    <section className="screen-stack">
      {currentCharacter && (
        <>
          <div className="play-status-strip mb-4">
            <span>{characterProgressLabel(currentCharacter)}</span>
            <span>{currentCharacter.major ?? "전공 미정"}</span>
            <span>{formatWealth(currentCharacter.stats?.wealth ?? 0)}</span>
          </div>
          <div className="stats-grid">
            {Object.entries(currentCharacter.stats).map(([key, value]) => (
              <span key={key}><b>{STAT_LABELS[key] ?? key}</b>{key === "wealth" ? formatWealth(value) : value}</span>
            ))}
          </div>
        </>
      )}
      {feedback && (
        <div className="feedback-panel">
          <strong>{statDeltaText(feedback.statDelta)}</strong>
          <p>{feedback.summary}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(feedback.statDelta).map(([key, delta]) => (
              <span
                className={`border-2 px-2 py-1 text-xs font-bold ${delta > 0 ? "border-[#305d73] bg-[#d5edf6] text-[#244c5e]" : "border-[#b3423c] bg-[#ffe1db] text-[#7b2d29]"}`}
                key={key}
              >
                {STAT_LABELS[key] ?? key} {key === "wealth" ? `${delta > 0 ? "+" : ""}${delta}만원` : `${delta > 0 ? "+" : ""}${delta}`}
              </span>
            ))}
            {feedback.relationshipDelta.map((rel) => (
              <span
                className={`border-2 px-2 py-1 text-xs font-bold ${rel.trust > 0 ? "border-[#a53f66] bg-[#ffe1ec] text-[#842b50]" : "border-[#2b3348] bg-[#dce2f5] text-[#26304a]"}`}
                key={`${rel.name}-${rel.trust}`}
              >
                {rel.name} {rel.trust > 0 ? "♥+" : "💀"}{rel.trust}
              </span>
            ))}
          </div>
        </div>
      )}

      {endingNotice && (
        <div className="ending-splash pixel-panel mb-5 overflow-hidden border-[#b3423c] bg-[#ffe1db] text-[#6f211d]">
          <div className="grid grid-cols-[180px_minmax(0,1fr)] gap-5 p-5 max-[640px]:grid-cols-1">
            <div className="ending-splash-art">
              <div className="record-poster poster-red">
                <div className="poster-rays" />
                <div className="poster-art">
                  <PixelPortrait name="선택의 결과" large />
                </div>
                <div className="poster-road" />
              </div>
            </div>
            <div>
              <p className="text-xs font-black text-[#8a4f2d]">RESULT UNLOCKED</p>
              <p className="mt-1 text-2xl font-black">선택의 결과</p>
              <p className="mt-2 text-sm leading-6">{endingNotice}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {onShowLatestRecord && <button className="pixel-button-dark px-4 py-2 text-sm font-bold" onClick={onShowLatestRecord}>결과 바로 보기</button>}
                {onStartNewCharacter && <button className="pixel-button px-4 py-2 text-sm font-bold" onClick={onStartNewCharacter}>새로 시작하기</button>}
              </div>
              {endingActions}
            </div>
          </div>
        </div>
      )}

      {!currentEvent && !endingNotice && (loading || pendingNext) && <LoadingPanel />}

      {currentEvent && (
        <>
          <article className="event-panel pixel-panel overflow-hidden">
            <div className="grid grid-cols-[220px_minmax(0,1fr)] max-[720px]:grid-cols-1">
              <PixelScene scene={getEventScene(currentEvent)} label={currentEvent.title} />
              <div className="p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="border-2 border-[#2a2018] bg-[#f7d08b] px-2 py-1 text-xs font-black text-[#2a2018]">
                    {currentEvent.source === "FORCED" ? "긴급 상황" : currentEvent.source === "AI" ? "새 장면" : "오늘의 사건"}
                  </span>
                  <h2 className="text-xl font-black leading-tight text-[#2a241e]">{currentEvent.title}</h2>
                </div>
                <div className="novel-text text-lg tracking-normal max-[900px]:text-[16px]">
                  {currentEvent.body.split("\n").map((paragraph, index) => (
                    <p className="mt-3 first:mt-0" key={index}>{paragraph}</p>
                  ))}
                </div>
                <div className="choice-stack mt-7 grid gap-3">
                  {currentEvent.choices.map((choice, index) => (
                    <button className="choice-button pixel-button grid min-h-12 grid-cols-[32px_minmax(0,1fr)] items-center gap-3 px-4 py-3.5 text-left text-[15px] disabled:opacity-50" disabled={loading} key={choice.id} onClick={() => onChoose(index)}>
                      <span className="choice-index">{index + 1}</span>
                      <span>{choice.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </article>
        </>
      )}

      {!currentEvent && !endingNotice && !loading && !pendingNext && onContinueToNextEvent && (
        <div
          className="pixel-panel cursor-pointer p-8 text-center"
          onClick={onContinueToNextEvent}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onContinueToNextEvent();
            }
          }}
        >
          <p className="text-lg leading-8 text-[#3a332d]">
            {pendingNext ? "다음 상황을 준비 중입니다." : "새 상황을 준비 중입니다."}
          </p>
        </div>
      )}
    </section>
  );
}

export function CharacterSheet({ character }: { character: SharedCharacterView }) {
  return (
    <section className="mx-auto max-w-[760px]">
      <h2 className="screen-title text-xl font-black">캐릭터 상세</h2>
      <div className="character-sheet pixel-panel mt-4 overflow-hidden">
        <div className="character-portrait-stage">
          <PixelPortrait name={character.name} large />
        </div>
        <div className="character-sheet-body p-5">
          <p className="text-xs font-black text-[#8a4f2d]">CURRENT STUDENT FILE</p>
          <h3 className="mt-1 text-2xl font-black leading-tight">{character.name}</h3>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm max-[520px]:grid-cols-1">
            <p className="profile-chip"><strong>이름:</strong> {character.name}</p>
            <p className="profile-chip"><strong>전공:</strong> {character.major}</p>
            <p className="profile-chip"><strong>학사 진행:</strong> {character.progressLabel ?? character.lifeStage?.term?.label ?? `${character.currentGradeYear ?? character.startGradeYear ?? 1}학년 1학기`}</p>
            <p className="profile-chip"><strong>나이:</strong> {character.age}세</p>
            <p className="profile-chip"><strong>학적:</strong> {character.academicStatus}</p>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 max-[520px]:grid-cols-1">
            {Object.entries(STAT_LABELS).map(([key, label]) => (
              <div className="stat-card" key={key}>
                <div className="flex items-center justify-between gap-2">
                  <span><span className="mr-1 text-xs text-[#8a4f2d]">{STAT_ICONS[key]}</span>{label}</span>
                  <strong>{key === "wealth" ? formatWealth(character.stats?.[key] ?? 0) : `${statLevel(character.stats?.[key] ?? 0)}/10`}</strong>
                </div>
                {key !== "wealth" && (
                  <div className="mt-2 h-2 border-2 border-[#2a2018] bg-[#e2d7c8]">
                    <div className="h-full bg-[#2f7a84]" style={{ width: `${statLevel(character.stats?.[key] ?? 0) * 10}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function RelationshipsSheet({ character }: { character: SharedCharacterView }) {
  return (
    <section className="mx-auto max-w-[760px]">
      <h2 className="screen-title text-xl font-black">관계</h2>
      <div className="relationship-grid mt-4 grid gap-3">
        {character.relationships?.map((rel) => (
          <div className="relationship-card pixel-panel flex items-start gap-4 p-4" key={rel.name}>
            <PixelPortrait name={rel.name} variant={rel.name} large />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3 max-[520px]:block">
                <span className="text-lg font-black">{rel.name}</span>
                <span className="text-sm text-[#706b62]">{rel.role}</span>
              </div>
              <div className="mt-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-[#8a4f2d]">{relationshipState(rel.trust)}</span>
                  <span className="font-bold">{trustHearts(rel.trust)}</span>
                </div>
                <div className="relationship-meter mt-2 h-3 border-2 border-[#2a2018] bg-[#d8c8b4]">
                  <div
                    className={`${rel.trust >= 0 ? "bg-[#d85f87]" : "bg-[#3f5f9f]"} h-full`}
                    style={{ width: `${Math.min(100, Math.abs(rel.trust))}%` }}
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {(rel.tags ?? []).map((tag) => (
                  <span className="relation-tag border-2 border-[#2a2018] bg-[#efe5d7] px-2 py-1 text-xs text-[#68412b]" key={tag}>{tag}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
        {(!character.relationships || character.relationships.length === 0) && (
          <div className="pixel-panel empty-relationship p-6 text-center">
            <PixelPortrait name="?" large />
            <p className="mt-3 text-sm text-[#706b62]">아직 관계 정보가 없습니다.</p>
          </div>
        )}
      </div>
    </section>
  );
}

export interface RecordCardShellProps {
  className?: string;
  expanded: boolean;
  id: string;
  onToggle?: () => void;
  poster?: ReactNode;
  preview?: string;
  summary?: string;
  title: string;
  children?: ReactNode;
}

export function RecordCardShell({
  className,
  expanded,
  id,
  onToggle,
  poster,
  preview,
  summary,
  title,
  children,
}: RecordCardShellProps) {
  const content = (
    <div className="p-4">
      <div className="text-xs font-black text-[#8a4f2d]">SELECTED ENDING</div>
      <h3 className="mt-1 block text-xl font-black">{title}</h3>
      {summary && <p className="mt-2 text-sm leading-6 text-[#706b62]">{summary}</p>}
      {preview && !expanded && <p className="mt-2 text-sm leading-6 text-[#706b62]">{preview}</p>}
    </div>
  );

  if (onToggle) {
    return (
      <article className={className} id={id}>
        <button className="w-full text-left" type="button" onClick={onToggle}>
          {poster}
          {content}
        </button>
        {expanded && children}
      </article>
    );
  }

  return (
    <article className={className} id={id}>
      <div className="w-full text-left">
        {poster}
        {content}
      </div>
      {expanded && children}
    </article>
  );
}

export interface RecordShareActionsProps {
  recordId: string;
  onCopyLink: (recordId: string) => void | Promise<void>;
  onSaveImage?: (recordId: string) => void | Promise<void>;
  wrapperClassName?: string;
  copyButtonClassName?: string;
}

export function RecordShareActions({
  recordId,
  onCopyLink,
  onSaveImage,
  wrapperClassName,
  copyButtonClassName,
}: RecordShareActionsProps) {
  return (
    <div className={wrapperClassName ?? "mt-3 flex flex-wrap gap-2"}>
      <button className={copyButtonClassName ?? "pixel-button-dark px-3 py-2 text-xs font-bold"} type="button" onClick={() => void onCopyLink(recordId)}>🔗 링크 복사</button>
      {onSaveImage && <button className={copyButtonClassName ?? "pixel-button px-3 py-2 text-xs font-bold"} type="button" onClick={() => void onSaveImage(recordId)}>이미지 저장</button>}
    </div>
  );
}

export const ENDING_SHARE_COPY_FAILURE_MESSAGE = "링크를 만들지 못했습니다. 다시 시도해 주세요.";

type ShareHost = Pick<GameHost, "sharing" | "clipboard">;

export async function copyEndingShareLink(
  host: ShareHost,
  recordId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const link = await host.sharing.createEndingShareLink(recordId);
    await host.clipboard.copy(link);
    return { ok: true };
  } catch {
    return { ok: false, message: ENDING_SHARE_COPY_FAILURE_MESSAGE };
  }
}
