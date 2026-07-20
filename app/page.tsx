"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import type { CareerEndingRecord } from "@prisma/client";
import { EndingArt, getEndingArtType } from "@/lib/game/ending-art";
import { CODEX_CATALOG, type CodexSlot } from "@/lib/game/codex-catalog";
import { deriveCodexState, type CodexState } from "@/lib/game/derive-codex-state";
import { CodexGrid } from "@/app/components/codex/CodexGrid";
import { CodexDetailModal } from "@/app/components/codex/CodexDetailModal";

type Screen = "auth" | "create" | "play" | "records" | "character_detail" | "relationships";

interface CharacterData {
  id: string;
  name: string;
  age: number;
  startGradeYear: number;
  currentGradeYear: number | null;
  major: string;
  academicStatus: string;
  stats: Record<string, number>;
  relationships: { name: string; role: string; trust: number; tags: string[] }[];
  eventHistory: { summary: string; createdAt: string }[];
  currentEventId: string | null;
  coreEventCount: number;
  progressLabel?: string;
  lifeStage?: {
    term?: { label?: string };
    lifeStage?: string;
    graduation?: string;
  };
  events?: EventData[];
}

interface EventData {
  id: string;
  title: string;
  body: string;
  choices: { id: string; label: string; statDelta: Record<string, number> }[];
  source: string;
  forced?: boolean;
}

interface ChoiceFeedback {
  statDelta: Record<string, number>;
  relationshipDelta: { name: string; trust: number }[];
  summary: string;
}

type AudioSettings = {
  music: boolean;
  sfx: boolean;
  haptics: boolean;
};

type AudioKind = "tap" | "success" | "warning" | "ending";
type CreateStep = "intro" | "name" | "age" | "residence" | "abilities";

type BrowserAudioContext = typeof AudioContext;

function safelyPlay(audio: HTMLAudioElement) {
  const play = audio.play;
  if (typeof play !== "function") return;
  try {
    void Promise.resolve(play.call(audio)).catch(() => undefined);
  } catch {
    // Unsupported or permission-blocked audio is a non-blocking no-op.
  }
}

function safelyPause(audio: HTMLAudioElement) {
  const pause = audio.pause;
  if (typeof pause !== "function") return;
  try {
    pause.call(audio);
  } catch {
    // Unsupported media controls are a non-blocking no-op.
  }
}

function safelyVibrate(pattern: number | number[]) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Optional WebView haptics are a non-blocking enhancement.
  }
}

const statLabels: Record<string, string> = {
  academic: "학업",
  practical: "실무",
  health: "건강",
  mental: "멘탈",
  wealth: "자산",
  charm: "매력",
  reputation: "평판",
};

const statIcons: Record<string, string> = {
  academic: "BK",
  practical: "TL",
  health: "HP",
  mental: "MP",
  wealth: "CO",
  charm: "CH",
  reputation: "RP",
};

const residenceOptions = [
  { id: "family_home", label: "본가", description: "가족의 규칙과 지원 사이에서 하루가 시작됩니다." },
  { id: "studio", label: "자취방", description: "혼자 버티는 자유와 생활비의 압박이 함께 옵니다." },
  { id: "dorm", label: "기숙사", description: "타인의 생활 리듬과 우연한 관계가 가까이 있습니다." },
];

function statLevel(value: number) {
  return Math.max(1, Math.min(10, Math.round(value)));
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

function getEventScene(event: EventData) {
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

function getChoiceFeedbackTone(feedback: ChoiceFeedback) {
  const deltas = Object.entries(feedback.statDelta);
  if (deltas.some(([key, delta]) => (key === "health" || key === "mental") && delta < 0)) return "warning";
  if (feedback.relationshipDelta.some((rel) => rel.trust > 0)) return "relationship";
  if (deltas.some(([key, delta]) => key === "wealth" && delta > 0)) return "money";
  if (deltas.some(([key, delta]) => (key === "academic" || key === "practical" || key === "reputation") && delta > 0)) return "growth";
  return "default";
}

function getRecordTone(record: Record<string, unknown>) {
  const satisfaction = Number(record.satisfaction ?? 0);
  if (satisfaction >= 70) return "gold";
  if (satisfaction >= 40) return "blue";
  return "red";
}

function getAcademicProgressLabel(character: CharacterData | null) {
  if (!character) return "학사 상태";
  if (character.progressLabel) return character.progressLabel;
  if (character.lifeStage?.graduation === "extra_semester") return "추가학기";
  if (character.lifeStage?.graduation === "delayed") return "졸업 유예";
  if (character.lifeStage?.graduation === "gate_ready" && character.lifeStage.term?.label) {
    return `${character.lifeStage.term.label} · 졸업요건 점검`;
  }
  if (character.lifeStage?.lifeStage === "leave" || character.academicStatus === "LEAVE") return "휴학";
  if (character.lifeStage?.lifeStage === "dropout" || character.academicStatus === "DROPPED_OUT") return "자퇴";
  if (character.lifeStage?.lifeStage === "post_graduation" || character.academicStatus === "GRADUATED") return "졸업";
  if (character.lifeStage?.term?.label) return character.lifeStage.term.label;
  return `${character.currentGradeYear ?? character.startGradeYear}학년 1학기`;
}

function formatAcademicStatus(status: string) {
  if (status === "ENROLLED") return "재학";
  if (status === "LEAVE") return "휴학";
  if (status === "DROPPED_OUT") return "자퇴";
  if (status === "GRADUATED") return "졸업";
  return status;
}

function isCompletedRun(character: CharacterData | null) {
  if (!character) return false;
  return !character.currentEventId && character.academicStatus === "GRADUATED";
}

function stripRouteGradeText(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .replace(/\b(?:GOOD|MIXED|HARD)\s+ROUTE\b/gi, "")
    .replace(/[ABC]등급/g, "")
    .replace(/\b[ABC]\b/g, "")
    .replace(/(학점|학업|지식|실무|실무력|건강|멘탈|정신|자산|돈|평판|명성|매력|네트워크|관계|academic|practical|health|mental|wealth|reputation|charm|network)\s*(?:수치|점수|스탯|stat)?\s*(?:은|는|이|가|의)?\s*[:：]?\s*(?:10|[0-9])\b/gi, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function recordText(record: Record<string, unknown>, key: string, fallback = "") {
  return stripRouteGradeText(record[key]) || fallback;
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
    <div className={`pixel-portrait ${compact ? "pixel-portrait-compact" : ""} ${large ? "pixel-portrait-large" : ""} ${variantClass}`} aria-hidden="true">
      <div className="portrait-backdrop" />
      <div className="portrait-hair" />
      <div className="portrait-face">
        <i className="portrait-eye portrait-eye-left" />
        <i className="portrait-eye portrait-eye-right" />
        <i className="portrait-cheek portrait-cheek-left" />
        <i className="portrait-cheek portrait-cheek-right" />
        <i className="portrait-mouth" />
        <span className="portrait-initial">{initial}</span>
      </div>
      <div className="portrait-collar" />
      <div className="portrait-body" />
    </div>
  );
}

function ChoiceResultArt({ tone }: { tone: string }) {
  return (
    <div className={`choice-result-art result-${tone}`} aria-hidden="true">
      <div className="result-burst" />
      <div className="result-icon result-icon-a" />
      <div className="result-icon result-icon-b" />
      <div className="result-character">
        <div className="result-head" />
        <div className="result-body" />
      </div>
    </div>
  );
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

function RecordPoster({ record }: { record: Record<string, unknown> }) {
  const tone = getRecordTone(record);
  const careerPath = recordText(record, "careerPath", "");
  const tags = (record.tags as string[]) ?? [];
  const artType = getEndingArtType(careerPath, tags);

  return (
    <div className={`record-poster poster-${tone}`} aria-hidden="true">
      <div className="poster-rays" />
      <div className="poster-art">
        <EndingArt type={artType} size={140} />
      </div>
      <div className="poster-road" />
    </div>
  );
}

export default function AppPage() {
  const { status } = useSession();
  const [screen, setScreen] = useState<Screen>("create");
  const [currentChar, setCurrentChar] = useState<CharacterData | null>(null);
  const [currentEvent, setCurrentEvent] = useState<EventData | null>(null);
  const [streamingEventBody, setStreamingEventBody] = useState("");
  const [streamingNextEvent, setStreamingNextEvent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [recordsTab, setRecordsTab] = useState<"records" | "codex">("records");
  const [selectedSlot, setSelectedSlot] = useState<CodexSlot | null>(null);
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [pendingNext, setPendingNext] = useState(false);
  const [endingNotice, setEndingNotice] = useState("");
  const [latestRecordId, setLatestRecordId] = useState<string | null>(null);
  const [choiceFeedback, setChoiceFeedback] = useState<ChoiceFeedback | null>(null);
  const [mobileStatsOpen, setMobileStatsOpen] = useState(false);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>({ music: false, sfx: true, haptics: true });
  const [audioReady, setAudioReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const musicTimerRef = useRef<number | null>(null);
  const musicStepRef = useRef(0);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const loadedAudioSettingsRef = useRef(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuPanelRef = useRef<HTMLDivElement | null>(null);
  const menuWasOpenedRef = useRef(false);

  const careerRecords = useMemo(() => records as unknown as CareerEndingRecord[], [records]);
  const codexState: CodexState = useMemo(() => deriveCodexState(careerRecords, CODEX_CATALOG), [careerRecords]);
  const selectedSlotState = selectedSlot ? codexState.slots.find((s) => s.slot.id === selectedSlot.id) ?? null : null;
  const selectedSlotRecordSample = selectedSlot
    ? careerRecords.find((r) => CODEX_CATALOG.some((slot) => slot.id === selectedSlot.id && slot.matches(r))) ?? null
    : null;

  const [specs, setSpecs] = useState<{ specType: string; specName: string; status: string; score?: string }[]>([]);
  const [jobApps, setJobApps] = useState<{ companyName: string; currentStage: string; isActive: boolean }[]>([]);
  const [careerPaths, setCareerPaths] = useState<{ pathType: string; pathName: string; status: string }[]>([]);

  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  const [charName, setCharName] = useState("");
  const [charAge, setCharAge] = useState("21");
  const [charResidence, setCharResidence] = useState("");
  const [preferredStats, setPreferredStats] = useState<string[]>([]);
  const [createStep, setCreateStep] = useState<CreateStep>("intro");

  const mountedRef = useRef(false);
  const activeScreen = screen;

  const stopMusic = useCallback(() => {
    if (musicTimerRef.current !== null) {
      window.clearInterval(musicTimerRef.current);
      musicTimerRef.current = null;
    }
    if (bgmAudioRef.current) {
      safelyPause(bgmAudioRef.current);
      bgmAudioRef.current.currentTime = 0;
    }
  }, []);

  const ensureAudio = useCallback(async () => {
    if (typeof window === "undefined") return null;
    const AudioCtor = (window.AudioContext || (window as typeof window & { webkitAudioContext?: BrowserAudioContext }).webkitAudioContext);
    if (!AudioCtor) return null;

    if (!audioContextRef.current) {
      const context = new AudioCtor();
      const master = context.createGain();
      const music = context.createGain();
      master.gain.value = 0.9;
      music.gain.value = 0.36;
      music.connect(master);
      master.connect(context.destination);
      audioContextRef.current = context;
      masterGainRef.current = master;
      musicGainRef.current = music;
    }

    if (audioContextRef.current.state === "suspended") {
      try {
        await audioContextRef.current.resume();
        // WebView 오디오 언락: 무음 버퍼를 재생해 AudioContext를 완전히 활성화
        const silent = audioContextRef.current.createBuffer(1, 1, 44100);
        const src = audioContextRef.current.createBufferSource();
        src.buffer = silent;
        src.connect(audioContextRef.current.destination);
        src.start(0);
      } catch {
        // WebView가 resume을 거부한 경우, 새 컨텍스트로 재시도
        audioContextRef.current = null;
        masterGainRef.current = null;
        musicGainRef.current = null;
        return null;
      }
    }

    setAudioReady(audioContextRef.current?.state === "running");
    return audioContextRef.current;
  }, []);

  const pulseHaptic = useCallback((kind: AudioKind) => {
    if (!audioSettings.haptics) return;
    const pattern: Record<AudioKind, number | number[]> = {
      tap: 12,
      success: [18, 28, 18],
      warning: [32, 24, 32],
      ending: [24, 32, 24, 48, 36],
    };
    safelyVibrate(pattern[kind]);
  }, [audioSettings.haptics]);

  const playSound = useCallback(async (kind: AudioKind) => {
    if (!audioSettings.sfx) return;
    const context = await ensureAudio();
    const master = masterGainRef.current;
    if (!context || !master) return;

    const now = context.currentTime;
    const shape: Record<AudioKind, { notes: number[]; duration: number; gain: number; type: OscillatorType }> = {
      tap: { notes: [440], duration: 0.06, gain: 0.08, type: "square" },
      success: { notes: [523.25, 659.25, 783.99], duration: 0.11, gain: 0.07, type: "triangle" },
      warning: { notes: [196, 164.81], duration: 0.14, gain: 0.08, type: "sawtooth" },
      ending: { notes: [261.63, 329.63, 392, 523.25], duration: 0.18, gain: 0.075, type: "triangle" },
    };

    shape[kind].notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = shape[kind].type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, now + index * 0.06);
      gain.gain.linearRampToValueAtTime(shape[kind].gain, now + index * 0.06 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.06 + shape[kind].duration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(now + index * 0.06);
      oscillator.stop(now + index * 0.06 + shape[kind].duration + 0.03);
    });
  }, [audioSettings.sfx, ensureAudio]);

  const playFeedbackCue = useCallback((kind: AudioKind) => {
    pulseHaptic(kind);
    void playSound(kind);
  }, [playSound, pulseHaptic]);

  const startMusic = useCallback(async (force = false) => {
    if ((!force && !audioSettings.music) || document.visibilityState === "hidden") return;
    if (bgmAudioRef.current) {
      bgmAudioRef.current.currentTime = 0;
      bgmAudioRef.current.volume = 0.36;
      bgmAudioRef.current.loop = true;
      safelyPlay(bgmAudioRef.current);
      return;
    }
    const audio = new Audio("/bgm.mp3");
    audio.volume = 0.36;
    audio.loop = true;
    bgmAudioRef.current = audio;
    safelyPlay(audio);
  }, [audioSettings.music]);

  const updateAudioSetting = useCallback((key: keyof AudioSettings, value: boolean) => {
    setAudioSettings((current) => ({ ...current, [key]: value }));
    if (key === "music" && value) {
      stopMusic();
      void startMusic(true);
    }
    if (key === "music" && !value) {
      stopMusic();
    }
    if ((key === "sfx" || key === "haptics") && value) {
      playFeedbackCue("tap");
    }
  }, [ensureAudio, playFeedbackCue, startMusic, stopMusic]);

  async function doFetch(url: string, method = "GET", body?: unknown) {
    const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const requestUrl = typeof window === "undefined" ? url : new URL(url, window.location.origin).toString();
    const res = await fetch(requestUrl, opts);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  async function loadCharacters() {
    setLoading(true);
    try {
      const { ok, data } = await doFetch("/api/characters");
      if (ok) {
        const loadedCharacters = data.characters ?? [];
        if (!currentChar && loadedCharacters.length > 0) {
          await resumeCharacter(loadedCharacters[0]);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadCharacterEvent(charId: string) {
    const { ok, data } = await doFetch(`/api/characters/${charId}`);
    if (ok) {
      setCurrentChar(data.character ?? null);
      setCurrentEvent(data.currentEvent ?? null);
    }
  }

  async function loadSpecData(charId: string) {
    const [specsRes, jobAppsRes, pathsRes] = await Promise.all([
      doFetch(`/api/characters/${charId}/specs`),
      doFetch(`/api/characters/${charId}/job-applications`),
      doFetch(`/api/characters/${charId}/career-paths`),
    ]);
    if (specsRes.ok) setSpecs(Array.isArray(specsRes.data) ? specsRes.data : specsRes.data?.specs ?? []);
    if (jobAppsRes.ok) setJobApps(Array.isArray(jobAppsRes.data) ? jobAppsRes.data : jobAppsRes.data?.jobApplications ?? []);
    if (pathsRes.ok) setCareerPaths(Array.isArray(pathsRes.data) ? pathsRes.data : pathsRes.data?.careerPaths ?? []);
  }

  async function fetchNextEvent(charId: string, options: { preserveFeedback?: boolean } = {}) {
    if (!options.preserveFeedback) {
      setChoiceFeedback(null);
    }
    setStreamingEventBody("");
    setStreamingNextEvent(true);
    setLoading(true);
    try {
      const streamed = await fetchNextEventStream(charId);
      if (!streamed) {
        // 스트림 실패: AI 생성이 완료됐는데 SSE만 끊겼을 수 있음 → DB 먼저 확인
        const { ok, data } = await doFetch(`/api/characters/${charId}`);
        if (ok && data.currentEvent) {
          setCurrentEvent(data.currentEvent);
        } else {
          // 진짜로 생성된 이벤트가 없을 때만 fallback
          const { ok: ok2, data: data2 } = await doFetch(`/api/characters/${charId}/events/next`, "POST");
          if (ok2) setCurrentEvent(data2.event);
        }
      }
      await loadCharacterEvent(charId);
      await loadSpecData(charId);
      setPendingNext(false);
    } finally {
      setStreamingEventBody("");
      setStreamingNextEvent(false);
      setLoading(false);
    }
  }

  async function fetchNextEventStream(charId: string) {
    const response = await fetch(`/api/characters/${charId}/events/next/stream`, {
      method: "POST",
      headers: { Accept: "text/event-stream" },
    }).catch(() => null);
    if (!response?.ok || !response.body) return false;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let receivedFinalEvent = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const messages = buffer.split("\n\n");
      buffer = messages.pop() ?? "";

      for (const message of messages) {
        const eventName = message.split("\n").find((line) => line.startsWith("event:"))?.slice(6).trim();
        const dataLine = message.split("\n").find((line) => line.startsWith("data:"));
        if (!eventName || !dataLine) continue;
        const payload = JSON.parse(dataLine.slice(5).trim());
        if (eventName === "body_delta" && typeof payload.text === "string") {
          setStreamingEventBody((current) => current + payload.text);
        }
        if (eventName === "replace_body" && typeof payload.text === "string") {
          setStreamingEventBody(payload.text);
        }
        if (eventName === "status") {
          setStreamingNextEvent(true);
        }
        if (eventName === "event" && payload.event) {
          setCurrentEvent(payload.event);
          receivedFinalEvent = true;
        }
        if (eventName === "error") {
          setError(payload.error ?? "다음 상황을 생성하지 못했습니다.");
        }
      }
    }

    return receivedFinalEvent;
  }

  const handleSignup = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const email = authEmail.trim().toLowerCase();
      const { ok, data } = await doFetch("/api/auth/signup", "POST", {
        email,
        password: authPassword,
      });
      if (!ok) {
        setError(data.error || "회원가입에 실패했습니다.");
        return;
      }
      const res = await signIn("credentials", { email, password: authPassword, redirect: false });
      if (!res?.ok) {
        setAuthMode("login");
        setError("회원가입은 완료됐지만 자동 로그인에 실패했습니다. 다시 로그인해 주세요.");
        return;
      }
      await loadCharacters();
      setScreen("create");
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [authEmail, authPassword]);

  const handleLogin = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", { email: authEmail.trim().toLowerCase(), password: authPassword, redirect: false });
      if (!res?.ok) {
        setError("이메일 또는 비밀번호가 일치하지 않습니다.");
        return;
      }
      await loadCharacters();
      setScreen("create");
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [authEmail, authPassword]);

  useEffect(() => {
    if (status === "loading") return;
    if (mountedRef.current) return;
    mountedRef.current = true;
    loadCharacters();
  }, [status]);

  // 앤입토스 뒤로가기 제스처 차단
  useEffect(() => {
    history.pushState(null, "", location.href);
    const handlePopState = () => {
      history.pushState(null, "", location.href);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("sano-audio-settings");
    if (!saved) {
      loadedAudioSettingsRef.current = true;
      return;
    }
    try {
        const parsed = JSON.parse(saved) as Partial<AudioSettings>;
        if (!parsed || typeof parsed !== "object" || typeof parsed.music !== "boolean" || typeof parsed.sfx !== "boolean" || typeof parsed.haptics !== "boolean") {
          throw new Error("Invalid audio settings");
        }
        queueMicrotask(() => setAudioSettings({
          music: parsed.music!,
          sfx: parsed.sfx!,
          haptics: parsed.haptics!,
        }));
      } catch {
        window.localStorage.removeItem("sano-audio-settings");
      } finally {
        loadedAudioSettingsRef.current = true;
      }
  }, []);

  useEffect(() => {
    if (!loadedAudioSettingsRef.current) return;
    window.localStorage.setItem("sano-audio-settings", JSON.stringify(audioSettings));
  }, [audioSettings]);

  useEffect(() => {
    if (menuOpen) {
      menuWasOpenedRef.current = true;
      menuPanelRef.current?.querySelector<HTMLElement>("button, a, input")?.focus();
    } else if (menuWasOpenedRef.current) {
      menuButtonRef.current?.focus();
    }
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  useEffect(() => {
    if (audioSettings.music) {
      void startMusic();
    } else {
      stopMusic();
    }
  }, [audioSettings.music, startMusic, stopMusic]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopMusic();
      } else if (audioSettings.music) {
        void startMusic();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopMusic();
    };
  }, [audioSettings.music, startMusic, stopMusic]);

  const createCharacter = useCallback(async () => {
    setError("");
    setLoading(true);
    playFeedbackCue("tap");
    try {
      const { ok, data } = await doFetch("/api/characters", "POST", {
        name: charName.trim(),
        age: Number(charAge),
        residence: charResidence,
        preferredStats,
      });
      if (!ok) {
        setError(data.error || "캐릭터 생성에 실패했습니다.");
        return;
      }
      setCurrentChar(data.character);
      setCurrentEvent(data.character.events?.[0] ?? null);
      setPendingNext(false);
      setScreen("play");
      playFeedbackCue("success");
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [charName, charAge, charResidence, preferredStats, playFeedbackCue]);

  const resumeCharacter = useCallback(async (char: CharacterData) => {
    setCurrentChar(char);
    setCurrentEvent(null);
    setStreamingEventBody("");
    setStreamingNextEvent(false);
    setPendingNext(false);
    setEndingNotice("");
    if (char.currentEventId) {
      await loadCharacterEvent(char.id);
      await loadSpecData(char.id);
    } else if (isCompletedRun(char)) {
      setEndingNotice("선택의 결과가 기록되었습니다. 새 이야기를 시작할 수 있습니다.");
      await loadSpecData(char.id);
    } else {
      await fetchNextEvent(char.id);
    }
    setScreen("play");
  }, []);

  const startNewCharacter = useCallback(() => {
    playFeedbackCue("tap");
    setCurrentChar(null);
    setCurrentEvent(null);
    setStreamingEventBody("");
    setChoiceFeedback(null);
    setPendingNext(false);
    setEndingNotice("");
    setError("");
    setSpecs([]);
    setJobApps([]);
    setCareerPaths([]);
    setCharName("");
    setCharAge("21");
    setCharResidence("");
    setPreferredStats([]);
    setCreateStep("intro");
    setScreen("create");
  }, [playFeedbackCue]);

  const makeChoice = useCallback(async (choiceIndex: number) => {
    if (!currentChar || !currentEvent) return;
    playFeedbackCue("tap");
    setLoading(true);
    try {
      const { ok, data } = await doFetch(`/api/characters/${currentChar.id}/choices`, "POST", {
        choiceIndex,
      });
      if (!ok) return;
      if (data.result?.stats) {
        setCurrentChar((char) => char ? { ...char, stats: data.result.stats } : char);
      }
      await loadCharacterEvent(currentChar.id);
      await loadSpecData(currentChar.id);
      const feedback = {
        statDelta: data.result?.statDelta ?? {},
        relationshipDelta: data.result?.relationshipDelta ?? [],
        summary: data.result?.summary ?? "",
      };
      setChoiceFeedback(feedback);
      setCurrentEvent(null);
      if (data.result?.endingTriggered) {
        setPendingNext(false);
        setLatestRecordId(data.result?.endingRecordId ?? null);
        setEndingNotice("선택의 결과가 기록되었습니다. 선택의 결과 기록에서 확인할 수 있습니다.");
        playFeedbackCue("ending");
      } else {
        playFeedbackCue(getChoiceFeedbackTone(feedback) === "warning" ? "warning" : "success");
        setPendingNext(false);
        await fetchNextEvent(currentChar.id, { preserveFeedback: true });
      }
    } finally {
      setLoading(false);
    }
  }, [currentChar, currentEvent, playFeedbackCue]);

  const togglePreferredStat = useCallback((key: string) => {
    playFeedbackCue("tap");
    setPreferredStats((current) => {
      if (current.includes(key)) {
        return current.filter((item) => item !== key);
      }
      if (current.length >= 2) {
        return [current[1], key];
      }
      return [...current, key];
    });
  }, [playFeedbackCue]);

  const continueToNextEvent = useCallback(async () => {
    if (!currentChar || currentEvent || loading) return;
    playFeedbackCue("tap");
    await fetchNextEvent(currentChar.id);
  }, [currentChar, currentEvent, loading, playFeedbackCue]);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const { ok, data } = await doFetch("/api/records");
      const nextRecords = ok ? data.records ?? [] : [];
      if (ok) setRecords(nextRecords);
      return nextRecords as Record<string, unknown>[];
    } finally {
      setLoading(false);
    }
  }, []);

  const showLatestRecord = useCallback(async () => {
    const nextRecords = await loadRecords();
    const latestRecord = nextRecords[0];
    setExpandedRecord(typeof latestRecord?.id === "string" ? latestRecord.id : null);
    setScreen("records");
  }, [loadRecords]);

  const shareRecord = useCallback(async (recordId: string) => {
    const shareUrl = `${window.location.origin}/share/${recordId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setError("");
      alert("공유 링크가 복사되었습니다!");
    } catch {
      setError("링크 복사에 실패했습니다.");
    }
  }, []);

  const shareRecordImage = useCallback(async (recordId: string) => {
    const cardEl = document.getElementById(`record-card-${recordId}`);
    if (!cardEl) {
      setError("이미지 생성에 실패했습니다.");
      return;
    }
    try {
      const dataUrl = await toPng(cardEl, { quality: 0.95, pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `career-record-${recordId.slice(0, 8)}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setError("이미지 저장에 실패했습니다.");
    }
  }, []);

  const shareRecordSocial = useCallback(async (platform: string, recordId: string) => {
    const shareUrl = `${window.location.origin}/share/${recordId}`;
    const text = "대학생 커리어 시뮬레이터 - 선택의 결과";
    const urls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`,
      instagram: "", // Instagram doesn't support direct URL sharing
      kakaotalk: `https://share.kakao.com/talk/share?url=${encodeURIComponent(shareUrl)}`,
    };
    const url = urls[platform];
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      await navigator.clipboard.writeText(shareUrl);
      alert("공유 링크가 복사되었습니다!");
    }
  }, []);

  const academicProgressLabel = getAcademicProgressLabel(currentChar);
  const runCompleted = Boolean(endingNotice);
  const audioControls = (
      <div className="menu-settings" data-audio-ready={audioReady}>
        {([
          ["music", "배경음"],
          ["sfx", "효과음"],
          ["haptics", "햅틱"],
        ] as const).map(([key, label]) => (
          <label className="audio-toggle menu-row" key={key}>
            <span>{label}</span>
            <input
              checked={audioSettings[key]}
              onChange={(event) => updateAudioSetting(key, event.target.checked)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.click();
                }
              }}
              onPointerDown={() => {
                if (key === "music" && !audioSettings.music) {
                  void ensureAudio();
                }
              }}
              type="checkbox"
            />
          </label>
        ))}
      </div>
  );
  const topChrome = (
    <header className="app-title-header">
      <h1 className="app-title"><span>일어나보니</span><span>대한민국 취준생</span></h1>
      <button
        aria-expanded={menuOpen}
        aria-label="메뉴"
        className="chrome-icon-button chrome-menu-button"
        ref={menuButtonRef}
        onClick={() => {
          setMenuOpen((open) => !open);
        }}
        type="button"
      >
        <span />
        <span />
        <span />
      </button>
      {menuOpen && (
        <div
          className="app-popover app-menu-popover"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setMenuOpen(false);
            }
          }}
          ref={menuPanelRef}
        >
          {currentChar && <button
            onClick={() => {
              setScreen("play");
              setMenuOpen(false);
            }}
            type="button"
          >
            진행
          </button>}
          <button
            onClick={() => {
              setExpandedRecord(null);
              setScreen("records");
              setMenuOpen(false);
              void loadRecords();
            }}
            type="button"
          >
            기록
          </button>
          <button
            onClick={() => {
              startNewCharacter();
              setMenuOpen(false);
            }}
            type="button"
          >
            새 시뮬레이션
          </button>
          <button
            onClick={() => {
              setScreen("auth");
              setMenuOpen(false);
            }}
            type="button"
          >
            {status === "authenticated" ? "계정" : "로그인/저장"}
          </button>
          <a
            className="menu-row"
            href="/privacy"
            onClick={() => setMenuOpen(false)}
            onKeyDown={(event) => {
              if (event.key === " ") {
                event.preventDefault();
                event.currentTarget.click();
              }
            }}
          >
            개인정보처리방침
          </a>
          {audioControls}
        </div>
      )}
    </header>
  );

  if (activeScreen === "auth") {
    return (
      <>
        {topChrome}
        <main className="pixel-shell flex min-h-screen items-center justify-center p-4">
          <div className="pixel-panel w-full max-w-sm p-8">
          <h1 className="mb-4 text-center text-2xl font-black leading-9">{status === "authenticated" ? "저장된 계정" : "진행 저장하기"}</h1>
          <p className="mb-6 border-y-2 border-[#2a2018] py-2 text-center text-xs font-bold text-[#6d4a2f]">
            {status === "authenticated" ? "SIGNED IN" : "LOGIN TO KEEP YOUR RUN"}
          </p>
          {error && <p className="mb-4 border-2 border-[#b3423c] bg-[#ffe1db] p-2 text-sm font-bold text-[#8d2f2a]">{error}</p>}
          {status === "authenticated" ? (
            <div className="space-y-3">
              <p className="text-center text-sm leading-6 text-[#3a332d]">현재 진행은 계정에 저장됩니다.</p>
              <button className="pixel-button-dark w-full px-4 py-3 text-sm font-bold" onClick={() => setScreen(currentChar ? "play" : "create")}>돌아가기</button>
              <button className="pixel-button w-full px-4 py-3 text-sm font-bold" onClick={startNewCharacter}>새 시뮬레이션</button>
              <button className="pixel-button w-full px-4 py-3 text-sm font-bold" onClick={showLatestRecord}>기록 보기</button>
              <button className="pixel-button w-full px-4 py-3 text-sm font-bold" onClick={() => signOut()}>로그아웃</button>
            </div>
          ) : (
            <div className="space-y-4">
              <input className="pixel-input w-full px-4 py-3 text-sm" placeholder="이메일" type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} />
              <input className="pixel-input w-full px-4 py-3 text-sm" placeholder="비밀번호 (8자 이상)" type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} />
              {authMode === "login" ? (
                <div className="space-y-3">
                  <button className="pixel-button-dark w-full px-4 py-3 text-sm font-bold disabled:opacity-50" disabled={loading} onClick={handleLogin}>로그인</button>
                  <p className="text-center text-xs text-[#706b62]">처음 저장하시나요? <button className="text-[#8a4f2d] underline" onClick={() => setAuthMode("signup")}>회원가입하고 현재 진행 저장</button></p>
                </div>
              ) : (
                <div className="space-y-3">
                  <button className="pixel-button-dark w-full px-4 py-3 text-sm font-bold disabled:opacity-50" disabled={loading} onClick={handleSignup}>회원가입하고 저장</button>
                  <p className="text-center text-xs text-[#706b62]">이미 계정이 있으신가요? <button className="text-[#8a4f2d] underline" onClick={() => setAuthMode("login")}>로그인</button></p>
                </div>
              )}
              <div className="border-t border-[#eee8dd] pt-3">
                <button className="w-full text-center text-xs text-[#706b62] underline" onClick={() => setScreen(currentChar ? "play" : "create")}>나중에 저장하기</button>
              </div>
            </div>
          )}
          </div>
        </main>
      </>
    );
  }

  if (activeScreen === "create" && !currentChar) {
    return (
      <>
        {topChrome}
        <main className="pixel-shell app-screen flex min-h-screen items-start justify-center p-4">
          <div className="w-full max-w-[560px]">
          {error && <p className="mb-4 border-2 border-[#b3423c] bg-[#ffe1db] p-2 text-sm font-bold text-[#8d2f2a]">{error}</p>}
          <div className="pixel-panel create-panel p-6">
            {createStep === "intro" && <section className="create-step" data-testid="onboarding-intro">
            <div className="create-hero-art overflow-hidden border-4 border-[#2a2018]" data-testid="intro-dawn-art">
              <PixelScene scene="intro" label="오전 6시 07분의 밝은 새벽 방 픽셀아트" />
            </div>
            <div className="space-y-3 pt-5 text-[15px] leading-7 text-[#3a332d]">
              <h2 className="create-question">낯선 아침이 시작됩니다.</h2>
              <p>눈을 뜨니 오전 6시 07분입니다. 휴대폰에는 읽지 않은 카톡 알림이 수북하게 쌓여 있습니다.</p>
              <p>학과 단체방 공지, 새로 올라온 동아리 모집 글, 아르바이트 연락, 그리고 아직 열어보지 않은 메시지 하나가 화면 위에 겹쳐 있습니다. 마지막 메시지에는 짧은 문장만 남아 있습니다. “이번에는 어떤 사람이 될 수 있을까요?”</p>
              <p>오늘은 평범한 학기의 첫날일 수도, 오래 미뤄둔 변화를 시작하는 날일 수도 있습니다. 지금 고르는 작은 선택들은 수업과 관계, 생활과 진로를 조금씩 다른 방향으로 이끌게 될 것입니다.</p>
              <p className="text-xs text-[#706b62]">이 이야기는 실제 진로 예측이 아닌 재미를 위한 허구의 시뮬레이션입니다.</p>
            </div>
            <button className="pixel-button-dark mt-5 w-full px-4 py-3 text-sm font-bold" onClick={() => setCreateStep("name")}>시작하기</button>
            </section>}
            {createStep === "name" && <section className="create-step">
              <h2 className="create-question">당신의 이름은 무엇인가요?</h2>
              <input aria-label="당신의 이름은 무엇인가요?" autoFocus className="pixel-input w-full px-4 py-3 text-sm" maxLength={24} placeholder="한서윤" value={charName} onChange={(e) => setCharName(e.target.value)} />
              <div className="onboarding-actions"><button onClick={() => setCreateStep("intro")}>이전</button><button disabled={!charName.trim()} onClick={() => setCreateStep("age")}>다음</button></div>
            </section>}
            {createStep === "age" && <section className="create-step">
              <h2 className="create-question">당신의 나이는 몇 살인가요?</h2>
              <select aria-label="당신의 나이는 몇 살인가요?" className="pixel-input w-full px-4 py-3 text-sm" value={charAge} onChange={(e) => setCharAge(e.target.value)}>
                {Array.from({ length: 63 }, (_, i) => i + 18).map((age) => (<option key={age} value={age}>{age}세</option>))}
              </select>
              <div className="onboarding-actions"><button onClick={() => setCreateStep("name")}>이전</button><button onClick={() => setCreateStep("residence")}>다음</button></div>
            </section>}
            {createStep === "residence" && <section className="create-step">
              <h2 className="create-question">당신은 어디에서 깨어났나요?</h2>
              <div className="grid gap-2">
                {residenceOptions.map((option) => (
                  <button
                    aria-pressed={charResidence === option.id}
                    className={`pixel-button px-4 py-3 text-left text-sm ${charResidence === option.id ? "is-selected" : ""}`}
                    key={option.id}
                    onClick={() => {
                      playFeedbackCue("tap");
                      setCharResidence(option.id);
                    }}
                    type="button"
                  >
                    <span className="block font-bold">{option.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-[#706b62]">{option.description}</span>
                  </button>
                ))}
              </div>
              <div className="onboarding-actions"><button onClick={() => setCreateStep("age")}>이전</button><button disabled={!charResidence} onClick={() => setCreateStep("abilities")}>다음</button></div>
            </section>}
            {createStep === "abilities" && <section className="create-step">
              <h2 className="create-question">당신이 믿고 싶은 능력 두 가지는 무엇인가요? ({preferredStats.length}/2)</h2>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(statLabels).map(([key, label]) => (
                  <button
                    className={`pixel-button px-3 py-3 text-left text-sm ${preferredStats.includes(key) ? "bg-[#ffe0a2]" : ""}`}
                    key={key}
                    onClick={() => togglePreferredStat(key)}
                    type="button"
                  >
                    <span className="mr-2 text-xs text-[#8a4f2d]">{preferredStats.includes(key) ? "●" : "○"} {statIcons[key]}</span>
                    <span className="font-bold">{label}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-[#706b62]">선택한 두 능력은 첫 능력치에 조금 더 높게 반영됩니다.</p>
              <div className="onboarding-actions"><button onClick={() => setCreateStep("residence")}>이전</button><button disabled={loading || preferredStats.length !== 2} onClick={createCharacter}>눈을 뜬다</button></div>
            </section>}
          </div>
          </div>
        </main>
      </>
    );
  }

  if (activeScreen === "records") {
    return (
      <>
        {topChrome}
        <main className="records-screen min-h-screen p-4 pt-8">
          <div className="mx-auto max-w-5xl">
          <div className="record-hero mb-4 flex items-end justify-between gap-5 border-b-4 border-[#2a2018] pb-5 max-[720px]:block">
            <div>
              <p className="mb-2 text-xs font-black text-[#8a4f2d]">ARCHIVE</p>
              <h1 className="text-3xl font-black leading-tight">선택의 결과 기록</h1>
              <p className="mt-2 text-sm text-[#706b62]">가상 취준 생활이 남긴 직업, 관계, 생활의 스냅샷</p>
            </div>
            <div className="record-actions flex items-center gap-4 max-[720px]:mt-4">
              <button className="record-action" onClick={loadRecords} type="button">새로고침</button>
              <button className="record-action" onClick={runCompleted ? startNewCharacter : () => { setScreen("play"); }} type="button">
                {runCompleted ? "새로 시작" : "이어가기"}
              </button>
            </div>
          </div>
          <div className="record-tabs mb-6" role="tablist">
            <button
              className={recordsTab === "records" ? "active" : ""}
              onClick={() => setRecordsTab("records")}
              type="button"
              role="tab"
              aria-selected={recordsTab === "records"}
            >
              지난 루트
            </button>
            <button
              className={recordsTab === "codex" ? "active" : ""}
              onClick={() => setRecordsTab("codex")}
              type="button"
              role="tab"
              aria-selected={recordsTab === "codex"}
            >
              결말 모음
            </button>
          </div>

          {recordsTab === "records" ? (
            <div className="grid gap-5">
              {records.map((r: Record<string, unknown>) => {
                const isExpanded = expandedRecord === r.id;
                const title = recordText(r, "title", "선택의 결과");
                const summary = recordText(r, "summary");
                const careerPath = recordText(r, "careerPath", "진로 기록");
                const healthState = recordText(r, "healthState", "생활 상태");
                const relationshipStateText = recordText(r, "relationshipState", "관계의 여운");
                const narrativeText = recordText(r, "longNarrative");
                const narrativePreview = narrativeText.length > 150 ? narrativeText.slice(0, 150) + "..." : narrativeText;
                return (
                  <div className={`record-card record-card-${getRecordTone(r)} pixel-panel overflow-hidden`} id={`record-card-${r.id as string}`} key={r.id as string}>
                    <button
                      className="grid w-full grid-cols-[156px_minmax(0,1fr)_32px] items-center gap-5 p-5 text-left max-[720px]:grid-cols-[96px_minmax(0,1fr)_24px] max-[520px]:grid-cols-1"
                      onClick={() => setExpandedRecord(isExpanded ? null : r.id as string)}
                    >
                      <RecordPoster record={r} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-lg font-bold text-[#2a241e]">{title}</span>
                        </div>
                        <p className="mt-1 text-sm text-[#706b62]">{summary}</p>
                        {!isExpanded && narrativePreview && (
                          <p className="mt-2 text-xs leading-relaxed text-[#a9967d]">{narrativePreview}</p>
                        )}
                      </div>
                      <span className="text-xl text-[#8a4f2d] max-[520px]:hidden">{isExpanded ? "▲" : "▼"}</span>
                    </button>
                    {isExpanded && (
                      <div className="border-t-4 border-[#2a2018] bg-[#fffaf0] p-5">
                        <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed text-[#2a241e]">
                          {narrativeText}
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-3 border-t-2 border-[#f2efe7] pt-4 text-center text-sm">
                          <div><span className="block text-xs text-[#706b62]">만족도</span><span className="text-lg font-bold">{r.satisfaction as number}</span></div>
                          <div><span className="block text-xs text-[#706b62]">성장 가능성</span><span className="text-lg font-bold">{r.growthPotential as number}</span></div>
                          <div><span className="block text-xs text-[#706b62]">워라밸</span><span className="text-lg font-bold">{r.workLifeBalance as number}</span></div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="border-2 border-[#ded9ce] bg-[#f2efe7] px-2.5 py-1 text-xs font-bold">{careerPath}</span>
                          <span className="border-2 border-[#ded9ce] bg-[#f2efe7] px-2.5 py-1 text-xs">{healthState}</span>
                          <span className="border-2 border-[#ded9ce] bg-[#f2efe7] px-2.5 py-1 text-xs">관계: {relationshipStateText}</span>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2 border-t-2 border-[#f2efe7] pt-4">
                          <button
                            className="pixel-button-dark px-3 py-2 text-xs font-bold"
                            onClick={() => shareRecord(r.id as string)}
                          >
                            🔗 링크 복사
                          </button>
                          <button
                            className="pixel-button-dark px-3 py-2 text-xs font-bold"
                            onClick={() => shareRecordImage(r.id as string)}
                          >
                            🖼️ 이미지 저장
                          </button>
                          <button
                            className="pixel-button px-3 py-2 text-xs font-bold"
                            onClick={() => shareRecordSocial("twitter", r.id as string)}
                          >
                            𝕏 공유
                          </button>
                          <button
                            className="pixel-button px-3 py-2 text-xs font-bold"
                            onClick={() => shareRecordSocial("kakaotalk", r.id as string)}
                          >
                            💬 카톡 공유
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {records.length === 0 && (
                <div className="pixel-panel border-dashed p-10 text-center">
                  <p className="text-sm text-[#706b62]">아직 저장된 기록이 없습니다.</p>
                  <p className="mt-2 text-xs text-[#a9967d]">시뮬레이션을 충분히 진행하면 선택의 결과를 남길 수 있습니다.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="relative pb-12">
              <CodexGrid codexState={codexState} onSlotClick={(slot) => setSelectedSlot(slot)} />
              <CodexDetailModal
                achievementCount={selectedSlotState?.achievementCount ?? 0}
                firstAchievedAt={selectedSlotState?.firstAchievedAt ?? null}
                isOpen={selectedSlot !== null}
                onClose={() => setSelectedSlot(null)}
                recordSample={selectedSlotRecordSample}
                slot={selectedSlot as CodexSlot}
                unlocked={selectedSlotState?.unlocked ?? false}
              />
            </div>
          )}
          </div>
        </main>
      </>
    );
  }

  return (
    <>
    {topChrome}
    <div className="app-layout pixel-shell min-h-screen pt-14 text-[#2a241e]">
      <aside className="sidebar border-r border-[#3b3025] bg-[#231d17] p-[22px] text-[#f7efe2]">
        <div className="sidebar-top">
          <div className="sidebar-profile flex items-center gap-3">
            <PixelPortrait name={currentChar?.name} compact />
            <div className="min-w-0">
              <h1 className="text-[22px] font-bold leading-tight">{currentChar?.name ?? "..."}</h1>
            </div>
          </div>
        </div>
        <nav className="sidebar-nav mt-[22px] grid gap-2">
          <button className={`rounded-lg px-2.5 py-2 text-left text-sm ${activeScreen === "play" ? "border border-[#7d6146] bg-[#3a2d21]" : "text-[#d9c9b5]"}`} onClick={() => setScreen("play")}>진행</button>
          <button className={`rounded-lg px-2.5 py-2 text-left text-sm ${activeScreen === "character_detail" ? "border border-[#7d6146] bg-[#3a2d21]" : "text-[#d9c9b5]"}`} onClick={() => setScreen("character_detail")}>캐릭터</button>
          <button className={`rounded-lg px-2.5 py-2 text-left text-sm ${activeScreen === "relationships" ? "border border-[#7d6146] bg-[#3a2d21]" : "text-[#d9c9b5]"}`} onClick={() => setScreen("relationships")}>관계</button>
          <button className="rounded-lg px-2.5 py-2 text-left text-sm text-[#d9c9b5]" onClick={() => { setExpandedRecord(null); setScreen("records"); loadRecords(); }}>기록</button>
          <button
            aria-expanded={mobileStatsOpen}
            className={`mobile-stats-toggle rounded-lg px-2.5 py-2 text-left text-sm ${mobileStatsOpen ? "border border-[#7d6146] bg-[#3a2d21]" : "text-[#d9c9b5]"}`}
            onClick={() => setMobileStatsOpen((open) => !open)}
            type="button"
          >
            능력치
          </button>
          <button className="rounded-lg px-2.5 py-2 text-left text-sm text-[#a9967d]" onClick={() => setScreen("auth")}>
            {status === "authenticated" ? "계정" : "로그인/저장"}
          </button>
        </nav>
        {currentChar?.stats && (
          <>
            <section className={`sidebar-stats mt-3.5 rounded-lg border border-[#4d3d2f] bg-[#1b1612] p-3.5 ${mobileStatsOpen ? "sidebar-stats-open" : ""}`}>
              <h2 className="text-base font-bold">자산</h2>
              <div className="mt-2 rounded-md bg-[#2c231b] px-2.5 py-2 text-[13px]">
                <dt className="flex items-center justify-between gap-2">
                  <span><span className="mr-1.5 text-[11px] text-[#d79b52]">CO</span>자산</span>
                  <span className="text-[#c4b39c]">{formatWealth(currentChar.stats?.wealth ?? 0)}</span>
                </dt>
              </div>
            </section>
            <section className={`sidebar-stats mt-3.5 rounded-lg border border-[#4d3d2f] bg-[#1b1612] p-3.5 ${mobileStatsOpen ? "sidebar-stats-open" : ""}`}>
              <h2 className="text-base font-bold">능력치</h2>
              <dl className="mt-2 grid gap-2">
                {Object.entries(statLabels).filter(([key]) => key !== "wealth").map(([key, label]) => (
                  <div className="rounded-md bg-[#2c231b] px-2.5 py-2 text-[13px]" key={key}>
                    <dt className="flex items-center justify-between gap-2">
                      <span><span className="mr-1.5 text-[11px] text-[#d79b52]">{statIcons[key]}</span>{label}</span>
                      <span className="text-[#c4b39c]">{statLevel(currentChar.stats?.[key] ?? 0)}/10</span>
                    </dt>
                    <dd className="mt-1.5 flex gap-1" aria-label={`${label} ${statLevel(currentChar.stats?.[key] ?? 0)}`}>
                      {Array.from({ length: 10 }, (_, i) => (
                        <span className={`h-1.5 flex-1 rounded-full ${i < statLevel(currentChar.stats?.[key] ?? 0) ? "bg-[#d79b52]" : "bg-[#4c4035]"}`} key={i} />
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
            {specs.length > 0 && (
              <section className={`sidebar-stats mt-3.5 rounded-lg border border-[#4d3d2f] bg-[#1b1612] p-3.5 ${mobileStatsOpen ? "sidebar-stats-open" : ""}`}>
                <h2 className="text-base font-bold">스펙</h2>
                <div className="mt-2 space-y-1">
                  {specs.filter(s => s.status === "COMPLETED" || s.status === "IN_PROGRESS").map((spec, i) => (
                    <div className="rounded-md bg-[#2c231b] px-2.5 py-2 text-[12px]" key={i}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[#c4b39c]">{spec.specName}</span>
                        <span className={`text-[11px] font-bold ${spec.status === "COMPLETED" ? "text-[#4a9f70]" : spec.status === "FAILED" ? "text-[#b3423c]" : "text-[#f7d08b]"}`}>
                          {spec.status === "COMPLETED" ? spec.score ?? "완료" : spec.status === "FAILED" ? "실패" : "진행중"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
        <section className="sidebar-notice mt-3.5 rounded-lg border border-[#4d3d2f] bg-[#1b1612] p-3.5">
          <h2 className="font-bold">패러디 안내</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[#c4b39c]">이 시뮬레이션의 기업, 인물, 사건은 허구 및 패러디입니다.</p>
        </section>
      </aside>

      <main className="play-main bg-[#f7efe2] px-11 py-[34px]">
        {activeScreen === "play" && (
          <section className="mx-auto max-w-[760px]">
            <div className="play-status-strip mb-4">
              <span>{academicProgressLabel}</span>
              <span>{currentChar?.major ?? "전공 미정"}</span>
              <span>{currentChar ? formatWealth(currentChar.stats?.wealth ?? 0) : "자산"}</span>
            </div>
            {error && <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}
            {choiceFeedback && (
              <div className="feedback-pop pixel-panel mb-5 p-4">
                <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-4 max-[520px]:grid-cols-1">
                  <ChoiceResultArt tone={getChoiceFeedbackTone(choiceFeedback)} />
                  <div className="min-w-0">
                    <p className="text-sm font-black text-[#6d4a2f]">선택의 결과</p>
                    {choiceFeedback.summary && <p className="mt-2 text-sm leading-6">{choiceFeedback.summary}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Object.entries(choiceFeedback.statDelta).map(([key, delta]) => (
                        <span className={`border-2 px-2 py-1 text-xs font-bold ${delta > 0 ? "border-[#305d73] bg-[#d5edf6] text-[#244c5e]" : "border-[#b3423c] bg-[#ffe1db] text-[#7b2d29]"}`} key={key}>
                          {statLabels[key] ?? key} {key === "wealth" ? `${delta > 0 ? "+" : ""}${delta}만원` : `${delta > 0 ? "+" : ""}${delta}`}
                        </span>
                      ))}
                      {choiceFeedback.relationshipDelta.map((rel) => (
                        <span className={`border-2 px-2 py-1 text-xs font-bold ${rel.trust > 0 ? "border-[#a53f66] bg-[#ffe1ec] text-[#842b50]" : "border-[#2b3348] bg-[#dce2f5] text-[#26304a]"}`} key={`${rel.name}-${rel.trust}`}>
                          {rel.name} {rel.trust > 0 ? "♥+" : "💀"}{rel.trust}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {endingNotice && (
              <div className="ending-splash pixel-panel mb-5 overflow-hidden border-[#b3423c] bg-[#ffe1db] text-[#6f211d]">
                <div className="grid grid-cols-[180px_minmax(0,1fr)] gap-5 p-5 max-[640px]:grid-cols-1">
                  <div className="ending-splash-art">
                    <EndingArt type="default" size={160} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-[#8a4f2d]">RESULT UNLOCKED</p>
                    <p className="mt-1 text-2xl font-black">선택의 결과</p>
                    <p className="mt-2 text-sm leading-6">{endingNotice}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button className="pixel-button-dark px-4 py-2 text-sm font-bold" onClick={showLatestRecord}>결과 바로 보기</button>
                      <button className="pixel-button px-4 py-2 text-sm font-bold" onClick={startNewCharacter}>새로 시작하기</button>
                    </div>
                    {latestRecordId && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button className="pixel-button-dark px-3 py-2 text-xs font-bold" onClick={() => shareRecord(latestRecordId)}>🔗 링크 복사</button>
                        <button className="pixel-button px-3 py-2 text-xs font-bold" onClick={() => shareRecordSocial("twitter", latestRecordId)}>𝕏 공유</button>
                        <button className="pixel-button px-3 py-2 text-xs font-bold" onClick={() => shareRecordSocial("kakaotalk", latestRecordId)}>💬 카톡 공유</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {streamingNextEvent && !currentEvent && !endingNotice && (
              <div className="event-frame pixel-panel overflow-hidden">
                <div className="grid grid-cols-[220px_minmax(0,1fr)] max-[720px]:grid-cols-1">
                  <PixelScene scene="campus" label="생성 중인 장면" />
                  <div className="p-6">
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <span className="border-2 border-[#2a2018] bg-[#f7d08b] px-2 py-1 text-xs font-black text-[#2a2018]">새 장면</span>
                      <h2 className="text-xl font-black leading-tight text-[#2a241e]">선택의 시간이 다가오고 있습니다...</h2>
                    </div>
                    <div className="novel-text text-lg tracking-normal max-[900px]:text-[16px]">
                      {streamingEventBody
                        ? streamingEventBody.split("\n").filter(Boolean).map((p, i) => (<p className="mt-3 first:mt-0" key={i}>{p}</p>))
                        : <p className="mt-3 first:mt-0 text-[#706b62]">장면이 문장으로 떠오르는 중입니다.</p>}
                    </div>
                    <p className="mt-5 text-sm font-bold text-[#8a4f2d]">선택지는 장면이 완성되면 나타납니다.</p>
                  </div>
                </div>
              </div>
            )}
            {currentEvent && (
              <>
                <div className="event-frame pixel-panel overflow-hidden">
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
                        {currentEvent.body.split("\n").map((p, i) => (<p className="mt-3 first:mt-0" key={i}>{p}</p>))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="choice-stack mt-7 grid gap-3">
                  {currentEvent.choices.map((choice, idx) => (
                    <button className="choice-button pixel-button grid min-h-12 grid-cols-[32px_minmax(0,1fr)] items-center gap-3 px-4 py-3.5 text-left text-[15px] disabled:opacity-50" disabled={loading} key={choice.id} onClick={() => makeChoice(idx)}>
                      <span className="choice-index">{idx + 1}</span>
                      <span>{choice.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {!currentEvent && !endingNotice && !streamingNextEvent && (
              <div
                className="pixel-panel cursor-pointer p-8 text-center"
                onClick={continueToNextEvent}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    continueToNextEvent();
                  }
                }}
              >
                <p className="text-lg leading-8 text-[#3a332d]">
                  {pendingNext ? "다음 상황을 준비 중입니다." : "새 상황을 준비 중입니다."}
                </p>
                {loading && <p className="mt-3 text-sm text-[#706b62]">선택의 시간이 다가오고 있습니다...</p>}
              </div>
            )}
          </section>
        )}
        {activeScreen === "character_detail" && currentChar && (
          <section className="mx-auto max-w-[760px]">
            <h2 className="screen-title text-xl font-black">캐릭터 상세</h2>
            <div className="character-sheet pixel-panel mt-4 overflow-hidden">
              <div className="character-portrait-stage">
                <PixelPortrait name={currentChar.name} large />
              </div>
              <div className="character-sheet-body p-5">
                <p className="text-xs font-black text-[#8a4f2d]">CURRENT STUDENT FILE</p>
                <h3 className="mt-1 text-2xl font-black leading-tight">{currentChar.name}</h3>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm max-[520px]:grid-cols-1">
                  <p className="profile-chip"><strong>이름:</strong> {currentChar.name}</p>
                  <p className="profile-chip"><strong>전공:</strong> {currentChar.major}</p>
                  <p className="profile-chip"><strong>학사 진행:</strong> {getAcademicProgressLabel(currentChar)}</p>
                  <p className="profile-chip"><strong>나이:</strong> {currentChar.age}세</p>
                  <p className="profile-chip"><strong>학적:</strong> {formatAcademicStatus(currentChar.academicStatus)}</p>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2 max-[520px]:grid-cols-1">
                  {Object.entries(statLabels).map(([key, label]) => (
                    <div className="stat-card" key={key}>
                      <div className="flex items-center justify-between gap-2">
                        <span><span className="mr-1 text-xs text-[#8a4f2d]">{statIcons[key]}</span>{label}</span>
                        <strong>{key === "wealth" ? formatWealth(currentChar.stats?.[key] ?? 0) : `${statLevel(currentChar.stats?.[key] ?? 0)}/10`}</strong>
                      </div>
                      {key !== "wealth" && (
                        <div className="mt-2 h-2 border-2 border-[#2a2018] bg-[#e2d7c8]">
                          <div className="h-full bg-[#2f7a84]" style={{ width: `${statLevel(currentChar.stats?.[key] ?? 0) * 10}%` }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
        {activeScreen === "relationships" && currentChar && (
          <section className="mx-auto max-w-[760px]">
            <h2 className="screen-title text-xl font-black">관계</h2>
            <div className="relationship-grid mt-4 grid gap-3">
              {currentChar.relationships?.map((rel) => (
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
                    <div className="mt-3 flex flex-wrap gap-1">{(rel.tags ?? []).map((tag: string) => (<span className="relation-tag border-2 border-[#2a2018] bg-[#efe5d7] px-2 py-1 text-xs text-[#68412b]" key={tag}>{tag}</span>))}</div>
                  </div>
                </div>
              ))}
              {(!currentChar.relationships || currentChar.relationships.length === 0) && (
                <div className="pixel-panel empty-relationship p-6 text-center">
                  <PixelPortrait name="?" large />
                  <p className="mt-3 text-sm text-[#706b62]">아직 관계 정보가 없습니다.</p>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      <aside className="right-sidebar border-l border-[#3b3025] bg-[#241b15] p-[22px] text-[#fff3d7]">
        <h2 className="text-[22px] font-black leading-tight">기억과 관계</h2>
        <section className="pixel-panel-dark mt-3.5 p-3.5">
          <h3 className="font-bold">주요 인물</h3>
          <div className="mt-2 space-y-1">
            {currentChar?.relationships?.slice(0, 3).map((rel) => (<p className="text-[13px] leading-relaxed text-[#d9c9b5]" key={rel.name}>{rel.name} · {rel.role}<br /><span className="text-[11px]">{trustHearts(rel.trust)}</span></p>))}
            {(!currentChar?.relationships || currentChar.relationships.length === 0) && <p className="text-[13px] text-[#d9c9b5]">정보 없음</p>}
          </div>
        </section>
        <section className="pixel-panel-dark mt-3.5 p-3.5">
          <h3 className="font-bold">최근 기억</h3>
          <div className="mt-2 flex flex-wrap gap-1">
            {currentChar?.eventHistory?.slice(0, 5).map((h, i) => (<span className="border-2 border-[#0f0b08] bg-[#35261c] px-2 py-1 text-xs text-[#f7d08b]" key={i}>{h.summary.slice(0, 15)}</span>))}
            {(!currentChar?.eventHistory || currentChar.eventHistory.length === 0) && <span className="text-xs text-[#d9c9b5]">아직 기록 없음</span>}
          </div>
        </section>
        <section className="pixel-panel-dark mt-3.5 p-3.5" data-testid="spec-panel">
          <h3 className="font-bold">스펙</h3>
          <div className="mt-2 space-y-2">
            {specs.map((spec, i) => (
              <div key={i} className="flex items-center justify-between text-[13px]">
                <div>
                  <span className="text-[#a9967d] mr-1">[{spec.specType}]</span>
                  <span className="text-[#d9c9b5]">{spec.specName}</span>
                </div>
                <span className={`text-[11px] px-1.5 py-0.5 rounded font-bold ${
                  spec.status === 'COMPLETED' ? 'bg-[#2d4a22] text-[#8fce74]' :
                  spec.status === 'FAILED' ? 'bg-[#4a2222] text-[#ce7474]' :
                  'bg-[#4a3d22] text-[#ceb074]'
                }`}>
                  {spec.status}
                </span>
              </div>
            ))}
            {specs.length === 0 && <p className="text-[13px] text-[#d9c9b5]">정보 없음</p>}
          </div>
        </section>
        <section className="pixel-panel-dark mt-3.5 p-3.5" data-testid="job-application-panel">
          <h3 className="font-bold">취업 전형</h3>
          <div className="mt-2 space-y-2">
            {jobApps.map((app, i) => (
              <div key={i} className="text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="text-[#d9c9b5] font-bold">{app.companyName}</span>
                  <span className="text-[#a9967d] text-[11px]">{app.currentStage}</span>
                </div>
                <p className="mt-0.5 text-[#8a7f72] text-[11px]">서류 → 인적성 → 면접 → 최종</p>
              </div>
            ))}
            {jobApps.length === 0 && <p className="text-[13px] text-[#d9c9b5]">진행 중인 전형 없음</p>}
          </div>
        </section>
        <section className="pixel-panel-dark mt-3.5 p-3.5" data-testid="career-path-panel">
          <h3 className="font-bold">진로 트랙</h3>
          <div className="mt-2 space-y-2">
            {careerPaths.map((path, i) => (
              <div key={i} className="flex items-center justify-between text-[13px]">
                <span className="text-[#d9c9b5]">{path.pathName}</span>
                <span className={`text-[11px] px-1.5 py-0.5 rounded font-bold ${
                  path.status === 'COMPLETED' ? 'bg-[#2d4a22] text-[#8fce74]' :
                  path.status === 'FAILED' ? 'bg-[#4a2222] text-[#ce7474]' :
                  'bg-[#4a3d22] text-[#ceb074]'
                }`}>
                  {path.status}
                </span>
              </div>
            ))}
            {careerPaths.length === 0 && <p className="text-[13px] text-[#d9c9b5]">정보 없음</p>}
          </div>
        </section>
      </aside>

      <style jsx>{`
        .app-layout { display: grid; grid-template-columns: 260px minmax(0, 1fr) 300px; }
        .mobile-stats-toggle { display: none; }
        @media (max-width: 1120px) {
          .app-layout { grid-template-columns: 220px minmax(0, 1fr); }
          .right-sidebar { display: none; }
          .sidebar { padding: 18px; }
          .play-main { padding: 26px 24px; }
        }
        @media (max-width: 820px) {
          .app-layout { display: block; }
          .sidebar {
            position: sticky;
            top: 0;
            z-index: 20;
            border-right: 0;
            border-bottom: 2px solid #0f0b08;
            padding: 8px 10px;
            box-shadow: 0 3px 0 #0d0b09;
          }
          .sidebar-top {
            display: block;
            align-items: center;
          }
          .sidebar-profile {
            display: grid;
            grid-template-columns: 28px minmax(0, 1fr);
            gap: 6px;
            align-items: center;
          }
          .sidebar-profile :global(.pixel-portrait) {
            width: 28px;
            height: 30px;
            border-width: 2px;
            box-shadow: 1px 1px 0 #0a0705;
          }
          .sidebar-profile :global(.portrait-hair) {
            left: 8px;
            top: 5px;
            width: 22px;
            height: 9px;
            box-shadow:
              -5px 5px 0 var(--hair-color, #35261c),
              5px 5px 0 var(--hair-color, #35261c),
              0 10px 0 var(--hair-color, #35261c);
          }
          .sidebar-profile :global(.portrait-hair::before),
          .sidebar-profile :global(.portrait-hair::after) {
            display: none;
          }
          .sidebar-profile :global(.portrait-face) {
            left: 9px;
            top: 12px;
            width: 20px;
            height: 18px;
            border-width: 2px;
            font-size: 10px;
          }
          .sidebar-profile :global(.portrait-body) {
            left: 7px;
            width: 24px;
            height: 13px;
            border-width: 2px;
          }
          .sidebar h1 {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 16px;
          }
          .sidebar-major {
            display: block;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 12px;
            line-height: 1.2;
          }
          .sidebar-progress {
            display: none;
          }
          .sidebar-progress > div:first-child {
            font-size: 10px;
          }
          .sidebar-progress > div:last-child {
            height: 8px;
            margin-top: 4px;
          }
          .sidebar-nav {
            display: flex;
            gap: 6px;
            margin: 8px -10px 0;
            overflow-x: auto;
            padding: 0 10px 2px;
            scrollbar-width: none;
          }
          .sidebar-nav::-webkit-scrollbar {
            display: none;
          }
          .sidebar-nav button {
            flex: 0 0 auto;
            min-height: 34px;
            min-width: 58px;
            overflow: hidden;
            padding: 7px 10px;
            text-align: center;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 13px;
          }
          .mobile-stats-toggle {
            display: block;
          }
          .sidebar-nav button:last-child {
            display: none;
          }
          .sidebar-stats {
            display: none;
            margin-top: 8px;
            padding: 8px;
          }
          .sidebar-stats.sidebar-stats-open {
            display: block;
          }
          .sidebar-stats h2 {
            display: none;
          }
          .sidebar-stats dl {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 6px;
            margin-top: 0;
          }
          .sidebar-stats dt {
            font-size: 11px;
          }
          .sidebar-stats dd {
            margin-top: 5px;
          }
          .sidebar-notice,
          .right-sidebar {
            display: none;
          }
          .play-main {
            padding: 14px 12px 22px;
          }
        }
        @media (max-width: 420px) {
          .sidebar-profile :global(.pixel-portrait) {
            display: none;
          }
          .sidebar-profile {
            grid-template-columns: minmax(0, 1fr);
          }
          .sidebar-nav {
            margin-top: 7px;
          }
          .sidebar-nav button {
            min-width: 56px;
            padding-inline: 9px;
            font-size: 12px;
          }
        }
      `}</style>
      {showExitConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowExitConfirm(false)}
          role="dialog"
          aria-modal="true"
          aria-label="앱 종료 확인"
        >
          <div
            className="pixel-panel relative flex w-full max-w-sm flex-col items-center gap-6 bg-[#fffaf0] p-8 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-lg font-black text-[#2a241e]">미니앱을 종료하시겠어요?</p>
            <p className="text-sm leading-relaxed text-[#706b62]">지금까지의 진행 상황은 자동으로 저장됩니다.</p>
            <div className="flex w-full gap-3">
              <button
                className="pixel-button flex-1 px-4 py-3 text-sm font-bold"
                onClick={() => setShowExitConfirm(false)}
                type="button"
              >
                취소
              </button>
              <button
                className="pixel-button-dark flex-1 px-4 py-3 text-sm font-bold"
                onClick={() => {
                  setShowExitConfirm(false);
                  stopMusic();
                }}
                type="button"
              >
                나가기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
