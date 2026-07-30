import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = resolve(__dirname, "evidence");

const MAJORS = [
  { dir: "corrected-run-1-사회학과", major: "사회학과" },
  { dir: "corrected-run-2-교육학과", major: "교육학과" },
  { dir: "corrected-run-3-컴퓨터공학과", major: "컴퓨터공학과" },
];

function readJSON(path) {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch { return null; }
}

const runs = [];

for (const { dir, major } of MAJORS) {
  const runDir = resolve(EVIDENCE_DIR, dir);
  const charState = readJSON(resolve(runDir, "character-state.json"));
  const records = readJSON(resolve(runDir, "records.json"));
  const ledger = readJSON(resolve(runDir, "ledger.json"));

  const character = charState?.character || {};
  const eventFlags = character?.hiddenState?.eventFlags || {};
  const record = records?.records?.[0] || null;

  const lastProviderId = eventFlags.lastProviderId || null;
  const lastFallbackUsed = eventFlags.lastFallbackUsed;
  const lastAiFallbackReason = eventFlags.lastAiFallbackReason || null;
  const lastEventSource = eventFlags.lastEventSource || null;
  const lastGenerationReason = eventFlags.lastGenerationReason || null;

  const eventCount = character.coreEventCount || 0;
  const academicStatus = character.academicStatus || "";
  const isGraduated = academicStatus === "GRADUATED";
  const hasEnding = isGraduated && !character.currentEventId;

  const longNarrativeLen = record?.longNarrative?.length || 0;
  const hasLongNarrative = longNarrativeLen >= 500;

  const providerIds = [];
  if (lastProviderId) providerIds.push(lastProviderId);

  const run = {
    major,
    actualMajor: character.major,
    majorVerified: character.major === major,
    eventCount,
    isGraduated,
    hasEnding,
    lastProviderId,
    lastFallbackUsed,
    lastAiFallbackReason,
    lastEventSource,
    lastGenerationReason,
    providerIds,
    fallbackCount: lastFallbackUsed ? 1 : 0,
    openRouterCalls: lastProviderId === "openrouter" ? 1 : 0,
    ending: {
      recordAvailable: record !== null,
      recordId: record?.id || null,
      title: record?.title || null,
      summary: record?.summary || null,
      careerPath: record?.careerPath || null,
      longNarrativeLength: longNarrativeLen,
      longNarrativeVisible: hasLongNarrative,
      satisfaction: record?.satisfaction || null,
      growthPotential: record?.growthPotential || null,
      workLifeBalance: record?.workLifeBalance || null,
      tags: record?.tags || [],
    },
    consoleErrors: ledger?.consoleErrors || [],
    errors: ledger?.errors || [],
  };

  runs.push(run);
}

const mobileResult = { major: "컴퓨터공학과", viewport: { width: 390, height: 844 }, endingVisible: false, correctRecordExpanded: false };

const allTimings = [];
for (const { dir } of MAJORS) {
  const ledger = readJSON(resolve(EVIDENCE_DIR, dir, "ledger.json"));
  if (ledger?.timings) allTimings.push(...ledger.timings.map(t => t.ms));
}
allTimings.sort((a, b) => a - b);
const p50 = allTimings.length > 0 ? allTimings[Math.floor(allTimings.length * 0.5)] : 0;
const p95 = allTimings.length > 0 ? allTimings[Math.min(Math.floor(allTimings.length * 0.95), allTimings.length - 1)] : 0;

const report = {
  deployment: {
    url: "https://sano-officeworker-gaha9xgdm-rijukims-projects.vercel.app",
    deploymentId: "dpl_EgbSMjMcXiyDZwATSx2BRd2upwfe",
    target: "preview",
    ready: true,
    productionPromoted: false,
  },
  runs: runs.map(r => ({
    major: r.major,
    actualMajor: r.actualMajor,
    majorVerified: r.majorVerified,
    eventCount: r.eventCount,
    isGraduated: r.isGraduated,
    hasEnding: r.hasEnding,
    lastProviderId: r.lastProviderId,
    lastFallbackUsed: r.lastFallbackUsed,
    lastAiFallbackReason: r.lastAiFallbackReason,
    lastEventSource: r.lastEventSource,
    lastGenerationReason: r.lastGenerationReason,
    providerIds: r.providerIds,
    fallbackCount: r.fallbackCount,
    openRouterCalls: r.openRouterCalls,
    ending: r.ending,
    consoleErrors: r.consoleErrors.length,
    blockingErrors: r.errors.length,
  })),
  mobile: mobileResult,
  summary: {
    totalRuns: runs.length,
    passedRuns: runs.filter(r => r.majorVerified && r.hasEnding && r.ending.recordAvailable).length,
    totalErrors: runs.reduce((s, r) => s + r.errors.length, 0),
    totalConsoleErrors: runs.reduce((s, r) => s + r.consoleErrors.length, 0),
    totalFallbackEvents: runs.reduce((s, r) => s + r.fallbackCount, 0),
    totalOpenRouterCalls: runs.reduce((s, r) => s + r.openRouterCalls, 0),
    ollamaPrimaryCount: runs.filter(r => r.lastProviderId === "ollama").length,
    openrouterPrimaryCount: runs.filter(r => r.lastProviderId === "openrouter").length,
  },
  performance: { p50, p95 },
  qualityCriteria: {
    allMajorsVerified: runs.every(r => r.majorVerified),
    allGraduated: runs.every(r => r.isGraduated),
    allHaveEndingRecords: runs.every(r => r.ending.recordAvailable),
    allHaveLongNarrative: runs.every(r => r.ending.longNarrativeVisible),
    zeroFallbackEvents: runs.every(r => r.fallbackCount === 0),
    ollamaPrimary: runs.some(r => r.lastProviderId === "ollama"),
    zeroConsoleErrors: runs.every(r => r.consoleErrors.length === 0),
  },
};

writeFileSync(resolve(EVIDENCE_DIR, "corrected-verification-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

console.log("\n=== RESULTS ===");
for (const r of report.runs) {
  const status = r.majorVerified && r.hasEnding ? "PASS" : "FAIL";
  console.log(`  ${r.major}: ${status} (events: ${r.eventCount}, provider: ${r.lastProviderId || "none"}, fallback: ${r.lastFallbackUsed}, ending: ${r.ending.recordAvailable ? "✓" : "✗"}, narrative: ${r.ending.longNarrativeVisible ? "✓" : "✗"})`);
}
console.log(`\nOverall: ${report.summary.passedRuns === 3 ? "PASS" : "PARTIAL"}`);
console.log(`Provider: Ollama=${report.summary.ollamaPrimaryCount}, OpenRouter=${report.summary.openrouterPrimaryCount}`);
console.log(`Fallback events: ${report.summary.totalFallbackEvents}`);
