"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";

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
}

interface EventData {
  id: string;
  title: string;
  body: string;
  choices: { id: string; label: string; statDelta: Record<string, number> }[];
  source: string;
  forced?: boolean;
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
  return Math.max(1, Math.min(5, Math.ceil(value / 20)));
}

export default function AppPage() {
  const { status } = useSession();
  const [screen, setScreen] = useState<Screen>("auth");
  const [characters, setCharacters] = useState<CharacterData[]>([]);
  const [currentChar, setCurrentChar] = useState<CharacterData | null>(null);
  const [currentEvent, setCurrentEvent] = useState<EventData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [pendingNext, setPendingNext] = useState(false);

  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  const [charName, setCharName] = useState("");
  const [charAge, setCharAge] = useState("21");
  const [charResidence, setCharResidence] = useState("studio");
  const [preferredStats, setPreferredStats] = useState<string[]>(["academic", "mental"]);

  const mountedRef = useRef(false);
  const activeScreen = status === "authenticated" && screen === "auth" ? "create" : screen;

  async function doFetch(url: string, method = "GET", body?: unknown) {
    const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  async function loadCharacters() {
    setLoading(true);
    try {
      const { ok, data } = await doFetch("/api/characters");
      if (ok) setCharacters(data.characters ?? []);
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

  async function fetchNextEvent(charId: string) {
    const { ok, data } = await doFetch(`/api/characters/${charId}/events/next`, "POST");
    if (ok) {
      setCurrentEvent(data.event);
      await loadCharacterEvent(charId);
      setPendingNext(false);
    }
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
    if (status !== "authenticated") {
      mountedRef.current = false;
      return;
    }
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

  const pickCharacter = useCallback(async (char: CharacterData) => {
    setCurrentChar(char);
    setPendingNext(false);
    if (char.currentEventId) {
      await loadCharacterEvent(char.id);
    } else {
      await fetchNextEvent(char.id);
    }
    setScreen("play");
  }, []);

  const makeChoice = useCallback(async (choiceIndex: number) => {
    if (!currentChar || !currentEvent) return;
    setLoading(true);
    try {
      const { ok } = await doFetch(`/api/characters/${currentChar.id}/choices`, "POST", {
        choiceIndex,
      });
      if (!ok) return;
      await loadCharacterEvent(currentChar.id);
      setCurrentEvent(null);
      setPendingNext(true);
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

  if (status === "loading") {
    return (
      <main className="pixel-shell flex min-h-screen items-center justify-center">
        <p className="pixel-panel px-6 py-4 text-[#2a241e]">로딩 중...</p>
      </main>
    );
  }

  if (status === "unauthenticated") {
    return (
      <main className="pixel-shell flex min-h-screen items-center justify-center p-4">
        <div className="pixel-panel w-full max-w-sm p-8">
          <h1 className="mb-4 text-center text-2xl font-black leading-9">일어나보니<br />대한민국 취준생</h1>
          <p className="mb-6 border-y-2 border-[#2a2018] py-2 text-center text-xs font-bold text-[#6d4a2f]">LITERARY CAREER ADVENTURE</p>
          {error && <p className="mb-4 border-2 border-[#b3423c] bg-[#ffe1db] p-2 text-sm font-bold text-[#8d2f2a]">{error}</p>}
          <div className="space-y-4">
            <input className="pixel-input w-full px-4 py-3 text-sm" placeholder="이메일" type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} />
            <input className="pixel-input w-full px-4 py-3 text-sm" placeholder="비밀번호 (8자 이상)" type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} />
            {authMode === "login" ? (
              <div className="space-y-3">
                <button className="pixel-button-dark w-full px-4 py-3 text-sm font-bold disabled:opacity-50" disabled={loading} onClick={handleLogin}>로그인</button>
                <p className="text-center text-xs text-[#706b62]">계정이 없으신가요? <button className="text-[#8a4f2d] underline" onClick={() => setAuthMode("signup")}>회원가입</button></p>
              </div>
            ) : (
              <div className="space-y-3">
                <button className="pixel-button-dark w-full px-4 py-3 text-sm font-bold disabled:opacity-50" disabled={loading} onClick={handleSignup}>회원가입</button>
                <p className="text-center text-xs text-[#706b62]">이미 계정이 있으신가요? <button className="text-[#8a4f2d] underline" onClick={() => setAuthMode("login")}>로그인</button></p>
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  if (activeScreen === "create" && !currentChar) {
    return (
      <main className="pixel-shell flex min-h-screen items-start justify-center p-4 pt-10">
        <div className="w-full max-w-lg">
          <div className="mb-6 flex items-center justify-between text-[#fff3d7]">
            <h1 className="text-2xl font-black">LOAD / NEW</h1>
            <button className="text-sm text-[#d9c9b5] underline" onClick={() => signOut()}>로그아웃</button>
          </div>
          {characters.length > 0 && (
            <div className="mb-8">
              <h2 className="mb-3 text-sm font-bold text-[#d9c9b5]">진행 중인 캐릭터</h2>
              <div className="space-y-2">
                {characters.map((c) => (
                  <button className="pixel-button w-full px-4 py-3 text-left" key={c.id} onClick={() => pickCharacter(c)}>
                    <span className="font-bold">{c.name}</span>
                    <span className="ml-2 text-sm text-[#706b62]">{c.major} · {c.currentGradeYear ?? c.startGradeYear}학년</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <h2 className="mb-3 text-sm font-bold text-[#d9c9b5]">새 이야기</h2>
          {error && <p className="mb-4 border-2 border-[#b3423c] bg-[#ffe1db] p-2 text-sm font-bold text-[#8d2f2a]">{error}</p>}
          <div className="pixel-panel space-y-5 p-6">
            <div className="space-y-3 border-b border-[#eee8dd] pb-5 text-[15px] leading-7 text-[#3a332d]">
              <p>눈을 뜨자 당신은 낯선 침대에서 깨어났습니다. 창밖은 대한민국의 평범한 아침인데, 휴대폰에는 수강 정정과 알바 공고와 읽지 않은 단체 채팅이 한꺼번에 쌓여 있습니다.</p>
              <p>당신이 누구인지, 어디서 하루를 시작하는지, 어떤 능력에 조금 더 기대고 싶은지 떠올려 주세요. 나머지 전공, 학년, 첫 스탯과 사건은 이 세계가 알아서 당신에게 붙여줄 것입니다.</p>
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
                  >
                    <span className="block font-bold">{option.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-[#706b62]">{option.description}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 block text-sm font-bold">당신이 믿고 싶은 능력 두 가지는?</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(statLabels).map(([key, label]) => (
                  <button
                    className={`pixel-button px-3 py-3 text-left text-sm ${preferredStats.includes(key) ? "bg-[#ffe0a2]" : ""}`}
                    key={key}
                    onClick={() => togglePreferredStat(key)}
                  >
                    <span className="mr-2 text-xs text-[#8a4f2d]">{statIcons[key]}</span>
                    <span className="font-bold">{label}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-[#706b62]">선택한 두 능력은 최초 공개 스탯에 조금 더 높게 반영됩니다.</p>
            </div>
            <button className="pixel-button-dark w-full px-4 py-3 text-sm font-bold disabled:opacity-50" disabled={loading || !charName.trim() || preferredStats.length !== 2} onClick={createCharacter}>눈을 뜬다</button>
          </div>
        </div>
      </main>
    );
  }

  if (activeScreen === "records") {
    return (
      <main className="min-h-screen bg-[#fbfaf6] p-4 pt-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold">커리어와 엔딩 기록</h1>
            <div className="flex gap-3">
              <button className="text-sm text-[#706b62] underline" onClick={() => { setScreen("play"); loadRecords(); }}>진행으로</button>
              <button className="text-sm text-[#706b62] underline" onClick={() => signOut()}>로그아웃</button>
            </div>
          </div>
          <button className="mb-4 w-full rounded-lg border border-[#ded9ce] bg-white px-4 py-3 text-left text-sm hover:border-[#8a4f2d]" onClick={loadRecords}>기록 새로고침</button>
          <div className="space-y-3">
            {records.map((r: Record<string, unknown>) => (
              <div className="rounded-lg border border-[#ded9ce] bg-white p-5" key={r.id as string}>
                <h2 className="text-lg font-bold">{r.title as string}</h2>
                <p className="mt-2 text-sm text-[#706b62]">{r.summary as string}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-[#efe5d7] px-2.5 py-1 text-xs text-[#68412b]">{r.careerPath as string}</span>
                  <span className="rounded-full bg-[#efe5d7] px-2.5 py-1 text-xs text-[#68412b]">만족도: {r.satisfaction as number}</span>
                  <span className="rounded-full bg-[#efe5d7] px-2.5 py-1 text-xs text-[#68412b]">워라밸: {r.workLifeBalance as number}</span>
                </div>
              </div>
            ))}
            {records.length === 0 && <p className="text-center text-sm text-[#706b62]">아직 저장된 기록이 없습니다.</p>}
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="app-layout pixel-shell min-h-screen text-[#2a241e]">
      <aside className="sidebar border-r border-[#3b3025] bg-[#231d17] p-[22px] text-[#f7efe2] max-[900px]:border-0 max-[900px]:p-[18px]">
        <h1 className="text-[22px] font-bold leading-tight">{currentChar?.name ?? "..."}</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-[#c4b39c]">{currentChar?.major} {currentChar?.currentGradeYear ?? currentChar?.startGradeYear}학년 · 사건 {currentChar?.coreEventCount}회</p>
        <nav className="mt-[22px] grid gap-2">
          <button className={`rounded-lg px-2.5 py-2 text-left text-sm ${activeScreen === "play" ? "border border-[#7d6146] bg-[#3a2d21]" : "text-[#d9c9b5]"}`} onClick={() => setScreen("play")}>진행</button>
          <button className={`rounded-lg px-2.5 py-2 text-left text-sm ${activeScreen === "character_detail" ? "border border-[#7d6146] bg-[#3a2d21]" : "text-[#d9c9b5]"}`} onClick={() => setScreen("character_detail")}>캐릭터</button>
          <button className={`rounded-lg px-2.5 py-2 text-left text-sm ${activeScreen === "relationships" ? "border border-[#7d6146] bg-[#3a2d21]" : "text-[#d9c9b5]"}`} onClick={() => setScreen("relationships")}>관계</button>
          <button className="rounded-lg px-2.5 py-2 text-left text-sm text-[#d9c9b5]" onClick={() => { setScreen("records"); loadRecords(); }}>커리어와 엔딩 기록</button>
          <button className="rounded-lg px-2.5 py-2 text-left text-sm text-[#a9967d]" onClick={() => signOut()}>로그아웃</button>
        </nav>
        {currentChar?.stats && (
          <section className="mt-3.5 rounded-lg border border-[#4d3d2f] bg-[#1b1612] p-3.5">
            <h2 className="text-base font-bold">공개 스탯</h2>
            <dl className="mt-2 grid gap-2">
              {Object.entries(statLabels).map(([key, label]) => (
                <div className="rounded-md bg-[#2c231b] px-2.5 py-2 text-[13px]" key={key}>
                  <dt className="flex items-center justify-between gap-2">
                    <span><span className="mr-1.5 text-[11px] text-[#d79b52]">{statIcons[key]}</span>{label}</span>
                    <span className="text-[#c4b39c]">{statLevel(currentChar.stats?.[key] ?? 0)}/5</span>
                  </dt>
                  <dd className="mt-1.5 flex gap-1" aria-label={`${label} ${statLevel(currentChar.stats?.[key] ?? 0)}점`}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <span className={`h-2.5 flex-1 rounded-full ${i < statLevel(currentChar.stats?.[key] ?? 0) ? "bg-[#d79b52]" : "bg-[#4c4035]"}`} key={i} />
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}
        <section className="mt-3.5 rounded-lg border border-[#4d3d2f] bg-[#1b1612] p-3.5">
          <h2 className="font-bold">패러디 안내</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[#c4b39c]">이 게임의 기업, 인물, 사건은 허구 및 패러디입니다.</p>
        </section>
      </aside>

      <main className="bg-[#f7efe2] px-11 py-[34px] max-[900px]:px-[18px] max-[900px]:py-[22px]">
        {activeScreen === "play" && (
          <section className="mx-auto max-w-[760px]">
            {error && <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}
            {currentEvent && (
              <>
                <p className="mb-4 text-[13px] font-bold text-[#8a4f2d]">{currentEvent.source === "FORCED" ? "강제 이벤트 발생" : currentEvent.source === "AI" ? `${currentEvent.title} · AI` : currentEvent.title}</p>
                <div className="pixel-panel novel-text p-6 text-xl tracking-normal max-[900px]:text-[17px]">
                  {currentEvent.body.split("\n").map((p, i) => (<p className="mt-3 first:mt-0" key={i}>{p}</p>))}
                </div>
                <div className="mt-7 grid gap-2.5">
                  {currentEvent.choices.map((choice, idx) => (
                    <button className="pixel-button min-h-12 px-4 py-3.5 text-left text-[15px] disabled:opacity-50" disabled={loading} key={choice.id} onClick={() => makeChoice(idx)}>
                      {choice.label}
                    </button>
                  ))}
                </div>
              </>
            )}
            {!currentEvent && (
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
                  {pendingNext ? "선택의 여운이 잠시 방 안에 남습니다. 다음 문장을 읽으려면 이 화면을 누르세요." : "새 사건을 준비 중입니다. 계속하려면 이 화면을 누르세요."}
                </p>
                {loading && <p className="mt-3 text-sm text-[#706b62]">다음 장면을 불러오는 중...</p>}
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
                <p><strong>학년:</strong> {currentChar.currentGradeYear ?? currentChar.startGradeYear}학년</p>
                <p><strong>나이:</strong> {currentChar.age}세</p>
                <p><strong>학적:</strong> {currentChar.academicStatus === "ENROLLED" ? "재학" : currentChar.academicStatus}</p>
                <p><strong>핵심 이벤트:</strong> {currentChar.coreEventCount}회</p>
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
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm">신뢰:</span>
                    <div className="h-2 flex-1 rounded-full bg-[#eee8dd]"><div className="h-2 rounded-full bg-[#8a4f2d]" style={{ width: `${rel.trust}%` }} /></div>
                    <span className="text-sm font-bold">{rel.trust}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">{(rel.tags ?? []).map((tag: string) => (<span className="rounded-full bg-[#efe5d7] px-2 py-1 text-xs text-[#68412b]" key={tag}>{tag}</span>))}</div>
                </div>
              ))}
              {(!currentChar.relationships || currentChar.relationships.length === 0) && <p className="text-sm text-[#706b62]">아직 관계 정보가 없습니다.</p>}
            </div>
          </section>
        )}
      </main>

      <aside className="right-sidebar border-l border-[#3b3025] bg-[#241b15] p-[22px] text-[#fff3d7] max-[900px]:border-0 max-[900px]:p-[18px]">
        <h2 className="text-[22px] font-black leading-tight">기억과 관계</h2>
        <section className="pixel-panel-dark mt-3.5 p-3.5">
          <h3 className="font-bold">주요 인물</h3>
          <div className="mt-2 space-y-1">
            {currentChar?.relationships?.slice(0, 3).map((rel) => (<p className="text-[13px] leading-relaxed text-[#d9c9b5]" key={rel.name}>{rel.name} · {rel.role} · 신뢰 {rel.trust}</p>))}
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
        @media (max-width: 768px) { .app-layout { display: block; } .sidebar, .right-sidebar, main { border: 0 !important; padding: 18px !important; } }
      `}</style>
    </div>
  );
}
