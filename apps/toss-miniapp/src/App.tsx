import { useCallback, useEffect, useState } from "react";

import { api } from "./api";
import { playCue, startBgm, stopBgm, vibrate, type AudioSettings } from "./audio";
import { getTossAnonymousKey } from "./toss-auth";
import { PlaySurface } from "@/lib/game-ui/App";
import { SharedGameChrome, SharedOnboardingFlow } from "../../../lib/game-ui/shell";
import { RecordCardShell, RecordShareActions, copyEndingShareLink } from "@/lib/game-ui/App";
import { createTossEndingShareLink } from "./toss-host";
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
  const [generatingNextEvent, setGeneratingNextEvent] = useState(false);
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
  const audioReady = true;

  const startNewSimulation = useCallback(() => {
    setLoading(false);
    setGeneratingNextEvent(false);
    setError("");
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

  const updateAudioSetting = useCallback((key: keyof AudioSettings, value: boolean) => {
    setAudioSettings((current) => ({ ...current, [key]: value }));
    if (key === "music" && value) {
      runOptional(() => startBgm(true));
    }
    if (key === "music" && !value) {
      runOptional(stopBgm);
    }
    if ((key === "sfx" || key === "haptics") && value) {
      cue("tap");
    }
  }, [cue]);

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
      if (result.data.result?.stats) {
        setCurrentCharacter((character) => character ? { ...character, stats: result.data.result!.stats! } : character);
      }
      if (result.data.result?.endingTriggered) {
        setCurrentEvent(null);
        cue("ending");
        return;
      }
      setCurrentEvent(null);
      setGeneratingNextEvent(true);
      const next = await api.nextEvent(currentCharacter.id);
      if (next.ok && next.data.event) {
        setCurrentEvent(next.data.event);
        cue("success");
      } else {
        await openCharacter(currentCharacter);
        if (!next.ok && next.data.error) setError(next.data.error);
      }
    } finally {
      setGeneratingNextEvent(false);
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

  const shareRecord = useCallback(async (recordId: string) => {
    const result = await copyEndingShareLink(
      {
        sharing: {
          createEndingShareLink: createTossEndingShareLink,
        },
        clipboard: {
          async copy(text: string) {
            await navigator.clipboard.writeText(text);
          },
        },
      },
      recordId,
    );

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setError("");
  }, []);

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
    <main className="app-shell toss-production-app">
      <SharedGameChrome
        variant="web"
        menuOpen={menuOpen}
        onMenuOpenChange={setMenuOpen}
        onOpenProgress={currentCharacter ? () => { cue(); setScreen("play"); } : undefined}
        onOpenRecords={() => {
          setMenuOpen(false);
          void loadRecords();
        }}
        onStartNewSimulation={startNewSimulation}
        audioSettings={audioSettings}
        onAudioSettingChange={updateAudioSetting}
        currentCharacterName={currentCharacter?.name ?? null}
      />

      {error && <p className="error-banner">{error}</p>}

      {screen === "create" && (
        <SharedOnboardingFlow
          variant="web"
          step={createStep}
          name={name}
          age={age}
          residence={residence}
          selectedStats={selectedStats}
          loading={loading}
          onStepChange={setCreateStep}
          onNameChange={setName}
          onAgeChange={setAge}
          onResidenceChange={(value: string) => {
            cue("tap");
            setResidence(value);
          }}
          onToggleStat={(stat: string) => {
            cue("tap");
            setSelectedStats((current) => current.includes(stat) ? current.filter((item) => item !== stat) : current.length < 2 ? [...current, stat] : current);
          }}
          onSubmit={() => void createCharacter()}
          submitDisabled={selectedStats.length !== 2 || !name.trim() || !residence}
        />
      )}

      {screen === "play" && (
        <PlaySurface
          currentCharacter={currentCharacter}
          currentEvent={currentEvent}
          feedback={feedback}
          loading={loading || generatingNextEvent}
          onChoose={(choiceIndex) => void choose(choiceIndex)}
          onContinueToNextEvent={currentCharacter ? () => void api.nextEvent(currentCharacter.id).then(() => openCharacter(currentCharacter)) : undefined}
        />
      )}

      {screen === "records" && (
        <section className="screen-stack">
          <div className="action-grid">
            <button className="secondary-button" type="button" onClick={() => void loadRecords()}>새로고침</button>
          <button className="secondary-button" type="button" onClick={() => setScreen(currentCharacter ? "play" : "create")}>진행으로</button>
          </div>
          {records.length === 0 && <div className="list-panel"><p className="muted">아직 남겨진 기록이 없습니다.</p></div>}
          {records.map((record) => (
            <RecordCardShell
              className="record-panel overflow-hidden p-0"
              expanded
              id={record.id}
              key={record.id}
              summary={record.summary ?? ""}
              title={record.title ?? record.destination ?? "선택의 결과"}
            >
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span>{record.satisfaction ? `만족도 ${record.satisfaction}` : record.createdAt?.slice(0, 10)}</span>
                <RecordShareActions onCopyLink={shareRecord} recordId={record.id} wrapperClassName="flex flex-wrap gap-2 border-t-0 p-0" />
              </div>
            </RecordCardShell>
          ))}
        </section>
      )}
    </main>
  );
}
