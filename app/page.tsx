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

export default function AppPage() {
  const { status } = useSession();
  const [screen, setScreen] = useState<Screen>("auth");
  const [characters, setCharacters] = useState<CharacterData[]>([]);
  const [currentChar, setCurrentChar] = useState<CharacterData | null>(null);
  const [currentEvent, setCurrentEvent] = useState<EventData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);

  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  const [charName, setCharName] = useState("");
  const [charAge, setCharAge] = useState("21");
  const [charGrade, setCharGrade] = useState("2");
  const [charMajor, setCharMajor] = useState("");

  const mountedRef = useRef(false);

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
    if (ok) setCurrentEvent(data.currentEvent ?? null);
  }

  async function fetchNextEvent(charId: string) {
    const { ok, data } = await doFetch(`/api/characters/${charId}/events/next`, "POST");
    if (ok) setCurrentEvent(data.event);
  }

  const handleSignup = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const { ok, data } = await doFetch("/api/auth/signup", "POST", {
        email: authEmail,
        password: authPassword,
      });
      if (!ok) {
        setError(data.error || "회원가입에 실패했습니다.");
        return;
      }
      await signIn("credentials", { email: authEmail, password: authPassword, redirect: false });
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
      const res = await signIn("credentials", { email: authEmail, password: authPassword, redirect: false });
      if (res?.error) setError("이메일 또는 비밀번호가 일치하지 않습니다.");
    } finally {
      setLoading(false);
    }
  }, [authEmail, authPassword]);

  useEffect(() => {
    if (mountedRef.current || status !== "authenticated") return;
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
        startGradeYear: Number(charGrade),
        major: charMajor.trim(),
      });
      if (!ok) {
        setError(data.error || "캐릭터 생성에 실패했습니다.");
        return;
      }
      setCurrentChar(data.character);
      await fetchNextEvent(data.character.id);
      setScreen("play");
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [charName, charAge, charGrade, charMajor]);

  const pickCharacter = useCallback(async (char: CharacterData) => {
    setCurrentChar(char);
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
      await fetchNextEvent(currentChar.id);
      await loadCharacterEvent(currentChar.id);
    } finally {
      setLoading(false);
    }
  }, [currentChar, currentEvent]);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const { ok, data } = await doFetch("/api/records");
      if (ok) setRecords(data.records ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const generateRecord = useCallback(async () => {
    if (!currentChar) return;
    setLoading(true);
    setError("");
    try {
      const { ok } = await doFetch(`/api/characters/${currentChar.id}/records`, "POST");
      if (!ok) {
        setError("기록 생성에 실패했습니다.");
        return;
      }
      setScreen("records");
    } finally {
      setLoading(false);
    }
  }, [currentChar]);

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fbfaf6]">
        <p className="text-[#706b62]">로딩 중...</p>
      </main>
    );
  }

  if (status === "unauthenticated" || screen === "auth") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fbfaf6] p-4">
        <div className="w-full max-w-sm rounded-lg border border-[#ded9ce] bg-white p-8">
          <h1 className="mb-6 text-center text-2xl font-bold">College Career Sim</h1>
          <p className="mb-6 text-center text-sm text-[#706b62]">한국형 문학 텍스트 어드벤처</p>
          {error && <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}
          <div className="space-y-4">
            <input className="w-full rounded-lg border border-[#cbbfae] px-4 py-3 text-sm" placeholder="이메일" type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} />
            <input className="w-full rounded-lg border border-[#cbbfae] px-4 py-3 text-sm" placeholder="비밀번호 (8자 이상)" type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} />
            {authMode === "login" ? (
              <div className="space-y-3">
                <button className="w-full rounded-lg bg-[#232323] px-4 py-3 text-sm font-bold text-white hover:bg-[#3f3a34] disabled:opacity-50" disabled={loading} onClick={handleLogin}>로그인</button>
                <p className="text-center text-xs text-[#706b62]">계정이 없으신가요? <button className="text-[#8a4f2d] underline" onClick={() => setAuthMode("signup")}>회원가입</button></p>
              </div>
            ) : (
              <div className="space-y-3">
                <button className="w-full rounded-lg bg-[#232323] px-4 py-3 text-sm font-bold text-white hover:bg-[#3f3a34] disabled:opacity-50" disabled={loading} onClick={handleSignup}>회원가입</button>
                <p className="text-center text-xs text-[#706b62]">이미 계정이 있으신가요? <button className="text-[#8a4f2d] underline" onClick={() => setAuthMode("login")}>로그인</button></p>
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  if (screen === "create" && !currentChar) {
    return (
      <main className="flex min-h-screen items-start justify-center bg-[#fbfaf6] p-4 pt-16">
        <div className="w-full max-w-lg">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold">캐릭터 선택</h1>
            <button className="text-sm text-[#706b62] underline" onClick={() => signOut()}>로그아웃</button>
          </div>
          {characters.length > 0 && (
            <div className="mb-8">
              <h2 className="mb-3 text-sm font-bold text-[#706b62]">진행 중인 캐릭터</h2>
              <div className="space-y-2">
                {characters.map((c) => (
                  <button className="w-full rounded-lg border border-[#ded9ce] bg-white px-4 py-3 text-left hover:border-[#8a4f2d]" key={c.id} onClick={() => pickCharacter(c)}>
                    <span className="font-bold">{c.name}</span>
                    <span className="ml-2 text-sm text-[#706b62]">{c.major} · {c.currentGradeYear ?? c.startGradeYear}학년</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <h2 className="mb-3 text-sm font-bold text-[#706b62]">새 캐릭터</h2>
          {error && <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}
          <div className="space-y-4 rounded-lg border border-[#ded9ce] bg-white p-6">
            <div>
              <label className="mb-1 block text-sm font-bold">이름</label>
              <input className="w-full rounded-lg border border-[#cbbfae] px-4 py-3 text-sm" maxLength={24} placeholder="한서윤" value={charName} onChange={(e) => setCharName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold">나이</label>
              <select className="w-full rounded-lg border border-[#cbbfae] px-4 py-3 text-sm" value={charAge} onChange={(e) => setCharAge(e.target.value)}>
                {Array.from({ length: 18 }, (_, i) => i + 18).map((age) => (<option key={age} value={age}>{age}세</option>))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold">학년</label>
              <select className="w-full rounded-lg border border-[#cbbfae] px-4 py-3 text-sm" value={charGrade} onChange={(e) => setCharGrade(e.target.value)}>
                {[1, 2, 3, 4].map((g) => (<option key={g} value={g}>{g}학년</option>))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold">전공</label>
              <input className="w-full rounded-lg border border-[#cbbfae] px-4 py-3 text-sm" maxLength={40} placeholder="사회학과" value={charMajor} onChange={(e) => setCharMajor(e.target.value)} />
            </div>
            <button className="w-full rounded-lg bg-[#232323] px-4 py-3 text-sm font-bold text-white hover:bg-[#3f3a34] disabled:opacity-50" disabled={loading || !charName.trim() || !charMajor.trim()} onClick={createCharacter}>시작</button>
          </div>
        </div>
      </main>
    );
  }

  if (screen === "records") {
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

  const statLabels: Record<string, string> = {
    academic: "학업", practical: "실무", communication: "커뮤니케이션", creativity: "창의성",
    health: "건강", mental: "멘탈", network: "네트워크", wealth: "자산", reputation: "평판", charm: "매력",
  };

  return (
    <div className="app-layout min-h-screen bg-[#fbfaf6] text-[#232323]">
      <aside className="sidebar border-r border-[#ded9ce] bg-[#f2efe7] p-[22px] max-[900px]:border-0 max-[900px]:p-[18px]">
        <h1 className="text-[22px] font-bold leading-tight">{currentChar?.name ?? "..."}</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-[#706b62]">{currentChar?.major} {currentChar?.currentGradeYear ?? currentChar?.startGradeYear}학년 · 이벤트 {currentChar?.coreEventCount}회</p>
        <nav className="mt-[22px] grid gap-2">
          <button className={`rounded-lg px-2.5 py-2 text-left text-sm ${screen === "play" ? "border border-[#ded9ce] bg-white" : ""}`} onClick={() => setScreen("play")}>진행</button>
          <button className={`rounded-lg px-2.5 py-2 text-left text-sm ${screen === "character_detail" ? "border border-[#ded9ce] bg-white" : ""}`} onClick={() => setScreen("character_detail")}>캐릭터</button>
          <button className={`rounded-lg px-2.5 py-2 text-left text-sm ${screen === "relationships" ? "border border-[#ded9ce] bg-white" : ""}`} onClick={() => setScreen("relationships")}>관계</button>
          <button className="rounded-lg px-2.5 py-2 text-left text-sm" onClick={() => { setScreen("records"); loadRecords(); }}>커리어와 엔딩 기록</button>
          <button className="rounded-lg px-2.5 py-2 text-left text-sm text-[#706b62]" onClick={() => signOut()}>로그아웃</button>
        </nav>
        {currentChar?.stats && (
          <section className="mt-3.5 rounded-lg border border-[#ded9ce] bg-white p-3.5">
            <h2 className="text-base font-bold">공개 스탯</h2>
            <dl className="mt-2">
              {Object.entries(statLabels).map(([key, label]) => (
                <div className="flex justify-between gap-2 border-b border-[#eee8dd] py-[7px] text-[13px] last:border-b-0" key={key}>
                  <dt>{label}</dt>
                  <dd className="font-bold">{currentChar.stats?.[key] ?? 0}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
        <section className="mt-3.5 rounded-lg border border-[#ded9ce] bg-white p-3.5">
          <h2 className="font-bold">패러디 안내</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[#706b62]">이 게임의 기업, 인물, 사건은 허구 및 패러디입니다.</p>
        </section>
      </aside>

      <main className="px-11 py-[34px] max-[900px]:px-[18px] max-[900px]:py-[22px]">
        {screen === "play" && (
          <section className="mx-auto max-w-[760px]">
            {error && <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}
            {currentEvent && (
              <>
                <p className="mb-4 text-[13px] font-bold text-[#8a4f2d]">{currentEvent.source === "FORCED" ? "⚡ 강제 이벤트 발생" : currentEvent.title}</p>
                <div className="text-xl leading-[1.82] tracking-normal max-[900px]:text-[17px] max-[900px]:leading-[1.72]">
                  {currentEvent.body.split("\n").map((p, i) => (<p className="mt-3 first:mt-0" key={i}>{p}</p>))}
                </div>
                <div className="mt-7 grid gap-2.5">
                  {currentEvent.choices.map((choice, idx) => (
                    <button className="min-h-12 rounded-lg border border-[#cbbfae] bg-white px-4 py-3.5 text-left text-[15px] text-[#2f2b26] hover:border-[#8a4f2d] hover:bg-[#fff9f2] disabled:opacity-50" disabled={loading} key={choice.id} onClick={() => makeChoice(idx)}>
                      {choice.label}
                    </button>
                  ))}
                </div>
              </>
            )}
            {!currentEvent && (
              <div className="text-center">
                <p className="text-[#706b62]">새 이벤트를 준비 중입니다...</p>
                <button className="mt-4 rounded-lg bg-[#232323] px-6 py-3 text-sm font-bold text-white" disabled={loading} onClick={() => currentChar && fetchNextEvent(currentChar.id)}>다음 이벤트</button>
              </div>
            )}
            <div className="mt-8 flex justify-center gap-4">
              <button className="rounded-lg border border-[#ded9ce] bg-white px-4 py-2 text-sm text-[#706b62] hover:border-[#8a4f2d]" onClick={generateRecord}>기록 생성</button>
            </div>
          </section>
        )}
        {screen === "character_detail" && currentChar && (
          <section className="mx-auto max-w-[760px]">
            <h2 className="text-xl font-bold">캐릭터 상세</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-[#ded9ce] bg-white p-4">
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
        {screen === "relationships" && currentChar && (
          <section className="mx-auto max-w-[760px]">
            <h2 className="text-xl font-bold">관계</h2>
            <div className="mt-4 space-y-3">
              {currentChar.relationships?.map((rel) => (
                <div className="rounded-lg border border-[#ded9ce] bg-white p-4" key={rel.name}>
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

      <aside className="right-sidebar border-l border-[#ded9ce] p-[22px] max-[900px]:border-0 max-[900px]:p-[18px]">
        <h2 className="text-[22px] font-bold leading-tight">기억과 관계</h2>
        <section className="mt-3.5 rounded-lg border border-[#ded9ce] bg-white p-3.5">
          <h3 className="font-bold">주요 인물</h3>
          <div className="mt-2 space-y-1">
            {currentChar?.relationships?.slice(0, 3).map((rel) => (<p className="text-[13px] leading-relaxed text-[#706b62]" key={rel.name}>{rel.name} · {rel.role} · 신뢰 {rel.trust}</p>))}
            {(!currentChar?.relationships || currentChar.relationships.length === 0) && <p className="text-[13px] text-[#706b62]">정보 없음</p>}
          </div>
        </section>
        <section className="mt-3.5 rounded-lg border border-[#ded9ce] bg-white p-3.5">
          <h3 className="font-bold">최근 기억</h3>
          <div className="mt-2 flex flex-wrap gap-1">
            {currentChar?.eventHistory?.slice(0, 5).map((h, i) => (<span className="rounded-full bg-[#efe5d7] px-2 py-1 text-xs text-[#68412b]" key={i}>{h.summary.slice(0, 15)}</span>))}
            {(!currentChar?.eventHistory || currentChar.eventHistory.length === 0) && <span className="text-xs text-[#706b62]">아직 기록 없음</span>}
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