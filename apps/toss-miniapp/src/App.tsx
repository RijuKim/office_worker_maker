import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "./api";
import { playCue, startBgm, stopBgm, vibrate, type AudioSettings } from "./audio";
import { getTossAnonymousKey } from "./toss-auth";
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
const defaultAudioSettings: AudioSettings = { music: false, sfx: true, haptics: true };
const ageOptions = Array.from({ length: 63 }, (_, index) => index + 18);
const residenceOptions = [
  { id: "family_home", label: "본가", description: "익숙한 가족의 생활 소리 속에서 시작합니다." },
  { id: "studio", label: "자취방", description: "작지만 온전히 내 몫인 방에서 시작합니다." },
  { id: "dorm", label: "기숙사", description: "학교와 가까운 공동생활 공간에서 시작합니다." },
] as const;
type CreateStep = "intro" | "name" | "age" | "residence" | "abilities";

function readAudioSettings(): AudioSettings {
  try {
    const saved = localStorage.getItem("sano-toss-audio");
    if (!saved) return defaultAudioSettings;
    const parsed: unknown = JSON.parse(saved);
    if (!parsed || typeof parsed !== "object") throw new Error("invalid settings");
    const candidate = parsed as Partial<AudioSettings>;
    if (typeof candidate.music !== "boolean" || typeof candidate.sfx !== "boolean" || typeof candidate.haptics !== "boolean") {
      throw new Error("invalid settings");
    }
    return { music: candidate.music, sfx: candidate.sfx, haptics: candidate.haptics };
  } catch {
    try { localStorage.removeItem("sano-toss-audio"); } catch { /* storage is optional */ }
    return defaultAudioSettings;
  }
}

function runOptional(action: () => unknown) {
  try {
    const result = action();
    if (result && typeof (result as PromiseLike<unknown>).then === "function") {
      void Promise.resolve(result).catch(() => undefined);
    }
  } catch {
    // Audio, haptics, storage, and host capabilities never block interaction.
  }
}

function IntroDawnArt() {
  return (
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
  );
}

function progressLabel(character: CharacterData | null) {
  if (!character) return "시작 전";
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
  const [screen, setScreen] = useState<Screen>("create");
  const [menuOpen, setMenuOpen] = useState(false);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(readAudioSettings);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [characters, setCharacters] = useState<CharacterData[]>([]);
  const [currentCharacter, setCurrentCharacter] = useState<CharacterData | null>(null);
  const [currentEvent, setCurrentEvent] = useState<EventData | null>(null);
  const [feedback, setFeedback] = useState<ChoiceFeedback | null>(null);
  const [records, setRecords] = useState<CareerRecord[]>([]);
  const [createStep, setCreateStep] = useState<CreateStep>("intro");
  const [name, setName] = useState("");
  const [age, setAge] = useState(22);
  const [residence, setResidence] = useState("");
  const [selectedStats, setSelectedStats] = useState<string[]>([]);

  const apiBaseLabel = useMemo(() => import.meta.env.VITE_API_BASE_URL || "same-origin", []);

  const startNewSimulation = useCallback(() => {
    setCreateStep("intro");
    setName("");
    setAge(22);
    setResidence("");
    setSelectedStats([]);
    setScreen("create");
    setMenuOpen(false);
  }, []);

  const cue = useCallback((kind: "tap" | "success" | "warning" | "ending" = "tap") => {
    runOptional(() => playCue(kind, audioSettings.sfx));
    runOptional(() => vibrate(audioSettings.haptics, kind === "warning" ? [16, 20, 16] : 12));
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
    if (!name.trim() || !residence || selectedStats.length !== 2) return;
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
    runOptional(() => localStorage.setItem("sano-toss-audio", JSON.stringify(audioSettings)));
    if (audioSettings.music) runOptional(() => startBgm(true));
    else runOptional(stopBgm);
  }, [audioSettings]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") runOptional(stopBgm);
      else if (audioSettings.music) runOptional(() => startBgm(true));
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [audioSettings.music]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError("");
        try {
          const hash = await getTossAnonymousKey();
          const session = await api.createTossSession(hash);
          if (!session.ok) {
            setError(session.data.error ?? "사용자 정보를 연결하지 못했습니다.");
            return;
          }
          await refreshCharacters();
        } catch {
          // Missing/rejected host permission APIs must leave guest onboarding usable.
        } finally {
          setLoading(false);
        }
      })();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [refreshCharacters]);

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="title-row">
          <h1 className="app-title"><span>일어나보니</span><span>대한민국 취준생</span></h1>
          <button className="menu-button" type="button" aria-label="메뉴" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>메뉴</button>
          {menuOpen && (
            <nav className="menu-popover" aria-label="메뉴">
              {currentCharacter && <button type="button" onClick={() => { cue(); setScreen("home"); setMenuOpen(false); }}>진행</button>}
              <button type="button" onClick={startNewSimulation}>새 시뮬레이션</button>
              <button type="button" onClick={() => { setMenuOpen(false); void loadRecords(); }}>기록</button>
              <div className="menu-divider" />
              {([ ["music", "배경음"], ["sfx", "효과음"], ["haptics", "햅틱"] ] as const).map(([key, label]) => (
                <label className="menu-row" key={key}>
                  <span>{label}</span>
                  <input aria-label={label} type="checkbox" checked={audioSettings[key]} onChange={(event) => setAudioSettings((value) => ({ ...value, [key]: event.target.checked }))} />
                </label>
              ))}
            </nav>
          )}
        </div>
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
        <section className="screen-stack onboarding-panel">
          {createStep === "intro" && <section className="create-step">
            <IntroDawnArt />
            <h2>낯선 아침이 시작됩니다.</h2>
            <p>눈을 뜨니 오전 6시 07분입니다. 휴대폰에는 읽지 않은 카톡 알림이 수북하게 쌓여 있습니다.</p>
            <p>학과 단체방 공지, 새로 올라온 동아리 모집 글, 아르바이트 연락, 그리고 아직 열어보지 않은 메시지 하나가 화면 위에 겹쳐 있습니다. 마지막 메시지에는 짧은 문장만 남아 있습니다. “이번에는 어떤 사람이 될 수 있을까요?”</p>
            <p>오늘은 평범한 학기의 첫날일 수도, 오래 미뤄둔 변화를 시작하는 날일 수도 있습니다. 지금 고르는 작은 선택들은 수업과 관계, 생활과 진로를 조금씩 다른 방향으로 이끌게 될 것입니다.</p>
            <p className="disclaimer">이 이야기는 실제 진로 예측이 아닌 재미를 위한 허구의 시뮬레이션입니다.</p>
            <button className="primary-button" type="button" onClick={() => setCreateStep("name")}>시작하기</button>
          </section>}
          {createStep === "name" && <section className="create-step">
            <h2>당신의 이름은 무엇인가요?</h2>
            <input aria-label="당신의 이름은 무엇인가요?" className="text-input" maxLength={24} value={name} onChange={(event) => setName(event.target.value)} />
            <div className="onboarding-actions"><button onClick={() => setCreateStep("intro")}>이전</button><button disabled={!name.trim()} onClick={() => setCreateStep("age")}>다음</button></div>
          </section>}
          {createStep === "age" && <section className="create-step">
            <h2>당신의 나이는 몇 살인가요?</h2>
            <select aria-label="당신의 나이는 몇 살인가요?" className="text-input" value={age} onChange={(event) => setAge(Number(event.target.value))}>
              {ageOptions.map((option) => <option key={option} value={option}>{option}세</option>)}
            </select>
            <div className="onboarding-actions"><button onClick={() => setCreateStep("name")}>이전</button><button onClick={() => setCreateStep("residence")}>다음</button></div>
          </section>}
          {createStep === "residence" && <section className="create-step">
            <h2>당신은 어디에서 깨어났나요?</h2>
            <div className="residence-grid">{residenceOptions.map((option) => (
              <button aria-pressed={residence === option.id} className={residence === option.id ? "selected" : ""} type="button" key={option.id} onClick={() => setResidence(option.id)}>
                <strong>{option.label}</strong><span>{option.description}</span>
              </button>
            ))}</div>
            <div className="onboarding-actions"><button onClick={() => setCreateStep("age")}>이전</button><button disabled={!residence} onClick={() => setCreateStep("abilities")}>다음</button></div>
          </section>}
          {createStep === "abilities" && <section className="create-step">
            <h2>당신이 믿고 싶은 능력 두 가지는 무엇인가요? ({selectedStats.length}/2)</h2>
            <div className="chip-grid">{preferredStats.map((stat) => (
              <button aria-pressed={selectedStats.includes(stat)} className={selectedStats.includes(stat) ? "selected" : ""} type="button" key={stat} onClick={() => setSelectedStats((current) => current.includes(stat) ? current.filter((item) => item !== stat) : current.length < 2 ? [...current, stat] : current)}>{statLabels[stat]}</button>
            ))}</div>
            <p className="muted">선택한 두 능력은 첫 능력치에 조금 더 높게 반영됩니다.</p>
            <div className="onboarding-actions"><button onClick={() => setCreateStep("residence")}>이전</button><button disabled={loading || selectedStats.length !== 2 || !name.trim() || !residence} onClick={() => void createCharacter()}>눈을 뜬다</button></div>
          </section>}
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
