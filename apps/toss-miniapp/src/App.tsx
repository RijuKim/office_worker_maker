import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "./api";
import { playCue, startBgm, stopBgm, vibrate, type AudioSettings } from "./audio";
import { getTossAnonymousKey } from "./toss-auth";
import { CharacterSheet, PlaySurface, RelationshipsSheet } from "@/lib/game-ui/App";
import { SharedGameChrome, SharedGameWorkspace, SharedOnboardingFlow } from "../../../lib/game-ui/shell";
import { RecordCardShell, RecordShareActions, copyEndingShareLink } from "@/lib/game-ui/App";
import { CodexDetailModal } from "@/app/components/codex/CodexDetailModal";
import { CodexGrid } from "@/app/components/codex/CodexGrid";
import { CODEX_CATALOG, type CodexSlot } from "@/lib/game/codex-catalog";
import { deriveCodexState } from "@/lib/game/derive-codex-state";
import type { CareerEndingRecord } from "@prisma/client";
import { createTossEndingShareLink } from "./toss-host";
import type { CareerPath, CareerRecord, CharacterData, CharacterSpec, ChoiceFeedback, EventData, JobApplication, Screen } from "./types";

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

function recordText(record: CareerRecord, key: string, fallback = "") {
  const value = record[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

export function App() {
  const [initialLoading, setInitialLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>("create");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showNewSimulationConfirm, setShowNewSimulationConfirm] = useState(false);
  const [deletingSimulation, setDeletingSimulation] = useState(false);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(readAudioSettings);
  const [loading, setLoading] = useState(false);
  const [generatingNextEvent, setGeneratingNextEvent] = useState(false);
  const [error, setError] = useState("");
  const [characters, setCharacters] = useState<CharacterData[]>([]);
  const [currentCharacter, setCurrentCharacter] = useState<CharacterData | null>(null);
  const [currentEvent, setCurrentEvent] = useState<EventData | null>(null);
  const [feedback, setFeedback] = useState<ChoiceFeedback | null>(null);
  const [records, setRecords] = useState<CareerRecord[]>([]);
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [recordsTab, setRecordsTab] = useState<"records" | "codex">("records");
  const [selectedCodexSlot, setSelectedCodexSlot] = useState<CodexSlot | null>(null);
  const [specs, setSpecs] = useState<CharacterSpec[]>([]);
  const [jobApplications, setJobApplications] = useState<JobApplication[]>([]);
  const [careerPaths, setCareerPaths] = useState<CareerPath[]>([]);
  const [createStep, setCreateStep] = useState<CreateStep>("intro");
  const [name, setName] = useState("");
  const [age, setAge] = useState(22);
  const [residence, setResidence] = useState("");
  const [selectedStats, setSelectedStats] = useState<string[]>([]);
  const audioReady = true;
  const codexState = useMemo(
    () => deriveCodexState(records as unknown as CareerEndingRecord[], CODEX_CATALOG),
    [records],
  );
  const selectedCodexState = selectedCodexSlot
    ? codexState.slots.find((item) => item.slot.id === selectedCodexSlot.id) ?? null
    : null;
  const selectedCodexRecord = selectedCodexSlot
    ? records.find((record) => selectedCodexSlot.matches(record as unknown as CareerEndingRecord)) ?? null
    : null;

  useEffect(() => {
    if (!currentCharacter) {
      setSpecs([]);
      setJobApplications([]);
      setCareerPaths([]);
      return;
    }
    let active = true;
    void Promise.all([
      api.specs(currentCharacter.id),
      api.jobApplications(currentCharacter.id),
      api.careerPaths(currentCharacter.id),
    ]).then(([specsResult, applicationsResult, pathsResult]) => {
      if (!active) return;
      if (specsResult.ok) setSpecs(specsResult.data.specs ?? []);
      if (applicationsResult.ok) setJobApplications(applicationsResult.data.applications ?? []);
      if (pathsResult.ok) setCareerPaths(pathsResult.data.paths ?? []);
    });
    return () => { active = false; };
  }, [currentCharacter]);

  const productionRightContent = (
    <>
      <section className="pixel-panel-dark mt-3.5 p-3.5" data-testid="spec-panel">
        <div className="flex items-center justify-between gap-2"><h3 className="font-bold">스펙</h3><span className="text-xs font-bold text-[#f7d08b]" data-testid="spec-score">총점 {currentCharacter?.specScore ?? 0}</span></div>
        <div className="mt-2 space-y-2">
          {specs.map((spec, index) => <div className="flex items-center justify-between text-[13px]" key={`${spec.specType}-${index}`}><div><span className="mr-1 text-[#a9967d]">[{spec.specType}]</span><span className="text-[#d9c9b5]">{spec.specName}</span></div><span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${spec.status === "COMPLETED" ? "bg-[#2d4a22] text-[#8fce74]" : spec.status === "FAILED" ? "bg-[#4a2222] text-[#ce7474]" : "bg-[#4a3d22] text-[#ceb074]"}`}>{spec.status}</span></div>)}
          {specs.length === 0 && <p className="text-[13px] text-[#d9c9b5]">정보 없음</p>}
        </div>
      </section>
      <section className="pixel-panel-dark mt-3.5 p-3.5" data-testid="job-application-panel">
        <h3 className="font-bold">취업 전형</h3><div className="mt-2 space-y-2">
          {jobApplications.map((application, index) => <div className="text-[13px]" key={`${application.companyName}-${index}`}><div className="flex items-center justify-between"><span className="font-bold text-[#d9c9b5]">{application.companyName}</span><span className="text-[11px] text-[#a9967d]">{application.currentStage}</span></div><p className="mt-0.5 text-[11px] text-[#8a7f72]">서류 → 인적성 → 면접 → 최종</p></div>)}
          {jobApplications.length === 0 && <p className="text-[13px] text-[#d9c9b5]">진행 중인 전형 없음</p>}
        </div>
      </section>
      <section className="pixel-panel-dark mt-3.5 p-3.5" data-testid="career-path-panel">
        <h3 className="font-bold">진로 트랙</h3><div className="mt-2 space-y-2">
          {careerPaths.map((path, index) => <div className="flex items-center justify-between text-[13px]" key={`${path.pathName}-${index}`}><span className="text-[#d9c9b5]">{path.pathName}</span><span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${path.status === "COMPLETED" ? "bg-[#2d4a22] text-[#8fce74]" : path.status === "FAILED" ? "bg-[#4a2222] text-[#ce7474]" : "bg-[#4a3d22] text-[#ceb074]"}`}>{path.status}</span></div>)}
          {careerPaths.length === 0 && <p className="text-[13px] text-[#d9c9b5]">정보 없음</p>}
        </div>
      </section>
    </>
  );

  const startNewSimulation = useCallback(() => {
    setLoading(false);
    setGeneratingNextEvent(false);
    setError("");
    setCurrentCharacter(null);
    setCurrentEvent(null);
    setFeedback(null);
    setCharacters([]);
    setSpecs([]);
    setJobApplications([]);
    setCareerPaths([]);
    setCreateStep("intro");
    setName("");
    setAge(22);
    setResidence("");
    setSelectedStats([]);
    setScreen("create");
    setMenuOpen(false);
    setShowNewSimulationConfirm(false);
  }, []);

  const requestNewSimulation = useCallback(() => {
    setMenuOpen(false);
    setShowNewSimulationConfirm(true);
  }, []);

  const confirmNewSimulation = useCallback(async () => {
    if (deletingSimulation) return;
    setDeletingSimulation(true);
    setError("");
    try {
      if (currentCharacter) {
        const result = await api.deleteCharacter(currentCharacter.id);
        if (!result.ok) {
          setError(result.data.error ?? "기존 진행을 삭제하지 못했습니다.");
          return;
        }
      }
      startNewSimulation();
    } catch {
      setError("기존 진행을 삭제하지 못했습니다.");
    } finally {
      setDeletingSimulation(false);
    }
  }, [currentCharacter, deletingSimulation, startNewSimulation]);

  const cue = useCallback((kind: "tap" | "success" | "warning" | "ending" = "tap") => {
    runOptional(() => playCue(kind, audioSettings.sfx));
    runOptional(() => vibrate(audioSettings.haptics, kind === "warning" ? [16, 20, 16] : 12, kind));
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
        setCurrentCharacter((character) => character ? { ...character, stats: result.data.result!.stats!, ...(result.data.result?.relationships ? { relationships: result.data.result.relationships.map((rel) => ({ ...rel, tags: rel.tags ?? [] })) } : {}) } : character);
      } else if (result.data.result?.relationships) {
        setCurrentCharacter((character) => character ? { ...character, relationships: result.data.result!.relationships!.map((rel) => ({ ...rel, tags: rel.tags ?? [] })) } : character);
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
    if (!audioSettings.music) return;

    const unlockBgm = () => {
      runOptional(() => startBgm(true));
    };
    window.addEventListener("pointerdown", unlockBgm, { once: true, capture: true });
    window.addEventListener("touchstart", unlockBgm, { once: true, capture: true });
    window.addEventListener("keydown", unlockBgm, { once: true, capture: true });
    return () => {
      window.removeEventListener("pointerdown", unlockBgm, true);
      window.removeEventListener("touchstart", unlockBgm, true);
      window.removeEventListener("keydown", unlockBgm, true);
    };
  }, [audioSettings.music]);

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
          setInitialLoading(false);
        }
      })();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [refreshCharacters]);

  if (initialLoading) {
    return (
      <main className="initial-loading-screen pixel-shell" aria-busy="true" aria-live="polite">
        <div className="initial-loading-content">
          <span className="initial-loading-spinner" aria-hidden="true" />
          <p>눈을 뜨고 있습니다...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <SharedGameChrome
        variant="web"
        menuOpen={menuOpen}
        onMenuOpenChange={setMenuOpen}
        onOpenProgress={currentCharacter ? () => { cue(); setScreen("play"); } : undefined}
        onOpenRecords={() => {
          setMenuOpen(false);
          void loadRecords();
        }}
        onStartNewSimulation={requestNewSimulation}
        audioSettings={audioSettings}
        onAudioSettingChange={updateAudioSetting}
        currentCharacterName={currentCharacter?.name ?? null}
      />

      {showNewSimulationConfirm && (
        <div className="new-simulation-backdrop" role="presentation" onClick={() => !deletingSimulation && setShowNewSimulationConfirm(false)}>
          <section className="new-simulation-dialog pixel-panel" role="dialog" aria-modal="true" aria-label="새 시뮬레이션 확인" onClick={(event) => event.stopPropagation()}>
            <h2>새 시뮬레이션을 시작할까요?</h2>
            <p>현재 진행 중인 시뮬레이션은 삭제되고 되돌릴 수 없습니다.</p>
            <div className="new-simulation-actions">
              <button className="pixel-button" disabled={deletingSimulation} type="button" onClick={() => setShowNewSimulationConfirm(false)}>취소</button>
              <button className="pixel-button-dark" disabled={deletingSimulation} type="button" onClick={() => void confirmNewSimulation()}>{deletingSimulation ? "삭제 중..." : "새로 시작"}</button>
            </div>
          </section>
        </div>
      )}

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
        <SharedGameWorkspace
          mode="web"
          character={currentCharacter}
          activeTab="play"
          onTabChange={(tab) => setScreen(tab === "play" ? "play" : tab === "character" ? "character_detail" : "relationships")}
          onOpenRecords={() => void loadRecords()}
          rightContent={productionRightContent}
        >
          <PlaySurface
            variant="web"
            currentCharacter={currentCharacter}
            currentEvent={currentEvent}
            feedback={feedback}
            loading={loading || generatingNextEvent}
            onChoose={(choiceIndex) => void choose(choiceIndex)}
            onContinueToNextEvent={currentCharacter ? () => {
              setGeneratingNextEvent(true);
              void api.nextEvent(currentCharacter.id).then((next) => {
                if (next.ok && next.data.event) setCurrentEvent(next.data.event);
                else void openCharacter(currentCharacter);
              }).finally(() => setGeneratingNextEvent(false));
            } : undefined}
          />
        </SharedGameWorkspace>
      )}

      {screen === "character_detail" && currentCharacter && (
        <SharedGameWorkspace
          mode="web"
          character={currentCharacter}
          activeTab="character"
          onTabChange={(tab) => setScreen(tab === "play" ? "play" : tab === "character" ? "character_detail" : "relationships")}
          onOpenRecords={() => void loadRecords()}
          rightContent={productionRightContent}
        >
          <CharacterSheet character={currentCharacter} />
        </SharedGameWorkspace>
      )}

      {screen === "relationships" && currentCharacter && (
        <SharedGameWorkspace
          mode="web"
          character={currentCharacter}
          activeTab="relationships"
          onTabChange={(tab) => setScreen(tab === "play" ? "play" : tab === "character" ? "character_detail" : "relationships")}
          onOpenRecords={() => void loadRecords()}
          rightContent={productionRightContent}
        >
          <RelationshipsSheet character={currentCharacter} />
        </SharedGameWorkspace>
      )}

      {screen === "records" && (
        <main className="records-screen min-h-screen p-4 pt-8">
          <div className="mx-auto max-w-5xl">
          <div className="record-hero mb-4 flex items-end justify-between gap-5 border-b-4 border-[#2a2018] pb-5 max-[720px]:block">
            <div><p className="record-kicker">ARCHIVE</p><h2>선택의 결과 기록</h2><p>가상 취준 생활이 남긴 직업, 관계, 생활의 스냅샷</p></div>
            <div className="record-actions flex items-center gap-4 max-[720px]:mt-4">
              <button className="record-action" type="button" onClick={() => void loadRecords()}>새로고침</button>
              <button className="record-action" type="button" onClick={() => setScreen(currentCharacter ? "play" : "create")}>이어가기</button>
            </div>
          </div>
          <div className="record-tabs mb-6" role="tablist">
            <button className={recordsTab === "records" ? "active" : ""} type="button" role="tab" aria-selected={recordsTab === "records"} onClick={() => setRecordsTab("records")}>지난 루트</button>
            <button className={recordsTab === "codex" ? "active" : ""} type="button" role="tab" aria-selected={recordsTab === "codex"} onClick={() => setRecordsTab("codex")}>결말 모음</button>
          </div>
          {recordsTab === "records" && records.length === 0 && <div className="pixel-panel border-dashed p-10 text-center"><p className="text-sm text-[#706b62]">아직 저장된 기록이 없습니다.</p><p className="mt-2 text-xs text-[#a9967d]">시뮬레이션을 충분히 진행하면 선택의 결과를 남길 수 있습니다.</p></div>}
          {recordsTab === "records" && records.map((record) => {
            const isExpanded = expandedRecord === record.id;
            const narrative = recordText(record, "longNarrative");
            const preview = narrative.length > 150 ? `${narrative.slice(0, 150)}...` : narrative;
            const careerPath = recordText(record, "careerPath", "진로 기록");
            const healthState = recordText(record, "healthState", "생활 상태");
            const relationshipState = recordText(record, "relationshipState", "관계의 여운");
            return (
            <RecordCardShell
              className="record-card pixel-panel overflow-hidden p-0"
              expanded={isExpanded}
              id={record.id}
              key={record.id}
              onToggle={() => setExpandedRecord(isExpanded ? null : record.id)}
              preview={preview}
              summary={record.summary ?? ""}
              title={record.title ?? record.destination ?? "선택의 결과"}
            >
              <div className="border-t-4 border-[#2a2018] bg-[#fffaf0] p-5">
                {narrative && <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#2a241e]">{narrative}</p>}
                <div className="mt-4 grid grid-cols-3 gap-2 border-t-2 border-[#f2efe7] pt-4 text-center text-sm">
                  <div><span className="block text-xs text-[#706b62]">만족도</span><strong>{recordText(record, "satisfaction", "-")}</strong></div>
                  <div><span className="block text-xs text-[#706b62]">성장 가능성</span><strong>{recordText(record, "growthPotential", "-")}</strong></div>
                  <div><span className="block text-xs text-[#706b62]">워라밸</span><strong>{recordText(record, "workLifeBalance", "-")}</strong></div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="record-chip">{careerPath}</span>
                  <span className="record-chip">{healthState}</span>
                  <span className="record-chip">관계: {relationshipState}</span>
                </div>
                <RecordShareActions onCopyLink={shareRecord} recordId={record.id} wrapperClassName="mt-3 flex flex-wrap gap-2" />
              </div>
            </RecordCardShell>
            );
          })}
          {recordsTab === "codex" && (
            <div className="relative pb-12">
              <CodexGrid codexState={codexState} onSlotClick={(slot) => setSelectedCodexSlot(slot)} />
              {selectedCodexSlot && selectedCodexState && (
                <CodexDetailModal
                  achievementCount={selectedCodexState.achievementCount}
                  firstAchievedAt={selectedCodexState.firstAchievedAt}
                  isOpen
                  onClose={() => setSelectedCodexSlot(null)}
                  recordSample={selectedCodexRecord as unknown as CareerEndingRecord | null}
                  slot={selectedCodexSlot}
                  unlocked={selectedCodexState.unlocked}
                />
              )}
            </div>
          )}
          </div>
        </main>
      )}
    </main>
  );
}
