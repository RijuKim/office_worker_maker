import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "./api";
import { playCue, startBgm, stopBgm, vibrate, type AudioSettings } from "./audio";
import type { CareerRecord, CharacterData, ChoiceFeedback, EventData, Screen } from "./types";

const statLabels: Record<string, string> = {
  academic: "학업",
  practical: "실무",
  health: "건강",
  mental: "멘탈",
  wealth: "자산",
  charm: "매력",
  reputation: "평판",
};

const preferredStats = ["academic", "practical", "health", "mental", "wealth", "reputation"];

function progressLabel(character: CharacterData | null) {
  if (!character) return "새 이야기";
  if (character.progressLabel) return character.progressLabel;
  if (character.lifeStage?.term?.label) return character.lifeStage.term.label;
  return `${character.currentGradeYear ?? character.startGradeYear}학년`;
}

function statDeltaText(delta: Record<string, number>) {
  const entries = Object.entries(delta).filter(([, value]) => value !== 0);
  if (entries.length === 0) return "변화 없음";
  return entries.map(([key, value]) => `${statLabels[key] ?? key} ${value > 0 ? "+" : ""}${value}`).join(" · ");
}

export function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() => {
    const saved = localStorage.getItem("sano-toss-audio");
    if (!saved) return { music: false, sfx: true, haptics: true };
    try {
      return { music: false, sfx: true, haptics: true, ...JSON.parse(saved) };
    } catch {
      return { music: false, sfx: true, haptics: true };
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [characters, setCharacters] = useState<CharacterData[]>([]);
  const [currentCharacter, setCurrentCharacter] = useState<CharacterData | null>(null);
  const [currentEvent, setCurrentEvent] = useState<EventData | null>(null);
  const [feedback, setFeedback] = useState<ChoiceFeedback | null>(null);
  const [records, setRecords] = useState<CareerRecord[]>([]);
  const [name, setName] = useState("김민수");
  const [age, setAge] = useState(22);
  const [residence, setResidence] = useState("studio");
  const [selectedStats, setSelectedStats] = useState<string[]>(["practical", "mental"]);

  const apiBaseLabel = useMemo(() => import.meta.env.VITE_API_BASE_URL || "same-origin", []);

  const cue = useCallback((kind: "tap" | "success" | "warning" | "ending" = "tap") => {
    playCue(kind, audioSettings.sfx);
    vibrate(audioSettings.haptics, kind === "warning" ? [16, 20, 16] : 12);
  }, [audioSettings.haptics, audioSettings.sfx]);

  const openCharacter = useCallback(async (character: CharacterData) => {
    setLoading(true);
    setError("");
    setFeedback(null);
    try {
      const result = await api.character(character.id);
      if (!result.ok) {
        setError(result.data.error ?? "진행 정보를 불러오지 못했습니다.");
        return;
      }
      setCurrentCharacter(result.data.character ?? character);
      setCurrentEvent(result.data.currentEvent ?? result.data.character?.events?.[0] ?? null);
      setScreen("play");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshCharacters = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.characters();
      if (!result.ok) {
        setError(result.status === 401 ? "로그인이 필요합니다." : result.data.error ?? "목록을 불러오지 못했습니다.");
        return;
      }
      const nextCharacters = result.data.characters ?? [];
      setCharacters(nextCharacters);
      if (!currentCharacter && nextCharacters[0]) {
        await openCharacter(nextCharacters[0]);
      }
    } finally {
      setLoading(false);
    }
  }, [currentCharacter, openCharacter]);

  const createCharacter = useCallback(async () => {
    cue("tap");
    setLoading(true);
    setError("");
    try {
      const result = await api.createCharacter({ name: name.trim(), age, residence, preferredStats: selectedStats });
      if (!result.ok || !result.data.character) {
        setError(result.data.error ?? "캐릭터를 만들지 못했습니다.");
        return;
      }
      setCurrentCharacter(result.data.character);
      setCurrentEvent(result.data.character.events?.[0] ?? null);
      setScreen("play");
      cue("success");
      void refreshCharacters();
    } finally {
      setLoading(false);
    }
  }, [age, cue, name, refreshCharacters, residence, selectedStats]);

  const choose = useCallback(async (choiceIndex: number) => {
    if (!currentCharacter || !currentEvent) return;
    cue("tap");
    setLoading(true);
    setError("");
    try {
      const result = await api.choose(currentCharacter.id, choiceIndex);
      if (!result.ok) {
        setError(result.data.error ?? "선택을 처리하지 못했습니다.");
        return;
      }
      setFeedback({
        statDelta: result.data.result?.statDelta ?? {},
        relationshipDelta: result.data.result?.relationshipDelta ?? [],
        summary: result.data.result?.summary ?? "",
      });
      if (result.data.result?.endingTriggered) {
        setCurrentEvent(null);
        cue("ending");
        return;
      }
      const next = await api.nextEvent(currentCharacter.id);
      if (next.ok && next.data.event) {
        setCurrentEvent(next.data.event);
        cue("success");
      } else {
        await openCharacter(currentCharacter);
      }
    } finally {
      setLoading(false);
    }
  }, [cue, currentCharacter, currentEvent, openCharacter]);

  const loadRecords = useCallback(async () => {
    cue("tap");
    setLoading(true);
    setError("");
    try {
      const result = await api.records();
      if (!result.ok) {
        setError(result.data.error ?? "기록을 불러오지 못했습니다.");
        return;
      }
      setRecords(result.data.records ?? []);
      setScreen("records");
    } finally {
      setLoading(false);
    }
  }, [cue]);

  useEffect(() => {
    localStorage.setItem("sano-toss-audio", JSON.stringify(audioSettings));
    if (audioSettings.music) void startBgm(true);
    else stopBgm();
  }, [audioSettings]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") stopBgm();
      else if (audioSettings.music) void startBgm(true);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [audioSettings.music]);

  useEffect(() => {
    history.pushState(null, "", location.href);
    const blockBack = () => history.pushState(null, "", location.href);
    window.addEventListener("popstate", blockBack);
    const timer = window.setTimeout(() => {
      void refreshCharacters();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("popstate", blockBack);
    };
  }, [refreshCharacters]);

  return (
    <main className="app-shell">
      <div className="top-chrome">
        <button className="icon-button" type="button" aria-label="메뉴" onClick={() => setMenuOpen((value) => !value)}>☰</button>
        <button className="icon-button" type="button" aria-label="설정" onClick={() => setSettingsOpen((value) => !value)}>⚙</button>
      </div>

      {menuOpen && (
        <nav className="popover menu-popover">
          <button type="button" onClick={() => { cue(); setScreen("home"); setMenuOpen(false); }}>진행</button>
          <button type="button" onClick={() => { cue(); setScreen("create"); setMenuOpen(false); }}>새로 시작</button>
          <button type="button" onClick={() => { setMenuOpen(false); void loadRecords(); }}>기록</button>
        </nav>
      )}

      {settingsOpen && (
        <section className="popover settings-popover" aria-label="설정">
          <label><input type="checkbox" checked={audioSettings.music} onChange={(event) => setAudioSettings((value) => ({ ...value, music: event.target.checked }))} /> BGM</label>
          <label><input type="checkbox" checked={audioSettings.sfx} onChange={(event) => setAudioSettings((value) => ({ ...value, sfx: event.target.checked }))} /> 효과음</label>
          <label><input type="checkbox" checked={audioSettings.haptics} onChange={(event) => setAudioSettings((value) => ({ ...value, haptics: event.target.checked }))} /> 햅틱</label>
        </section>
      )}

      <section className="hero-panel">
        <p className="eyebrow">취준 생활 시뮬레이션</p>
        <h1>일어나보니 대한민국 취준생</h1>
        <p className="hero-copy">스펙, 멘탈, 통장잔고까지 관리해야 하는 가상 취준 생활을 직접 굴려보세요.</p>
        <div className="status-row">
          <span>{progressLabel(currentCharacter)}</span>
          <span>{apiBaseLabel}</span>
        </div>
      </section>

      {error && <p className="error-banner">{error}</p>}

      {screen === "home" && (
        <section className="screen-stack">
          <div className="action-grid">
            <button className="primary-button" type="button" disabled={loading} onClick={() => currentCharacter ? void openCharacter(currentCharacter) : setScreen("create")}>
              {currentCharacter ? "이어하기" : "시작하기"}
            </button>
            <button className="secondary-button" type="button" disabled={loading} onClick={() => void refreshCharacters()}>새로고침</button>
          </div>
          <div className="list-panel">
            {characters.length === 0 ? (
              <p className="muted">저장된 진행이 없습니다.</p>
            ) : characters.map((character) => (
              <button className="run-row" type="button" key={character.id} onClick={() => void openCharacter(character)}>
                <strong>{character.name}</strong>
                <span>{character.major} · {progressLabel(character)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {screen === "create" && (
        <section className="screen-stack">
          <label className="field">이름<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="field">나이<input type="number" value={age} onChange={(event) => setAge(Number(event.target.value))} /></label>
          <div className="segmented">
            {["family_home", "studio", "dorm"].map((value) => (
              <button className={residence === value ? "selected" : ""} type="button" key={value} onClick={() => setResidence(value)}>
                {value === "family_home" ? "본가" : value === "studio" ? "자취" : "기숙사"}
              </button>
            ))}
          </div>
          <div className="chip-grid">
            {preferredStats.map((stat) => (
              <button className={selectedStats.includes(stat) ? "selected" : ""} type="button" key={stat} onClick={() => setSelectedStats((current) => current.includes(stat) ? current.filter((item) => item !== stat) : [...current.slice(-1), stat])}>
                {statLabels[stat]}
              </button>
            ))}
          </div>
          <button className="primary-button" type="button" disabled={loading || !name.trim()} onClick={() => void createCharacter()}>생성</button>
        </section>
      )}

      {screen === "play" && (
        <section className="screen-stack">
          {currentCharacter && (
            <div className="stats-grid">
              {Object.entries(currentCharacter.stats).map(([key, value]) => (
                <span key={key}><b>{statLabels[key] ?? key}</b>{value}</span>
              ))}
            </div>
          )}
          {feedback && (
            <div className="feedback-panel">
              <strong>{statDeltaText(feedback.statDelta)}</strong>
              <p>{feedback.summary}</p>
            </div>
          )}
          {currentEvent ? (
            <article className="event-panel">
              <span className="source-pill">{currentEvent.source}</span>
              <h2>{currentEvent.title}</h2>
              <p>{currentEvent.body}</p>
              <div className="choice-stack">
                {currentEvent.choices.map((choice, index) => (
                  <button type="button" key={choice.id} disabled={loading} onClick={() => void choose(index)}>
                    {choice.label}
                  </button>
                ))}
              </div>
            </article>
          ) : (
            <div className="list-panel">
              <p className="muted">현재 진행 가능한 상황이 없습니다.</p>
              <button className="primary-button" type="button" onClick={() => currentCharacter && void api.nextEvent(currentCharacter.id).then(() => openCharacter(currentCharacter))}>다음 상황</button>
            </div>
          )}
        </section>
      )}

      {screen === "records" && (
        <section className="screen-stack">
          <div className="action-grid">
            <button className="secondary-button" type="button" onClick={() => void loadRecords()}>새로고침</button>
            <button className="secondary-button" type="button" onClick={() => setScreen("home")}>이어가기</button>
          </div>
          {records.map((record) => (
            <article className="record-panel" key={record.id}>
              <strong>{record.title ?? record.destination ?? "선택의 결과"}</strong>
              <p>{record.summary ?? ""}</p>
              <span>{record.satisfaction ? `만족도 ${record.satisfaction}` : record.createdAt?.slice(0, 10)}</span>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
