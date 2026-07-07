"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { EndingArt, getEndingArtType } from "@/lib/game/ending-art";

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
  if (text.includes("면접") || text.includes("채용") || text.includes("인턴") || text.includes("회사")) return "interview";
  if (text.includes("연애") || text.includes("고백") || text.includes("호감") || text.includes("동아리")) return "social";
  if (text.includes("돈") || text.includes("알바") || text.includes("월세") || text.includes("빚")) return "money";
  if (text.includes("발표") || text.includes("프로젝트") || text.includes("mvp") || text.includes("앱")) return "project";
  if (text.includes("수업") || text.includes("시험") || text.includes("과제") || text.includes("도서관")) return "study";
  return "campus";
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
    .replace(/\s{2,}/g, " ")
    .trim();
}

function recordText(record: Record<string, unknown>, key: string, fallback = "") {
  return stripRouteGradeText(record[key]) || fallback;
}

function PixelPortrait({ name, compact = false }: { name?: string; compact?: boolean }) {
  const initial = name?.trim().slice(0, 1) || "?";

  return (
    <div className={`pixel-portrait ${compact ? "pixel-portrait-compact" : ""}`} aria-hidden="true">
      <div className="portrait-hair" />
      <div className="portrait-face">
        <span>{initial}</span>
      </div>
      <div className="portrait-body" />
    </div>
  );
}

function PixelScene({ scene, label }: { scene: string; label?: string }) {
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
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [pendingNext, setPendingNext] = useState(false);
  const [endingNotice, setEndingNotice] = useState("");
  const [choiceFeedback, setChoiceFeedback] = useState<ChoiceFeedback | null>(null);
  const [mobileStatsOpen, setMobileStatsOpen] = useState(false);

  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  const [charName, setCharName] = useState("");
  const [charAge, setCharAge] = useState("21");
  const [charResidence, setCharResidence] = useState("studio");
  const [preferredStats, setPreferredStats] = useState<string[]>(["academic", "mental"]);

  const mountedRef = useRef(false);
  const activeScreen = screen;

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
        const { ok, data } = await doFetch(`/api/characters/${charId}/events/next`, "POST");
        if (ok) setCurrentEvent(data.event);
      }
      await loadCharacterEvent(charId);
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
        if (eventName === "status") {
          setStreamingNextEvent(true);
        }
        if (eventName === "event" && payload.event) {
          setCurrentEvent(payload.event);
          receivedFinalEvent = true;
        }
        if (eventName === "error") {
          setError(payload.error ?? "다음 사건을 생성하지 못했습니다.");
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

  const createCharacter = useCallback(async () => {
    setError("");
    setLoading(true);
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
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [charName, charAge, charResidence, preferredStats]);

  const resumeCharacter = useCallback(async (char: CharacterData) => {
    setCurrentChar(char);
    setCurrentEvent(null);
    setStreamingEventBody("");
    setStreamingNextEvent(false);
    setPendingNext(false);
    setEndingNotice("");
    if (char.currentEventId) {
      await loadCharacterEvent(char.id);
    } else if (isCompletedRun(char)) {
      setEndingNotice("선택의 결과가 기록되었습니다. 새 이야기를 시작할 수 있습니다.");
    } else {
      await fetchNextEvent(char.id);
    }
    setScreen("play");
  }, []);

  const startNewCharacter = useCallback(() => {
    setCurrentChar(null);
    setCurrentEvent(null);
    setStreamingEventBody("");
    setChoiceFeedback(null);
    setPendingNext(false);
    setEndingNotice("");
    setError("");
    setScreen("create");
  }, []);

  const makeChoice = useCallback(async (choiceIndex: number) => {
    if (!currentChar || !currentEvent) return;
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
      setChoiceFeedback({
        statDelta: data.result?.statDelta ?? {},
        relationshipDelta: data.result?.relationshipDelta ?? [],
        summary: data.result?.summary ?? "",
      });
      setCurrentEvent(null);
      if (data.result?.endingTriggered) {
        setPendingNext(false);
        setEndingNotice("선택의 결과가 기록되었습니다. 선택의 결과 기록에서 확인할 수 있습니다.");
      } else {
        setPendingNext(false);
        await fetchNextEvent(currentChar.id, { preserveFeedback: true });
      }
    } finally {
      setLoading(false);
    }
  }, [currentChar, currentEvent]);

  const togglePreferredStat = useCallback((key: string) => {
    setPreferredStats((current) => {
      if (current.includes(key)) {
        return current.filter((item) => item !== key);
      }
      if (current.length >= 2) {
        return [current[1], key];
      }
      return [...current, key];
    });
  }, []);

  const continueToNextEvent = useCallback(async () => {
    if (!currentChar || currentEvent || loading) return;
    await fetchNextEvent(currentChar.id);
  }, [currentChar, currentEvent, loading]);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const { ok, data } = await doFetch("/api/records");
      if (ok) setRecords(data.records ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const academicProgressLabel = getAcademicProgressLabel(currentChar);
  const runCompleted = Boolean(endingNotice);

  if (activeScreen === "auth") {
    return (
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
              <button className="pixel-button w-full px-4 py-3 text-sm font-bold" onClick={() => { setScreen("records"); loadRecords(); }}>기록 보기</button>
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
    );
  }

  if (activeScreen === "create" && !currentChar) {
    return (
      <main className="pixel-shell flex min-h-screen items-start justify-center p-4 pt-10">
        <div className="w-full max-w-lg">
          <div className="mb-6 flex items-center justify-between text-[#fff3d7]">
            <h1 className="text-2xl font-black">NEW RUN</h1>
            <div className="flex gap-3">
              {status === "authenticated" && (
                <button className="text-sm text-[#d9c9b5] underline" onClick={() => { setScreen("records"); loadRecords(); }}>
                  기록
                </button>
              )}
              <button className="text-sm text-[#d9c9b5] underline" onClick={() => setScreen("auth")}>
                {status === "authenticated" ? "계정" : "로그인/저장"}
              </button>
            </div>
          </div>
          <h2 className="mb-3 text-sm font-bold text-[#d9c9b5]">새 이야기</h2>
          {error && <p className="mb-4 border-2 border-[#b3423c] bg-[#ffe1db] p-2 text-sm font-bold text-[#8d2f2a]">{error}</p>}
          <div className="pixel-panel space-y-5 p-6">
            <div className="space-y-3 border-b border-[#eee8dd] pb-5 text-[15px] leading-7 text-[#3a332d]">
              <p>새벽 6시 47분, 모르는 번호에서 메시지가 도착했습니다. “오늘 고른 첫 선택이 졸업식까지 따라갑니다.” 장난 같지만, 휴대폰 화면에는 수강 정정, 알바 면접, 학과 단체 채팅, 누군가의 부재중 전화가 동시에 떠 있습니다.</p>
              <p>당신은 아직 자신이 어떤 학생으로 기억될지 모릅니다. 이름과 나이, 오늘 눈뜬 장소, 끝까지 믿고 싶은 능력만 정하면 나머지 전공, 학년, 첫 사건은 이 세계가 당신에게 붙여줄 것입니다.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold">당신의 이름은?</label>
              <input className="pixel-input w-full px-4 py-3 text-sm" maxLength={24} placeholder="한서윤" value={charName} onChange={(e) => setCharName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold">당신은 몇 살인가요?</label>
              <select className="pixel-input w-full px-4 py-3 text-sm" value={charAge} onChange={(e) => setCharAge(e.target.value)}>
                {Array.from({ length: 18 }, (_, i) => i + 18).map((age) => (<option key={age} value={age}>{age}세</option>))}
              </select>
            </div>
            <div>
              <p className="mb-2 block text-sm font-bold">당신은 어디에서 깨어났나요?</p>
              <div className="grid gap-2">
                {residenceOptions.map((option) => (
                  <button
                    className={`pixel-button px-4 py-3 text-left text-sm ${charResidence === option.id ? "bg-[#ffe0a2]" : ""}`}
                    key={option.id}
                    onClick={() => setCharResidence(option.id)}
                    type="button"
                  >
                    <span className="block font-bold">{charResidence === option.id ? "[선택됨] " : ""}{option.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-[#706b62]">{option.description}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 block text-sm font-bold">당신이 믿고 싶은 능력 두 가지는? ({preferredStats.length}/2)</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(statLabels).map(([key, label]) => (
                  <button
                    className={`pixel-button px-3 py-3 text-left text-sm ${preferredStats.includes(key) ? "bg-[#ffe0a2]" : ""}`}
                    key={key}
                    onClick={() => togglePreferredStat(key)}
                    type="button"
                  >
                    <span className="mr-2 text-xs text-[#8a4f2d]">{preferredStats.includes(key) ? "■" : "□"} {statIcons[key]}</span>
                    <span className="font-bold">{label}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-[#706b62]">선택한 두 능력은 첫 능력치에 조금 더 높게 반영됩니다.</p>
            </div>
            <button className="pixel-button-dark w-full px-4 py-3 text-sm font-bold disabled:opacity-50" disabled={loading || !charName.trim() || preferredStats.length !== 2} onClick={createCharacter}>눈을 뜬다</button>
          </div>
        </div>
      </main>
    );
  }

  if (activeScreen === "records") {
    return (
      <main className="records-screen min-h-screen p-4 pt-8">
        <div className="mx-auto max-w-5xl">
          <div className="record-hero mb-6 flex items-center justify-between gap-5 border-b-4 border-[#2a2018] pb-5 max-[720px]:block">
            <div>
              <p className="mb-2 text-xs font-black text-[#8a4f2d]">ARCHIVE</p>
              <h1 className="text-3xl font-black leading-tight">선택의 결과 기록</h1>
              <p className="mt-2 text-sm text-[#706b62]">플레이가 남긴 직업, 관계, 생활의 스냅샷</p>
            </div>
            <div className="flex gap-3 max-[720px]:mt-4">
              <button className="pixel-button bg-white px-4 py-2 text-sm font-bold text-[#2a241e]" onClick={loadRecords}>새로고침</button>
              <button className="pixel-button bg-white px-4 py-2 text-sm font-bold text-[#2a241e]" onClick={runCompleted ? startNewCharacter : () => { setScreen("play"); }}>
                {runCompleted ? "새로 시작" : "진행으로"}
              </button>
            </div>
          </div>
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
                <div className={`record-card record-card-${getRecordTone(r)} pixel-panel overflow-hidden`} key={r.id as string}>
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
                    </div>
                  )}
                </div>
              );
            })}
            {records.length === 0 && (
              <div className="pixel-panel border-dashed p-10 text-center">
                <p className="text-sm text-[#706b62]">아직 저장된 기록이 없습니다.</p>
                <p className="mt-2 text-xs text-[#a9967d]">게임을 플레이하고 충분한 사건을 경험하면 기록을 생성할 수 있습니다.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="app-layout pixel-shell min-h-screen text-[#2a241e]">
      <aside className="sidebar border-r border-[#3b3025] bg-[#231d17] p-[22px] text-[#f7efe2]">
        <div className="sidebar-top">
          <div className="sidebar-profile flex items-center gap-3">
            <PixelPortrait name={currentChar?.name} compact />
            <div className="min-w-0">
              <h1 className="text-[22px] font-bold leading-tight">{currentChar?.name ?? "..."}</h1>
              <p className="sidebar-major mt-1 text-[13px] leading-relaxed text-[#c4b39c]">{currentChar?.major} · {academicProgressLabel}</p>
            </div>
          </div>
          <div className="sidebar-progress mt-4 border-2 border-[#4d3d2f] bg-[#1b1612] p-3">
            <p className="text-[11px] font-bold uppercase tracking-normal text-[#a9967d]">학사 진행</p>
            <p className="mt-1 text-sm font-black leading-snug text-[#f7d08b]">{academicProgressLabel}</p>
          </div>
        </div>
        <nav className="sidebar-nav mt-[22px] grid gap-2">
          <button className={`rounded-lg px-2.5 py-2 text-left text-sm ${activeScreen === "play" ? "border border-[#7d6146] bg-[#3a2d21]" : "text-[#d9c9b5]"}`} onClick={() => setScreen("play")}>진행</button>
          <button className={`rounded-lg px-2.5 py-2 text-left text-sm ${activeScreen === "character_detail" ? "border border-[#7d6146] bg-[#3a2d21]" : "text-[#d9c9b5]"}`} onClick={() => setScreen("character_detail")}>캐릭터</button>
          <button className={`rounded-lg px-2.5 py-2 text-left text-sm ${activeScreen === "relationships" ? "border border-[#7d6146] bg-[#3a2d21]" : "text-[#d9c9b5]"}`} onClick={() => setScreen("relationships")}>관계</button>
          <button className="rounded-lg px-2.5 py-2 text-left text-sm text-[#d9c9b5]" onClick={() => { setScreen("records"); loadRecords(); }}>기록</button>
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
          <section className={`sidebar-stats mt-3.5 rounded-lg border border-[#4d3d2f] bg-[#1b1612] p-3.5 ${mobileStatsOpen ? "sidebar-stats-open" : ""}`}>
            <h2 className="text-base font-bold">능력치</h2>
            <dl className="mt-2 grid gap-2">
              {Object.entries(statLabels).map(([key, label]) => (
                <div className="rounded-md bg-[#2c231b] px-2.5 py-2 text-[13px]" key={key}>
                  <dt className="flex items-center justify-between gap-2">
                    <span><span className="mr-1.5 text-[11px] text-[#d79b52]">{statIcons[key]}</span>{label}</span>
                    {key === "wealth" ? (
                      <span className="text-[#c4b39c]">{formatWealth(statLevel(currentChar.stats?.[key] ?? 0))}</span>
                    ) : (
                      <span className="text-[#c4b39c]">{statLevel(currentChar.stats?.[key] ?? 0)}/10</span>
                    )}
                    </dt>
                    {key !== "wealth" && (
                      <dd className="mt-1.5 flex gap-1" aria-label={`${label} ${statLevel(currentChar.stats?.[key] ?? 0)}`}>
                        {Array.from({ length: 10 }, (_, i) => (
                        <span className={`h-1.5 flex-1 rounded-full ${i < statLevel(currentChar.stats?.[key] ?? 0) ? "bg-[#d79b52]" : "bg-[#4c4035]"}`} key={i} />
                      ))}
                    </dd>
                    )}
                </div>
              ))}
            </dl>
          </section>
        )}
        <section className="sidebar-notice mt-3.5 rounded-lg border border-[#4d3d2f] bg-[#1b1612] p-3.5">
          <h2 className="font-bold">패러디 안내</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[#c4b39c]">이 게임의 기업, 인물, 사건은 허구 및 패러디입니다.</p>
        </section>
      </aside>

      <main className="play-main bg-[#f7efe2] px-11 py-[34px]">
        {activeScreen === "play" && (
          <section className="mx-auto max-w-[760px]">
            {error && <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}
            {choiceFeedback && (
              <div className="feedback-pop pixel-panel mb-5 p-4">
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
                    <button className="pixel-button mt-4 px-4 py-2 text-sm font-bold" onClick={startNewCharacter}>새로 시작하기</button>
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
                <div className="mt-7 grid gap-3">
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
                  {pendingNext ? "다음 사건을 준비 중입니다." : "새 사건을 준비 중입니다."}
                </p>
                {loading && <p className="mt-3 text-sm text-[#706b62]">선택의 시간이 다가오고 있습니다...</p>}
              </div>
            )}
          </section>
        )}
        {activeScreen === "character_detail" && currentChar && (
          <section className="mx-auto max-w-[760px]">
            <h2 className="text-xl font-bold">캐릭터 상세</h2>
            <div className="mt-4 space-y-3">
              <div className="pixel-panel p-4">
                <p><strong>이름:</strong> {currentChar.name}</p>
                <p><strong>전공:</strong> {currentChar.major}</p>
                <p><strong>학사 진행:</strong> {getAcademicProgressLabel(currentChar)}</p>
                <p><strong>나이:</strong> {currentChar.age}세</p>
                <p><strong>학적:</strong> {formatAcademicStatus(currentChar.academicStatus)}</p>
              </div>
            </div>
          </section>
        )}
        {activeScreen === "relationships" && currentChar && (
          <section className="mx-auto max-w-[760px]">
            <h2 className="text-xl font-bold">관계</h2>
            <div className="mt-4 space-y-3">
              {currentChar.relationships?.map((rel) => (
                <div className="pixel-panel p-4" key={rel.name}>
                  <div className="flex items-center justify-between"><span className="font-bold">{rel.name}</span><span className="text-sm text-[#706b62]">{rel.role}</span></div>
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>{relationshipState(rel.trust)}</span>
                      <span className="font-bold">{trustHearts(rel.trust)}</span>
                    </div>
                    <div className="mt-2 h-3 border-2 border-[#2a2018] bg-[#d8c8b4]">
                      <div
                        className={`${rel.trust >= 0 ? "bg-[#d85f87]" : "bg-[#3f5f9f]"} h-full`}
                        style={{ width: `${Math.min(100, Math.abs(rel.trust))}%` }}
                      />
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">{(rel.tags ?? []).map((tag: string) => (<span className="rounded-full bg-[#efe5d7] px-2 py-1 text-xs text-[#68412b]" key={tag}>{tag}</span>))}</div>
                </div>
              ))}
              {(!currentChar.relationships || currentChar.relationships.length === 0) && <p className="text-sm text-[#706b62]">아직 관계 정보가 없습니다.</p>}
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
            border-bottom: 3px solid #0f0b08;
            padding: 10px 12px;
            box-shadow: 0 5px 0 #0d0b09;
          }
          .sidebar-top {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(108px, 32vw);
            gap: 8px;
            align-items: center;
          }
          .sidebar-profile {
            display: grid;
            grid-template-columns: 38px minmax(0, 1fr);
            gap: 8px;
            align-items: center;
          }
          .sidebar-profile :global(.pixel-portrait) {
            width: 38px;
            height: 42px;
            box-shadow: 2px 2px 0 #0a0705;
          }
          .sidebar-profile :global(.portrait-hair) {
            left: 8px;
            top: 5px;
            width: 22px;
            height: 9px;
            box-shadow: -5px 5px 0 #35261c, 5px 5px 0 #35261c;
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
          .sidebar-major { display: none; }
          .sidebar-progress {
            margin-top: 0;
            padding: 6px;
          }
          .sidebar-progress > div:first-child {
            font-size: 10px;
          }
          .sidebar-progress > div:last-child {
            height: 8px;
            margin-top: 4px;
          }
          .sidebar-nav {
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 6px;
            margin-top: 8px;
          }
          .sidebar-nav button {
            min-height: 34px;
            overflow: hidden;
            padding: 6px 4px;
            text-align: center;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 12px;
          }
          .mobile-stats-toggle {
            display: block;
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
            padding: 14px 12px 24px;
          }
        }
        @media (max-width: 420px) {
          .sidebar-top {
            grid-template-columns: minmax(0, 1fr) minmax(96px, 34vw);
          }
          .sidebar-profile {
            grid-template-columns: minmax(0, 1fr);
          }
          .sidebar-profile :global(.pixel-portrait) {
            display: none;
          }
          .sidebar-nav button {
            font-size: 11px;
          }
        }
      `}</style>
    </div>
  );
}
