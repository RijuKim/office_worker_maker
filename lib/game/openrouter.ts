import { z } from "zod";
import { buildFallbackLongEnding, pickFallbackCareerPath } from "@/lib/game/ending-fallbacks";

import { logger } from "@/lib/server/logger";
import { normalizeRelationshipName } from "@/lib/game/npcs";

type AiProvider = {
  id: "ollama" | "openrouter";
  label: string;
  baseUrl: string;
  key: string | null;
  model: string;
  headers?: Record<string, string>;
};

type AiProviderOptions = {
  skipPrimary?: boolean;
  primaryOnly?: boolean;
  trace?: {
    requestId?: string;
    characterRunId?: string;
  };
};

const openRouterProvider = (): AiProvider => ({
  id: "openrouter",
  label: "OpenRouter DeepSeek V4 Flash",
  baseUrl: "https://openrouter.ai/api/v1",
  key: process.env.OPENROUTER_API_KEY?.trim() || null,
  model: (process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-v4-flash").trim(),
  headers: {
    "HTTP-Referer": process.env.NEXTAUTH_URL ?? "https://sano-officeworker.vercel.app",
    "X-Title": "Sano Officeworker",
  },
});

const ollamaProvider = (): AiProvider => ({
  id: "ollama",
  label: "Ollama GPT-OSS",
  // Use Ollama's native Cloud API. The OpenAI-compatible endpoint does not
  // expose the native `think` and `format` controls consistently.
  baseUrl: "https://ollama.com/api",
  key: process.env.OLLAMA_API_KEY?.trim() || null,
  model: (process.env.OLLAMA_MODEL ?? "gpt-oss:20b").trim(),
});

function configuredProviders(): { primary: AiProvider; fallback: AiProvider } {
  // Ollama is ALWAYS the primary provider for story events and endings,
  // regardless of AI_PRIMARY_PROVIDER being unset, blank, "openrouter",
  // typo, legacy, or unknown. Only a concrete Ollama failure permits
  // exactly one OpenRouter fallback attempt.
  return { primary: ollamaProvider(), fallback: openRouterProvider() };
}

const aiProviders = (options: AiProviderOptions = {}) =>
  (() => {
    const { primary, fallback } = configuredProviders();
    return options.primaryOnly ? [primary] :
      options.skipPrimary ? [fallback] : [primary, fallback];
  })();

// Give the configured providers enough time to finish a complete structured
// event. Both providers share this total window, after which the route commits
// the validated static fallback. The value remains configurable for deploys
// with a tighter or looser request budget.
const DEFAULT_AI_TIMEOUT_MS = 60_000;
const MIN_AI_TIMEOUT_MS = 5_000;
const MAX_AI_TIMEOUT_MS = 120_000;
export const SLOW_AI_GENERATION_MS = 10_000;

const DEFAULT_AI_MAX_TOKENS = 1_400;
const MIN_AI_MAX_TOKENS = 400;
const MAX_AI_MAX_TOKENS = 4_000;
const DEFAULT_OLLAMA_EVENT_TOKENS = 2_400;
const DEFAULT_OLLAMA_EVENT_REPAIR_TOKENS = 1_600;
const DEFAULT_ENDING_TIMEOUT_MS = 120_000;
const DEFAULT_OLLAMA_ENDING_TOKENS = 5_000;
const DEFAULT_OPENROUTER_ENDING_TOKENS = 3_200;

export function getOpenRouterTimeoutMs(raw = process.env.OPENROUTER_TIMEOUT_MS): number {
  if (raw === undefined || !/^\d+$/.test(raw.trim())) return DEFAULT_AI_TIMEOUT_MS;
  const parsed = Number(raw);
  return parsed >= MIN_AI_TIMEOUT_MS && parsed <= MAX_AI_TIMEOUT_MS
    ? parsed
    : DEFAULT_AI_TIMEOUT_MS;
}

export function getOpenRouterMaxTokens(raw = process.env.OPENROUTER_MAX_TOKENS): number {
  if (raw === undefined || !/^\d+$/.test(raw.trim())) return DEFAULT_AI_MAX_TOKENS;
  const parsed = Number(raw);
  return parsed >= MIN_AI_MAX_TOKENS && parsed <= MAX_AI_MAX_TOKENS
    ? parsed
    : DEFAULT_AI_MAX_TOKENS;
}

export function getOllamaEventMaxTokens(raw = process.env.OLLAMA_EVENT_MAX_TOKENS): number {
  if (raw === undefined || !/^\d+$/.test(raw.trim())) return DEFAULT_OLLAMA_EVENT_TOKENS;
  const parsed = Number(raw);
  return parsed >= MIN_AI_MAX_TOKENS && parsed <= MAX_AI_MAX_TOKENS
    ? parsed
    : DEFAULT_OLLAMA_EVENT_TOKENS;
}

export function getAiEndingTimeoutMs(raw = process.env.AI_ENDING_TIMEOUT_MS): number {
  if (raw === undefined || !/^\d+$/.test(raw.trim())) return DEFAULT_ENDING_TIMEOUT_MS;
  const parsed = Number(raw);
  return parsed >= 30_000 && parsed <= 240_000 ? parsed : DEFAULT_ENDING_TIMEOUT_MS;
}

function getAiEndingMaxTokens(providerId: AiProvider["id"]) {
  return providerId === "ollama" ? DEFAULT_OLLAMA_ENDING_TOKENS : DEFAULT_OPENROUTER_ENDING_TOKENS;
}

function getAiEventMaxTokens(providerId: AiProvider["id"]): number {
  return providerId === "ollama"
    ? getOllamaEventMaxTokens()
    : getOpenRouterMaxTokens();
}

const aiEventSchema = z.object({
  title: z.string().min(1).max(100),
  body: z.string().min(100).max(5200), // validated range is wider than the 200-350 guidance so fallback events still pass
  choices: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1).max(200),
        summary: z.string().min(1).max(360),
        statDelta: z.object({
          academic: z.number().int().min(-15).max(15).optional(),
          practical: z.number().int().min(-15).max(15).optional(),
          health: z.number().int().min(-1).max(15).optional(),
          mental: z.number().int().min(-1).max(15).optional(),
          wealth: z.number().int().min(-15).max(15).optional(),
          reputation: z.number().int().min(-15).max(15).optional(),
          charm: z.number().int().min(-15).max(15).optional(),
        }).strict(),
        relationshipDelta: z.array(z.object({
          name: z.string().min(1).max(60),
          trust: z.number().int().min(-30).max(30),
          status: z.enum(["acquaintance", "friend", "crush", "dating", "ex"]).optional(),
        })).optional(),
      }),
    )
    .min(2)
    .max(3),
  tags: z.array(z.string()).min(1).max(5),
});

export type AiEventResponse = z.infer<typeof aiEventSchema>;

const aiEndingSchema = z.object({
  title: z.string().min(1).max(120),
  summary: z.string().min(80).max(500),
  longNarrative: z.string().min(900).max(2600),
  careerPath: z.string().min(1).max(100),
  jobRole: z.string().min(1).max(100).nullable().optional(),
  destinationName: z.string().min(1).max(100).nullable().optional(),
  salaryBand: z.string().nullable().optional(),
  workplaceTone: z.array(z.string()).max(8).default([]),
  satisfaction: z.number().int().min(0).max(100),
  growthPotential: z.number().int().min(0).max(100),
  workLifeBalance: z.number().int().min(0).max(100),
  healthState: z.string().min(1).max(80),
  relationshipState: z.string().min(1).max(120),
  tags: z.array(z.string()).min(1).max(10),
}).superRefine((ending, context) => {
  const paragraphs = ending.longNarrative.trim().split(/\n\s*\n/).filter(Boolean);
  if (paragraphs.length < 2 || paragraphs.length > 3) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["longNarrative"], message: "must contain exactly 2-3 paragraphs" });
  }
  if (paragraphs.some((paragraph) => paragraph.length < 220)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["longNarrative"], message: "each paragraph must be a developed scene" });
  }
  if (/(?:^|[.!?]\s+)(?:나는|내가|우리는|우리가)\s/.test(ending.longNarrative)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["longNarrative"], message: "must keep second-person viewpoint" });
  }
});

export type AiEndingResponse = z.infer<typeof aiEndingSchema>;

const allowedStats = ["academic", "practical", "health", "mental", "wealth", "reputation", "charm"] as const;

const SYSTEM_PROMPT = `한국 대학생활 텍스트 어드벤처 사건 하나를 작성한다. Return only a single JSON object.

형식: {"title","body","tags","choices"}. "choices" must contain 2-3 complete objects, 각 항목은 {"id","label","summary","statDelta","relationshipDelta"}. body는 한국어 2문단, 4~5문장, 약 220~380자다. 구체적 행동이나 대화로 상황을 변화시킨 뒤 의미 있는 선택 직전에 끝낸다. summary는 "당신은"으로 시작한다.

이야기의 중심 질문은 취업할 수 있는 사람이 되어가는 동안 돈·관계·건강·자존감 중 무엇을 지키고 포기할지다. 현재 아크는 수행 목록이 아니라 사건의 극적 역할이다. 사건은 생존·능력·관계·정체성 중 하나 이상을 건드리고, 가능하면 두 축에 실제 득실을 만든다. 착하거나 이상적인 선택에도 비용을, 실용적이거나 이기적인 선택에도 실익을 준다. 평범한 삶을 억지로 취업 사건으로 바꾸지 않는다.

연속 사건은 같은 카테고리·핵심 활동·갈등을 반복하지 않는다. 이번사건필수주제가 있으면 제목·갈등·본문·태그에 반영하고, 자유이면 최근 맥락에서 연결점 하나만 재사용한다. 회피 카테고리·회피인물·사용제목은 쓰지 않는다. 설정·인물 구성·활동·압박 원인·감정 톤을 따로 조합하며 우연한 문서, 전화, 소문으로 억지 전개하지 않는다.

관계에 있는 이름은 영속 상태다. 등장인물 이름은 관계 또는 안전후보의 정확한 이름을 사용한다. 새 관계가 생기거나 기존 관계가 변하면 모든 관련 선택의 relationshipDelta에 그 이름과 작은 방향성 변화를 넣는다. status는 명시적으로 교제 합의 또는 이별한 경우에만 dating/ex로 쓴다. 관계 인물은 미해결 흐름을 진전시킬 때만 재등장시키고 역할·직업을 자동으로 사건 소재로 삼지 않는다. 위험 인물은 명시적 범죄·위험 맥락에만 등장한다.

취준서사의 eventKind와 제공된 가상 조직만 사용한다. 활성 지원이 없으면 재직을 만들지 않고, 종료된 회사는 재진입 근거 없이 현 직장으로 쓰지 않는다. 전공·누적 증거 없는 특정 직업을 만들지 않는다.

statDelta에는 공개 스탯만 쓴다. health와 mental 감소는 -1 이상이다. 평범한 공부·일·심부름·지출·가벼운 어색함에는 mental 감소를 주지 않는다. mental:-1은 수면 부족, 심각한 거절·갈등, 위험·윤리 압박, 상실·고립·명백한 공포처럼 실제 심리 부담이 있을 때만 쓴다. 일반 사건은 mental 감소 선택이 최대 하나이며 손실 없는 선택이 하나 이상이다. 스탯·신뢰의 숫자나 증감은 서사에 노출하지 않는다. 주인공은 여성으로 취급하며 남성 호칭과 1인칭 주인공 서술을 쓰지 않는다.`;

export type AiEventPromptState = {
  name: string;
  major: string;
  gradeYear: number | null;
  age: number;
  residence?: string | null;
  coreEventCount: number;
  recentSummaries: string[];
  usedEventTitles: string[];
  stats: Record<string, number>;
  relationships: { name: string; role: string; trust: number }[];
  storyArc: unknown;
  eventFlags?: Record<string, unknown>;
  lifeStage?: string;
  graduation?: string;
  academicTerm?: string;
  academicPlan?: unknown;
  destinationCandidates?: unknown;
  specs?: { specType: string; specName: string; status: string; score?: string | null }[];
  jobApplications?: { companyName: string; companyType?: string; currentStage: string; isActive: boolean }[];
  careerPaths?: { pathType: string; pathName?: string; status: string }[];
  avoidCategories?: string[];
  preferCategories?: string[];
  targetCategory?: string | null;
  allowedCategories?: string[];
  careerNarrative?: unknown;
  avoidPeople?: string[];
  starterCandidates?: { name: string; role: string }[];
  closedCompanies?: string[];
};

export function buildUserPrompt(state: AiEventPromptState): string {
  const semesterLabel = state.academicTerm ?? `${state.gradeYear ?? "?"}학년`;
  const totalSemesters = 8;
  const eventsPerSemester = 3;
  const currentSemester = Math.min(Math.floor(state.coreEventCount / eventsPerSemester) + 1, totalSemesters);
  const toneGuidance = state.coreEventCount <= 2 ? "발단: 부족한 조건 속에서 처음 지킬 기준을 세운다." :
    state.coreEventCount <= 5 ? "전개: 소속, 동료, 경쟁자와 첫 책임을 얻는다." :
      state.coreEventCount <= 8 ? "상승: 첫 증명을 얻되 유지 비용을 선택하게 한다." :
        state.coreEventCount <= 12 ? "위기: 지금까지 옳다고 믿은 생존 방식에 균열을 낸다." :
          state.coreEventCount <= 16 ? "심화: 미뤄둔 선택이 사람, 자원, 평판을 통해 돌아온다." :
            state.coreEventCount <= 19 ? "결단: 하나의 미래를 우선하고 다른 가능성을 실제로 포기하게 한다." :
              state.coreEventCount <= 22 ? "절정: 최종 관문에서 어떤 모습의 자신을 증명할지 묻는다." :
                "결말: 합격 여부와 별개로 돈, 건강, 관계, 정체성에 남은 삶을 보여준다.";

  const contextParts = [
    `주인공=${state.name}|${state.age}세|${state.major}|${state.gradeYear ?? "?"}학년|${state.residence ?? "미상"}`,
    `단계=${state.lifeStage ?? "unknown"}|${state.graduation ?? "normal"}|학기=${semesterLabel}/${totalSemesters}|사건=${state.coreEventCount}|가이드=${toneGuidance}`,
    `아크=${JSON.stringify(compactStoryArc(state.storyArc))}`,
    `최근=${state.recentSummaries.slice(0, 3).join(" || ") || "낯선 아침"}`,
    `사용제목=${state.usedEventTitles.slice(0, 6).join(" | ") || "없음"}`,
    `닫힘=${buildResolvedOfferPrompt(state.eventFlags)}`,
    `이번이야기영역=${state.allowedCategories?.join(",") || "자유"}`,
    `취준서사=${compactJson(state.careerNarrative ?? {}, 900)}`,
    `스토리모드=${state.targetCategory ? "새영역확장" : "기존선택연결"}|이번사건필수주제=${state.targetCategory ?? "자유"}|구체소재는 최근 사건과 겹치지 않게 새로 발명`,
    `회피=${state.avoidCategories?.join(",") || "없음"}|보조후보=${state.preferCategories?.join(",") || "없음"}|회피인물=${state.avoidPeople?.join(",") || "없음"}`,
    `스탯=${JSON.stringify(state.stats)}`,
    `관계=${JSON.stringify(state.relationships.slice(0, 12).map(({ name, role, trust }) => ({
      name,
      role,
      state: relationshipTrustBand(trust),
    })))}`,
    ...(state.starterCandidates && state.starterCandidates.length > 0
      ? [`안전후보=${JSON.stringify(state.starterCandidates)}`]
      : []),
  ];

  const activeParts = [
    state.academicPlan ? `학업=${compactJson(state.academicPlan, 500)}` : "",
    state.destinationCandidates ? `목적지=${compactJson(state.destinationCandidates, 700)}` : "",
    (state.closedCompanies ?? []).length > 0 ? `거절/퇴사회사=${JSON.stringify(state.closedCompanies)}` : "",
    buildCareerDiversityPrompt(state),
  ].filter(Boolean);

  return [...contextParts, ...activeParts].join("\n");
}

function compactStoryArc(raw: unknown) {
  const arc = readRecord(raw) ?? {};
  return {
    id: arc.currentArcId,
    title: arc.title,
    phase: arc.phase,
    question: arc.dramaticQuestion,
    axes: arc.focusAxes,
    threads: Array.isArray(arc.openThreads) ? arc.openThreads.slice(0, 3) : [],
    tension: arc.tension,
  };
}

function compactJson(value: unknown, maxChars: number) {
  const serialized = JSON.stringify(value);
  if (!serialized || serialized.length <= maxChars) return serialized || "{}";
  return `${serialized.slice(0, maxChars)}…`;
}

function relationshipTrustBand(trust: number) {
  if (trust >= 70) return "매우 가까움";
  if (trust >= 30) return "가까움";
  if (trust >= 10) return "우호적";
  if (trust > -10) return "어색함";
  if (trust > -40) return "거리감";
  return "갈등이 큼";
}

function buildCareerDiversityPrompt(state: AiEventPromptState) {
  const activeSpecs = (state.specs ?? []).filter((spec) => spec.status === "IN_PROGRESS");
  const activeApps = (state.jobApplications ?? []).filter((app) => app.isActive);
  const activePaths = (state.careerPaths ?? []).filter((path) => path.status !== "COMPLETED" && path.status !== "FAILED");
  const guidance: string[] = [];

  if (activeSpecs.length > 0) {
    guidance.push(`스펙=${activeSpecs.map((spec) => `${spec.specType}:${spec.specName}`).join(",")}; 중간과정/시험/대기/비용/번아웃`);
  }
  if (activeApps.length > 0) {
    guidance.push(`지원=${activeApps.map((app) => `${app.companyName}/${app.companyType ?? "회사"}/${app.currentStage}`).join(",")}`);
  }
  if (activePaths.length > 0) {
    guidance.push(`진로=${activePaths.map((path) => `${path.pathType}:${path.pathName ?? ""}`).join(",")}`);
  }
  if (state.lifeStage === "college_mid" || state.lifeStage === "college_late") {
    guidance.push("중반/후반: 스터디만 반복하지 말고 인턴, 어학, 포트폴리오, 공모전, 현장실습, 추가학기, 워홀, 시험 준비, 대학원을 우선 고려");
  }
  if (state.lifeStage === "college_late") {
    guidance.push("후반: 서류/인성검사/시험/면접/발표/불합격/조건협상");
  }
  if (/의학|간호|약학|치의|수의|방사선|임상|보건/.test(state.major)) {
    guidance.push("의료·보건계열: 4학년에는 임상실습, 국가시험, 병원 지원, 환자·보호자 응대, 당직과 진로 선택을 전공 맥락에 맞게 우선한다.");
  }
  if (state.lifeStage === "college_late" || state.graduation === "gate_ready") {
    guidance.push("관문: 최근 선택+지원/스펙/관계 2개 이상 반영");
    guidance.push("관문 선택지는 합격/불합격이 아니라 전략 행동으로");
  }
  if (state.major.includes("교육")) {
    guidance.push("교육계열만 임용 가능");
  }
    guidance.push("장소/인물/압박을 바꾸고, 학교 밖 사건도 우선 고려");
    guidance.push("사건의 필수 주제가 여가나 일상이면 취업·스펙·실습으로 억지로 연결하지 말고 그 경험 자체를 중심에 둘 것");

  return guidance.join(" / ");
}

function buildResolvedOfferPrompt(flags: Record<string, unknown> | undefined) {
  if (!flags) return "없음";
  const resolved: string[] = [];
  if (flags.contestJoined !== undefined) resolved.push("공모전 수락");
  if (flags.contestSkipped !== undefined) resolved.push("공모전 거절");
  if (flags.studentCouncil !== undefined) resolved.push(`학생회(${String(flags.studentCouncil)})`);
  if (flags.startupThread !== undefined) resolved.push(`창업(${String(flags.startupThread)})`);
  if (flags.publicSectorThread !== undefined) resolved.push(`공공(${String(flags.publicSectorThread)})`);
  if (flags.overseasThread !== undefined) resolved.push(`해외(${String(flags.overseasThread)})`);
  if (flags.crimeThread !== undefined) resolved.push(`회색지대(${String(flags.crimeThread)})`);
  if (flags.pyramidRefused !== undefined || flags.pyramidHeard !== undefined) resolved.push("다단계");
  if (flags.underworldRefused !== undefined || flags.underworldEntered !== undefined) resolved.push("밤거리");
  if (flags.gamblingRefused !== undefined || flags.gamblingTried !== undefined) resolved.push("도박");
  if (flags.usbInvestigation !== undefined) resolved.push(`USB(${String(flags.usbInvestigation)})`);
  if (flags.eunjiInterview !== undefined) resolved.push(`은지면접(${String(flags.eunjiInterview)})`);
  if (flags.studyShare !== undefined) resolved.push(`스터디(${String(flags.studyShare)})`);
  if (flags.personalTraining !== undefined) resolved.push(`개인운동(${String(flags.personalTraining)})`);
  return resolved.length > 0 ? resolved.join("; ") : "없음";
}

export interface OpenRouterResult {
  success: true;
  event: AiEventResponse;
  providerId?: AiProvider["id"];
  providerLabel?: string;
  providerElapsedMs: number;
  totalElapsedMs: number;
  slow: boolean;
  retryUsed: boolean;
  providerFailures: AiProviderFailureTelemetry[];
}

export type AiProviderFailureTelemetry = {
  providerId: AiProvider["id"];
  providerLabel: string;
  providerElapsedMs: number;
  reason: AiEventFailureReason | "invalid_response";
  stage: "provider" | "parse";
  issues?: string[];
  contentPreview?: string;
};

export type AiEventFailureReason =
  | "no_key"
  | "timeout"
  | "rate_limited"
  | "api_error"
  | "empty_content"
  | "malformed_json"
  | "narrative_schema"
  | "choice_count"
  | "choice_field"
  | "choice_stat_range"
  | "choice_schema";

export interface OpenRouterFailure {
  success: false;
  reason: AiEventFailureReason | "invalid_response";
  providerId?: AiProvider["id"];
  providerLabel?: string;
  providerElapsedMs?: number;
  totalElapsedMs?: number;
  slow?: boolean;
  retryUsed?: boolean;
  issues?: string[];
  providerFailures?: AiProviderFailureTelemetry[];
  contentPreview?: string;
}

export interface OpenRouterEndingResult {
  success: true;
  ending: AiEndingResponse;
  providerId?: AiProvider["id"];
  providerLabel?: string;
}

function toProviderFailureTelemetry(
  provider: AiProvider,
  failure: OpenRouterFailure,
): AiProviderFailureTelemetry {
  return {
    providerId: failure.providerId ?? provider.id,
    providerLabel: failure.providerLabel ?? provider.label,
    providerElapsedMs: failure.providerElapsedMs ?? 0,
    reason: failure.reason,
    stage: isParseFailure(failure.reason) ? "parse" : "provider",
    ...(failure.issues ? { issues: failure.issues } : {}),
    ...(failure.contentPreview ? { contentPreview: failure.contentPreview } : {}),
  };
}

function isParseFailure(reason: OpenRouterFailure["reason"]) {
  return reason === "malformed_json" || reason === "narrative_schema" ||
    reason === "choice_count" || reason === "choice_field" ||
    reason === "choice_stat_range" || reason === "choice_schema" ||
    reason === "invalid_response";
}

function logAiAttempt(meta: Record<string, unknown>) {
  logger.info("ai_event_attempt", meta);
}

function logProviderFailure(meta: {
  kind: "json" | "stream";
  attemptId: string;
  providerId: AiProvider["id"];
  providerLabel: string;
  model: string;
  reason: unknown;
  providerElapsedMs: number;
  totalElapsedMs: number;
  providerRole: "primary" | "fallback";
}) {
  logger.warn("ai_provider_attempt_failed", meta);
}

export async function generateAiEvent(
  state: AiEventPromptState,
  options: AiProviderOptions = {},
): Promise<OpenRouterResult | OpenRouterFailure> {
  const totalStartedAt = Date.now();
  let lastFailure: OpenRouterFailure = { success: false, reason: "no_key" };
  const providerFailures: AiProviderFailureTelemetry[] = [];

  const providers = aiProviders(options);
  for (const [providerIndex, provider] of providers.entries()) {
    const providerStartedAt = Date.now();
    const remainingMs = getOpenRouterTimeoutMs() - (providerStartedAt - totalStartedAt);
    if (remainingMs <= 0) break;
    const attemptId = crypto.randomUUID();
    logAiAttempt({
      phase: "start",
      kind: "json",
      attemptId,
      providerId: provider.id,
      providerLabel: provider.label,
      model: provider.model,
      providerRole: providerIndex === 0 ? "primary" : "fallback",
      timeoutMs: remainingMs,
      maxTokens: getAiEventMaxTokens(provider.id),
      promptChars: buildUserPrompt(state).length,
      ...options.trace,
    });
    const result = await generateAiEventWithProvider(provider, state, remainingMs, providerStartedAt);
    const totalElapsedMs = Date.now() - totalStartedAt;
    const measured = { ...result, totalElapsedMs, slow: totalElapsedMs > SLOW_AI_GENERATION_MS };
    logAiAttempt({
      phase: "result",
      kind: "json",
      attemptId,
      providerId: provider.id,
      providerLabel: provider.label,
      model: provider.model,
      success: measured.success,
      reason: measured.success ? null : measured.reason,
      providerElapsedMs: measured.providerElapsedMs ?? 0,
      totalElapsedMs,
      failureReasons: measured.success ? [] : (measured.providerFailures ?? []).map((failure) => failure.reason),
      ...options.trace,
    });
    if (!measured.success) {
      logProviderFailure({
        kind: "json",
        attemptId,
        providerId: provider.id,
        providerLabel: provider.label,
        model: provider.model,
        reason: measured.reason,
        providerElapsedMs: measured.providerElapsedMs ?? 0,
        totalElapsedMs,
        providerRole: providerIndex === 0 ? "primary" : "fallback",
      });
    }

    // --- Same-Ollama repair for parse failures ---
    // When the primary provider (Ollama) produces a parse/schema failure,
    // issue one short same-Ollama JSON repair request before OpenRouter.
    if (!measured.success && providerIndex === 0 && provider.id === "ollama" && isParseFailure(measured.reason)) {
      const repairStartedAt = Date.now();
      const repairRemainingMs = getOpenRouterTimeoutMs() - (repairStartedAt - totalStartedAt);
      if (repairRemainingMs > 0) {
        const repairResult = await attemptEventRepair(provider, state, measured, repairRemainingMs, repairStartedAt);
        const repairTotalElapsedMs = Date.now() - totalStartedAt;
        const repairMeasured = { ...repairResult, totalElapsedMs: repairTotalElapsedMs, slow: repairTotalElapsedMs > SLOW_AI_GENERATION_MS };
        logAiAttempt({
          phase: "result",
          kind: "json",
          attemptId: `${attemptId}-repair`,
          providerId: provider.id,
          providerLabel: provider.label,
          model: provider.model,
          success: repairMeasured.success,
          reason: repairMeasured.success ? null : repairMeasured.reason,
          providerElapsedMs: repairMeasured.providerElapsedMs ?? 0,
          totalElapsedMs: repairTotalElapsedMs,
          failureReasons: repairMeasured.success ? [] : (repairMeasured.providerFailures ?? []).map((f) => f.reason),
          ...options.trace,
        });
        if (repairMeasured.success) {
          return { ...repairMeasured, retryUsed: true, providerFailures: [...providerFailures, toProviderFailureTelemetry(provider, measured)] };
        }
        // Preserve the causal order for auditability: the original Ollama
        // parse/schema failure happened before the same-provider repair
        // failure. Do not append the original failure again below.
        providerFailures.push(toProviderFailureTelemetry(provider, measured));
        providerFailures.push(toProviderFailureTelemetry(provider, repairMeasured));
        lastFailure = repairMeasured;
        console.warn("AI event provider repair failed", { provider: provider.label, reason: repairMeasured.reason });
        continue;
      }
    }

    if (measured.success) return { ...measured, retryUsed: providerFailures.length > 0, providerFailures };
    lastFailure = measured;
    providerFailures.push(toProviderFailureTelemetry(provider, measured));
    console.warn("AI event provider failed", { provider: provider.label, reason: measured.reason });
  }

  return { ...lastFailure, retryUsed: providerFailures.length > 1, providerFailures };
}

async function attemptEventRepair(
  provider: AiProvider,
  state: AiEventPromptState,
  originalFailure: OpenRouterFailure,
  timeoutMs: number,
  startedAt: number,
): Promise<OpenRouterResult | OpenRouterFailure> {
  const issues = originalFailure.issues ?? [];
  const contentPreview = originalFailure.contentPreview;
  const repairMessages = buildAiEventRepairMessages(state, issues, contentPreview);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const failure = (reason: AiEventFailureReason, repairIssues?: string[]): OpenRouterFailure => ({
    success: false,
    reason,
    providerId: provider.id,
    providerLabel: provider.label,
    providerElapsedMs: Date.now() - startedAt,
    issues: repairIssues,
  });

  try {
    const response = await fetch(
      provider.id === "ollama"
        ? `${provider.baseUrl}/chat`
        : `${provider.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.key}`,
          "Content-Type": "application/json",
          ...provider.headers,
        },
        body: JSON.stringify({
          model: provider.model,
          messages: repairMessages,
          format: "json",
          stream: false,
          think: "low",
          options: {
            temperature: 0.3,
            num_predict: DEFAULT_OLLAMA_EVENT_REPAIR_TOKENS,
          },
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) return failure("api_error");
    const responseText = await response.text();
    let parsedData: unknown;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      return failure("malformed_json");
    }
    const data = parsedData as Record<string, unknown> | null;
    const choices = data?.choices;
    const firstChoice = Array.isArray(choices) ? choices[0] : null;
    const openAiMessage = firstChoice && typeof firstChoice === "object" ? (firstChoice as Record<string, unknown>).message : null;
    const message = provider.id === "ollama" ? (data?.message ?? openAiMessage) : openAiMessage;
    const content: string | undefined = message && typeof message === "object"
      ? (message as Record<string, unknown>).content as string | undefined
      : undefined;
    if (!content) return failure("empty_content");

    const parsed = parseAiEventContentDetailed(content);
    if (!parsed.success) return failure(parsed.reason, parsed.issues);

    const providerElapsedMs = Date.now() - startedAt;
    return { success: true, event: parsed.event, providerId: provider.id, providerLabel: provider.label, providerElapsedMs, totalElapsedMs: 0, slow: false, retryUsed: true, providerFailures: [] };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return failure("timeout");
    return failure("api_error");
  } finally {
    clearTimeout(timeout);
  }
}

function buildAiEventRepairMessages(state: AiEventPromptState, issues: string[], contentPreview?: string) {
  const originalPrompt = buildUserPrompt(state);
  const repairGuidance = issues.length > 0
    ? `검증 실패 필드: ${issues.join(", ")}`
    : "JSON 형식이 올바르지 않습니다. 유효한 JSON 객체만 출력하세요.";
  const previewLine = contentPreview ? `원본 응답 미리보기: ${contentPreview.slice(0, 300)}` : "";

  return [
    {
      role: "system",
      content: `다음 JSON을 내용과 인과관계는 유지한 채 스키마에 맞게 교정한다. JSON 객체만 출력한다. 누락 필드를 채우고 타입을 바로잡는다.
필수 필드: title (1-100자), body (100-5200자 한국어 2문단), choices (2-3개, 각각 id/label/summary/statDelta/relationshipDelta), tags (1-5개).
body는 한국어 2문단, 4~5문장이다. summary는 "당신은"으로 시작한다.
statDelta 필드: academic, practical, health, mental, wealth, reputation, charm (선택적, 정수 -15~15, health/mental은 -1 이상).
temperature 0.3, 출력만 반환.`,
    },
    {
      role: "user",
      content: `${repairGuidance}
${previewLine}
원본 프롬프트:
${originalPrompt.slice(0, 1500)}`,
    },
  ];
}

async function generateAiEventWithProvider(
  provider: AiProvider,
  state: AiEventPromptState,
  timeoutMs: number,
  startedAt: number,
): Promise<OpenRouterResult | OpenRouterFailure> {
  if (!provider.key) {
    logAiAttempt({
      kind: "json",
      providerId: provider.id,
      providerLabel: provider.label,
      success: false,
      reason: "no_key",
      providerElapsedMs: 0,
    });
    return { success: false, reason: "no_key", providerId: provider.id, providerLabel: provider.label, providerElapsedMs: 0 };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const failure = (reason: AiEventFailureReason, issues?: string[], contentPreview?: string): OpenRouterFailure => ({
    success: false,
    reason,
    providerId: provider.id,
    providerLabel: provider.label,
    providerElapsedMs: Date.now() - startedAt,
    issues,
    contentPreview,
  });

  try {
    const response = await fetch(
      provider.id === "ollama"
        ? `${provider.baseUrl}/chat`
        : `${provider.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.key}`,
          "Content-Type": "application/json",
          ...provider.headers,
        },
        body: JSON.stringify(buildAiEventRequestBody(state, provider)),
        signal: controller.signal,
      },
    );

    if (response.status === 429) {
      logAiAttempt({
        kind: "json",
        providerId: provider.id,
        providerLabel: provider.label,
        success: false,
        reason: "rate_limited",
        httpStatus: response.status,
        providerElapsedMs: Date.now() - startedAt,
      });
      return failure("rate_limited");
    }

    if (!response.ok) {
      const responseBody = await response.text().catch(() => "(failed to read body)");
      console.warn("AI event provider returned non-ok response", {
        provider: provider.label,
        status: response.status,
        body: responseBody.slice(0, 500),
      });
      logAiAttempt({
        kind: "json",
        providerId: provider.id,
        providerLabel: provider.label,
        success: false,
        reason: "api_error",
        httpStatus: response.status,
        providerElapsedMs: Date.now() - startedAt,
      });
      return failure("api_error");
    }

    const responseText = await response.text();
    let parsedData: unknown;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      console.warn("AI event provider returned non-JSON response", {
        provider: provider.label,
        body: responseText.slice(0, 500),
      });
      return failure("api_error");
    }
    const data = parsedData as Record<string, unknown> | null;
    const responseUsage = {
      doneReason: typeof data?.done_reason === "string" ? data.done_reason : null,
      promptEvalCount: typeof data?.prompt_eval_count === "number" ? data.prompt_eval_count : null,
      evalCount: typeof data?.eval_count === "number" ? data.eval_count : null,
    };
    const choices = data?.choices;
    const firstChoice = Array.isArray(choices) ? choices[0] : null;
    const openAiMessage = firstChoice && typeof firstChoice === "object" ? (firstChoice as Record<string, unknown>).message : null;
    const message = provider.id === "ollama" ? (data?.message ?? openAiMessage) : openAiMessage;
    const content: string | undefined = message && typeof message === "object"
      ? (message as Record<string, unknown>).content as string | undefined
      : undefined;
    if (!content) {
      const messageRecord = message && typeof message === "object"
        ? message as Record<string, unknown>
        : null;
      logAiAttempt({
        kind: "json",
        providerId: provider.id,
        providerLabel: provider.label,
        success: false,
        reason: "empty_content",
        providerElapsedMs: Date.now() - startedAt,
        responseJsonMs: Date.now() - startedAt,
        responseKeys: data ? Object.keys(data) : [],
        messageKeys: messageRecord ? Object.keys(messageRecord) : [],
        contentType: typeof messageRecord?.content,
        contentLength: typeof messageRecord?.content === "string" ? messageRecord.content.length : 0,
        thinkingLength: typeof messageRecord?.thinking === "string" ? messageRecord.thinking.length : 0,
        ...responseUsage,
      });
      return failure("empty_content");
    }

    const parseStartedAt = Date.now();
    const parsed = parseAiEventContentDetailed(content);
    if (!parsed.success) {
      console.warn("AI event parse failure", {
        reason: parsed.reason,
        issues: parsed.issues,
        contentPreview: content.slice(0, 500),
        contentLength: content.length,
      });
      logAiAttempt({
        kind: "json",
        providerId: provider.id,
        providerLabel: provider.label,
        success: false,
        reason: parsed.reason,
        issues: parsed.issues,
        providerElapsedMs: Date.now() - startedAt,
        responseJsonMs: parseStartedAt - startedAt,
        parseMs: Date.now() - parseStartedAt,
        contentLength: content.length,
        ...responseUsage,
      });
      return failure(parsed.reason, parsed.issues, content.slice(0, 500));
    }

    const providerElapsedMs = Date.now() - startedAt;
    logAiAttempt({
      kind: "json",
      providerId: provider.id,
      providerLabel: provider.label,
      success: true,
      providerElapsedMs,
      responseJsonMs: parseStartedAt - startedAt,
      parseMs: Date.now() - parseStartedAt,
      contentLength: content.length,
      ...responseUsage,
    });
    return { success: true, event: parsed.event, providerId: provider.id, providerLabel: provider.label, providerElapsedMs, totalElapsedMs: 0, slow: false, retryUsed: false, providerFailures: [] };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      logAiAttempt({
        kind: "json",
        providerId: provider.id,
        providerLabel: provider.label,
        success: false,
        reason: "timeout",
        providerElapsedMs: Date.now() - startedAt,
      });
      return failure("timeout");
    }
    logAiAttempt({
      kind: "json",
      providerId: provider.id,
      providerLabel: provider.label,
      success: false,
      reason: "api_error",
      providerElapsedMs: Date.now() - startedAt,
    });
    return failure("api_error");
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateAiEventStream(
  state: AiEventPromptState,
  onBodyDelta: (delta: string) => void,
  options: AiProviderOptions = {},
): Promise<OpenRouterResult | OpenRouterFailure> {
  const totalStartedAt = Date.now();
  let lastFailure: OpenRouterFailure = { success: false, reason: "no_key" };
  const providerFailures: AiProviderFailureTelemetry[] = [];

  const providers = aiProviders(options);
  for (const [providerIndex, provider] of providers.entries()) {
    const providerStartedAt = Date.now();
    const remainingMs = getOpenRouterTimeoutMs() - (providerStartedAt - totalStartedAt);
    if (remainingMs <= 0) break;
    const attemptId = crypto.randomUUID();
    logAiAttempt({
      phase: "start",
      kind: "stream",
      attemptId,
      providerId: provider.id,
      providerLabel: provider.label,
      model: provider.model,
      providerRole: providerIndex === 0 ? "primary" : "fallback",
      timeoutMs: remainingMs,
      maxTokens: getAiEventMaxTokens(provider.id),
      promptChars: buildUserPrompt(state).length,
      ...options.trace,
    });
    let providerSentBody = false;
    const result = await generateAiEventStreamWithProvider(provider, state, (delta) => {
      providerSentBody = true;
      onBodyDelta(delta);
    }, remainingMs, providerStartedAt);
    const totalElapsedMs = Date.now() - totalStartedAt;
    const measured = { ...result, totalElapsedMs, slow: totalElapsedMs > SLOW_AI_GENERATION_MS };
    logAiAttempt({
      phase: "result",
      kind: "stream",
      attemptId,
      providerId: provider.id,
      providerLabel: provider.label,
      model: provider.model,
      success: measured.success,
      reason: measured.success ? null : measured.reason,
      providerElapsedMs: measured.providerElapsedMs ?? 0,
      totalElapsedMs,
      failureReasons: measured.success ? [] : (measured.providerFailures ?? []).map((failure) => failure.reason),
      providerSentBody,
      ...options.trace,
    });
    if (!measured.success) {
      logProviderFailure({
        kind: "stream",
        attemptId,
        providerId: provider.id,
        providerLabel: provider.label,
        model: provider.model,
        reason: measured.reason,
        providerElapsedMs: measured.providerElapsedMs ?? 0,
        totalElapsedMs,
        providerRole: providerIndex === 0 ? "primary" : "fallback",
      });
    }
    if (measured.success) return { ...measured, retryUsed: providerFailures.length > 0, providerFailures };
    lastFailure = measured;
    providerFailures.push(toProviderFailureTelemetry(provider, measured));
    console.warn("AI event stream provider failed", { provider: provider.label, reason: measured.reason });
    // A provider can stream a partial JSON body and still fail final parsing or
    // schema validation. The body is only used for timing here (the handler
    // buffers the event), so continue to the fallback provider in that case.
  }

  return { ...lastFailure, retryUsed: providerFailures.length > 1, providerFailures };
}

async function generateAiEventStreamWithProvider(
  provider: AiProvider,
  state: AiEventPromptState,
  onBodyDelta: (delta: string) => void,
  timeoutMs: number,
  startedAt: number,
): Promise<OpenRouterResult | OpenRouterFailure> {
  if (!provider.key) {
    logAiAttempt({
      kind: "stream",
      providerId: provider.id,
      providerLabel: provider.label,
      success: false,
      reason: "no_key",
      providerElapsedMs: 0,
    });
    return { success: false, reason: "no_key", providerId: provider.id, providerLabel: provider.label, providerElapsedMs: 0 };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const failure = (reason: AiEventFailureReason, issues?: string[]): OpenRouterFailure => ({
    success: false, reason, providerId: provider.id, providerLabel: provider.label,
    providerElapsedMs: Date.now() - startedAt, issues,
  });

  try {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.key}`,
        "Content-Type": "application/json",
        ...provider.headers,
      },
      body: JSON.stringify(buildAiEventStreamRequestBody(state, provider)),
      signal: controller.signal,
    });

    if (response.status === 429) {
      logAiAttempt({
        kind: "stream",
        providerId: provider.id,
        providerLabel: provider.label,
        success: false,
        reason: "rate_limited",
        httpStatus: response.status,
        providerElapsedMs: Date.now() - startedAt,
      });
      return failure("rate_limited");
    }
    if (!response.ok || !response.body) {
      logAiAttempt({
        kind: "stream",
        providerId: provider.id,
        providerLabel: provider.label,
        success: false,
        reason: "api_error",
        httpStatus: response.status,
        providerElapsedMs: Date.now() - startedAt,
      });
      console.warn("AI event stream provider returned non-ok response", {
        provider: provider.label,
        status: response.status,
        hasBody: Boolean(response.body),
      });
      return failure("api_error");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";
    let sentBody = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const decoded = decoder.decode(value, { stream: true });
      buffer += decoded;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        const payload = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed;
        if (!payload || payload === "[DONE]") continue;
        const parsed = safeJson(payload);
        if (readRecord(parsed)?.error) return failure("api_error");
        const token = extractChatToken(parsed);
        if (typeof token !== "string") continue;

        content += token;
        const bodyPreview = extractStreamingBody(content);
        if (bodyPreview.length > sentBody.length) {
          const nextDelta = bodyPreview.slice(sentBody.length);
          sentBody = bodyPreview;
          onBodyDelta(nextDelta);
        }
      }
    }

    if (buffer.trim()) {
      const trailing = buffer.trim();
      const payload = trailing.startsWith("data:") ? trailing.slice(5).trim() : trailing;
      const parsed = safeJson(payload);
      if (readRecord(parsed)?.error) return failure("api_error");
      const token = extractChatToken(parsed);
      if (typeof token === "string") {
        content += token;
      }
    }

    const parsed = parseAiEventContentDetailed(content);
    if (!parsed.success) {
      logAiAttempt({
        kind: "stream",
        providerId: provider.id,
        providerLabel: provider.label,
        success: false,
        reason: parsed.reason,
        issues: parsed.issues,
        providerElapsedMs: Date.now() - startedAt,
      });
      return failure(parsed.reason, parsed.issues);
    }
    const providerElapsedMs = Date.now() - startedAt;
    logAiAttempt({
      kind: "stream",
      providerId: provider.id,
      providerLabel: provider.label,
      success: true,
      providerElapsedMs,
      parseMs: 0,
    });
    return { success: true, event: parsed.event, providerId: provider.id, providerLabel: provider.label, providerElapsedMs, totalElapsedMs: 0, slow: false, retryUsed: false, providerFailures: [] };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      logAiAttempt({
        kind: "stream",
        providerId: provider.id,
        providerLabel: provider.label,
        success: false,
        reason: "timeout",
        providerElapsedMs: Date.now() - startedAt,
      });
      return failure("timeout");
    }
    logAiAttempt({
      kind: "stream",
      providerId: provider.id,
      providerLabel: provider.label,
      success: false,
      reason: "api_error",
      providerElapsedMs: Date.now() - startedAt,
    });
    return failure("api_error");
  } finally {
    clearTimeout(timeout);
  }
}

function buildAiEventRequestBody(state: AiEventPromptState, provider: AiProvider) {
  if (provider.id === "ollama") {
    return {
      model: provider.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(state) },
      ],
      // Ollama's native API supports JSON mode directly. Cloud currently does
      // not support JSON Schema structured outputs, so keep the schema in the
      // prompt and validate the result locally with Zod.
      format: "json",
      stream: false,
      think: "low",
      options: {
        temperature: 0.85,
        num_predict: getAiEventMaxTokens(provider.id),
      },
    };
  }

  return {
    model: provider.model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(state) },
    ],
    response_format: { type: "json_object" },
    // DeepSeek V4 Flash supports reasoning, but event generation only needs a
    // short, deterministic JSON document. Disable reasoning to preserve the
    // output budget for the actual event.
    ...(provider.id === "openrouter" ? { reasoning: { effort: "none" } } : { think: "low" }),
    max_tokens: getAiEventMaxTokens(provider.id),
    temperature: 0.85,
  };
}

function buildAiEventStreamRequestBody(state: AiEventPromptState, provider: AiProvider) {
  if (provider.id === "ollama") {
    return {
      model: provider.model,
      messages: [
        {
          role: "system",
          content: `${SYSTEM_PROMPT}

For streaming responsiveness, output the JSON object in this field order exactly: "title", "body", "choices", "tags". Start the "body" field immediately after the title. Do not delay the body text until after choices.`,
        },
        { role: "user", content: buildUserPrompt(state) },
      ],
      format: "json",
      stream: true,
      think: "low",
      options: {
        temperature: 0.85,
        num_predict: getAiEventMaxTokens(provider.id),
      },
    };
  }

  return {
    model: provider.model,
    messages: [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}

For streaming responsiveness, output the JSON object in this field order exactly: "title", "body", "choices", "tags". Start the "body" field immediately after the title. Do not delay the body text until after choices.`,
      },
      { role: "user", content: buildUserPrompt(state) },
    ],
    response_format: { type: "json_object" },
    max_tokens: getAiEventMaxTokens(provider.id),
    temperature: 0.85,
    stream: true,
  };
}

export function parseAiEventContent(content: string) {
  const parsed = parseAiEventContentDetailed(content);
  return parsed.success ? parsed.event : null;
}

type AiEventParseFailureReason = Exclude<AiEventFailureReason, "no_key" | "timeout" | "rate_limited" | "api_error" | "empty_content">;

export type AiEventParseResult =
  | { success: true; event: AiEventResponse }
  | { success: false; reason: AiEventParseFailureReason; issues: string[] };

function repairProviderContent(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith('"')) {
    try {
      const unwrapped = JSON.parse(trimmed);
      if (typeof unwrapped === "string" && /^\s*[{[]/.test(unwrapped.trim())) {
        return unwrapped;
      }
    } catch {
      /* not a JSON-string wrapper */
    }
  }

  return content;
}

export function parseAiEventContentDetailed(content: string): AiEventParseResult {
  const repaired = repairProviderContent(content);
  let raw: unknown;
  try {
    raw = extractJson(repaired);
  } catch {
    return { success: false, reason: "malformed_json", issues: ["json"] };
  }
  const normalized = normalizeAiEvent(raw);
  // After normalization, repair literal escaped newlines in string values
  // that survived JSON parsing (e.g. body containing literal \\n sequences).
  const repairedNormalized = repairNarrativeEscapes(normalized);
  const validated = aiEventSchema.safeParse(repairedNormalized);
  if (validated.success) return { success: true, event: validated.data };
  const issues = validated.error.issues.map((issue) => issue.path.join(".") || "event");
  const choiceIssues = validated.error.issues.filter((issue) => issue.path[0] === "choices");
  let reason: AiEventParseFailureReason = "narrative_schema";
  if (choiceIssues.some((issue) => issue.path.length === 1 && (issue.code === "too_small" || issue.code === "too_big"))) reason = "choice_count";
  else if (choiceIssues.some((issue) => issue.path.includes("statDelta") && (issue.code === "too_small" || issue.code === "too_big"))) reason = "choice_stat_range";
  else if (choiceIssues.some((issue) => issue.path.some((part) => part === "label" || part === "summary" || part === "id"))) reason = "choice_field";
  else if (choiceIssues.length > 0) reason = "choice_schema";
  return { success: false, reason, issues };
}

function repairNarrativeEscapes(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const obj = raw as Record<string, unknown>;

  const repairString = (value: unknown): unknown => {
    if (typeof value !== "string") return value;
    if (/\\n/.test(value)) {
      return value
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t");
    }
    return value;
  };

  const result: Record<string, unknown> = { ...obj };
  if (typeof result.body === "string") {
    result.body = repairString(result.body);
  }
  if (typeof result.title === "string") {
    result.title = repairString(result.title);
  }
  if (Array.isArray(result.choices)) {
    result.choices = result.choices.map((choice: unknown) => {
      if (typeof choice !== "object" || choice === null) return choice;
      const c = choice as Record<string, unknown>;
      return {
        ...c,
        label: repairString(c.label),
        summary: repairString(c.summary),
      };
    });
  }
  if (Array.isArray(result.tags)) {
    result.tags = result.tags.map((tag: unknown) =>
      typeof tag === "string" ? repairString(tag) : tag,
    );
  }
  return result;
}

export async function generateAiEnding(state: {
  name: string;
  age: number;
  major: string;
  stats: Record<string, number>;
  hiddenState: unknown;
  relationships: { name: string; role: string; trust: number; tags: unknown }[];
  eventHistory: { title: string; summary: string; statDelta: unknown; relationshipDelta: unknown; flagDelta: unknown }[];
  finalChoiceSummary: string;
  resultMode?: "final" | "crisis";
  relationshipLife?: { relationshipLife: string; parenting: { hasChildren: boolean; childCount: number; parentingStage: string } };
}): Promise<OpenRouterEndingResult | OpenRouterFailure> {
  let lastFailure: OpenRouterFailure = { success: false, reason: "no_key" };

  for (const provider of aiProviders()) {
    const result = await generateAiEndingWithProvider(provider, state);
    if (result.success) return result;
    lastFailure = result;
    console.warn("AI ending provider failed", {
      provider: provider.label,
      reason: result.reason,
      issues: result.issues,
    });
  }

  return lastFailure;
}

async function generateAiEndingWithProvider(
  provider: AiProvider,
  state: {
    name: string;
    age: number;
    major: string;
    stats: Record<string, number>;
    hiddenState: unknown;
    relationships: { name: string; role: string; trust: number; tags: unknown }[];
    eventHistory: { title: string; summary: string; statDelta: unknown; relationshipDelta: unknown; flagDelta: unknown }[];
    finalChoiceSummary: string;
    resultMode?: "final" | "crisis";
    relationshipLife?: { relationshipLife: string; parenting: { hasChildren: boolean; childCount: number; parentingStage: string } };
  },
): Promise<OpenRouterEndingResult | OpenRouterFailure> {
  if (!provider.key) return { success: false, reason: "no_key" };

  const controller = new AbortController();
  const timeoutMs = getAiEndingTimeoutMs();
  const maxTokens = getAiEndingMaxTokens(provider.id);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const messages = buildAiEndingMessages(state);
    const requestUrl = provider.id === "ollama"
      ? `${provider.baseUrl}/chat`
      : `${provider.baseUrl}/chat/completions`;
    const requestBody = provider.id === "ollama"
      ? {
          model: provider.model,
          messages,
          format: "json",
          stream: false,
          think: "low",
          options: { temperature: 0.9, num_predict: maxTokens },
        }
      : {
          model: provider.model,
          messages,
          response_format: { type: "json_object" },
          max_tokens: maxTokens,
          temperature: 0.9,
        };
    const requestEnding = (requestMessages: ReturnType<typeof buildAiEndingMessages>, temperature: number, tokenLimit: number) => fetch(requestUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.key}`,
        "Content-Type": "application/json",
        ...provider.headers,
      },
      body: JSON.stringify(provider.id === "ollama"
        ? {
            ...requestBody,
            messages: requestMessages,
            options: { temperature, num_predict: tokenLimit },
          }
        : {
            ...requestBody,
            messages: requestMessages,
            max_tokens: tokenLimit,
            temperature,
          }),
      signal: controller.signal,
    });
    const response = await requestEnding(messages, 0.9, maxTokens);

    if (response.status === 429) return { success: false, reason: "rate_limited", issues: ["http_429"] };
    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      logger.warn("ai_ending_provider_http_failure", {
        providerId: provider.id,
        providerLabel: provider.label,
        model: provider.model,
        status: response.status,
        timeoutMs,
        maxTokens,
        responsePreview: responseText.slice(0, 300),
      });
      return { success: false, reason: "api_error", issues: [`http_${response.status}`] };
    }

    const data = await response.json();
    const content = provider.id === "ollama"
      ? data?.message?.content ?? data?.choices?.[0]?.message?.content
      : data?.choices?.[0]?.message?.content;
    if (!content) return { success: false, reason: "invalid_response", issues: ["empty_content"] };

    const parsed = extractJson(content);
    let validated = aiEndingSchema.safeParse(normalizeAiEnding(parsed, state));
    if (!validated.success) {
      const issues = validated.error.issues.map((issue) => issue.path.join(".") || "ending");
      logger.warn("ai_ending_schema_failure", {
        providerId: provider.id,
        providerLabel: provider.label,
        issues,
        contentLength: content.length,
      });
      const repairMessages = buildAiEndingRepairMessages(content, issues);
      const repairResponse = await requestEnding(repairMessages, 0.35, Math.min(3_200, maxTokens));
      if (!repairResponse.ok) {
        return { success: false, reason: repairResponse.status === 429 ? "rate_limited" : "api_error", issues };
      }
      const repairData = await repairResponse.json();
      const repairedContent = provider.id === "ollama"
        ? repairData?.message?.content ?? repairData?.choices?.[0]?.message?.content
        : repairData?.choices?.[0]?.message?.content;
      if (!repairedContent) return { success: false, reason: "invalid_response", issues: [...issues, "repair_empty_content"] };
      validated = aiEndingSchema.safeParse(normalizeAiEnding(extractJson(repairedContent), state));
      if (!validated.success) {
        const repairIssues = validated.error.issues.map((issue) => issue.path.join(".") || "ending");
        logger.warn("ai_ending_repair_schema_failure", {
          providerId: provider.id,
          providerLabel: provider.label,
          issues: repairIssues,
          contentLength: repairedContent.length,
        });
        return { success: false, reason: "invalid_response", issues: repairIssues };
      }
    }

    return { success: true, ending: validated.data, providerId: provider.id, providerLabel: provider.label };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { success: false, reason: "timeout", issues: [`timeout_${timeoutMs}ms`] };
    }
    return { success: false, reason: "api_error" };
  } finally {
    clearTimeout(timeout);
  }
}

function buildAiEndingRepairMessages(content: string, issues: string[]) {
  return [
    {
      role: "system",
      content: `다음 JSON을 내용과 인과관계는 유지한 채 현실적인 한국어 커리어 회고문으로 교정한다. JSON 객체만 출력한다. 누락 필드를 채우고 타입을 바로잡는다. summary는 한국어 80~500자다. longNarrative는 900~2600자, 빈 줄로 나눈 정확히 2~3문단이어야 하며 각 문단은 220자 이상이어야 한다. 졸업 뒤 구직과 첫 직장, 실제 업무, 수입과 지출, 건강, 관계가 선택의 결과로 어떻게 달라졌는지 구체적으로 쓴다. 사건 제목을 목록처럼 나열하거나 교훈을 선언하지 않는다. 과장된 비유, 시적 상징, 운명적인 반전, 감상적인 마지막 문장을 피하고 일상적인 행동과 대화로 마무리한다. 시점은 끝까지 2인칭 "당신은"으로 유지하고 "나는/내가"로 바꾸지 않는다. 실제 기업·기관명 대신 원문에 주어진 허구 이름만 사용한다. 필수 필드: title, summary, longNarrative, careerPath, jobRole, destinationName, salaryBand, workplaceTone, satisfaction, growthPotential, workLifeBalance, healthState, relationshipState, tags. jobRole과 destinationName은 careerPath와 일관된 값을 채워야 하며, 절대 null이나 빈 값이면 안 된다.`,
    },
    {
      role: "user",
      content: `검증 실패 필드: ${issues.join(", ")}\n원본 JSON:\n${content}`,
    },
  ];
}

function buildAiEndingMessages(state: {
  name: string;
  age: number;
  major: string;
  stats: Record<string, number>;
  hiddenState: unknown;
  relationships: { name: string; role: string; trust: number; tags: unknown }[];
  eventHistory: { title: string; summary: string; statDelta: unknown; relationshipDelta: unknown; flagDelta: unknown }[];
  finalChoiceSummary: string;
  resultMode?: "final" | "crisis";
  relationshipLife?: { relationshipLife: string; parenting: { hasChildren: boolean; childCount: number; parentingStage: string } };
}) {
  return [
            {
              role: "system",
              content: `You write realistic final result records for a Korean career text-adventure. Return ONLY valid JSON.
The result must read like a polished but plainspoken Korean career retrospective, consistently in second-person "당신은" voice.
Treat the protagonist as a woman by default. Do not call the protagonist "오빠", "형", "군", or use male-coded address. Use "언니", "선배", "씨", or the protagonist's name if needed.
Use public stats, hidden state, every major event, and relationships. Include career life and what happened afterward.
The result should be nuanced but plausible: success can have practical costs and failure can leave a workable next step. Avoid dramatic reversals unless the supplied history clearly supports them. Do not make every ordinary final result feel like a bad ending. If result mode is "final", write a mixed but livable life with costs, gains, and a future. Reserve collapse, ruin, and hopelessness for result mode "crisis".
Possible results are not limited to office jobs. They may include romance, marriage, living alone, overseas working holiday, police/public safety, private investigator, lawyer/accountant/professional, founder, self-employed owner, artist/marketer, civil servant, criminal downfall, whistleblower, quiet rural life, or a lonely but peaceful life.
Do not use the word "엔딩" in title, summary, tags, or longNarrative. Call it "선택의 결과", "기록", or describe the concrete life result.
Never expose raw stat numbers in prose. Do not write phrases like "학점 10", "건강 6", "네트워크 3", "mental 4", "reputation 2", or any stat label followed by a number. Translate stats into qualitative language such as "성실하게 쌓은 지식", "좁지만 남은 관계망", "무리를 견디기 어려운 몸", or "쉽게 흔들리는 마음".
Do not grant a licensed profession, specific company job, public safety role, or startup selection unless hiddenState.eventFlags.careerGate.status is "passed" for that path. If the gate is failed or absent, write about preparation, rejection, retrying, or a different unspecific path.
The longNarrative must be 900-1800 Korean characters in exactly 2-3 substantial paragraphs separated by blank lines. Each paragraph must be at least 220 characters. Build one continuous story rather than a chronology or résumé:
1. Open in a concrete scene immediately after university, where a past choice changes what the protagonist can do now.
2. Move forward in time through a turning point. Weave career, a recurring person, money, health, and private life into causal action; do not list event titles or explain stats.
3. Close with one ordinary, specific action that shows the protagonist's current routine or next practical decision. Do not end with a generic lesson, aspiration, or summary.
Use concrete workplace and daily-life detail, including a short natural line of dialogue and a visible consequence of an earlier choice. Prefer direct description over metaphor. Avoid poetic symbols, ornate sensory imagery, fate-like language, melodrama, and sentimental closing lines. Never switch to first-person narration such as "나는" or "내가".
Separate the career result from the condition of the life that remains. Make careerPath/jobRole answer what happened occupationally, while healthState and relationshipState answer what it cost or preserved. In the prose, also resolve money, health, relationships, and self-respect independently so that two identical career outcomes can still represent different lives.
Mention at least three concrete past event titles or relationship names from the supplied history when they matter. Avoid generic summaries that could fit any playthrough.
Do not write route grades such as A/B/C, GOOD ROUTE, MIXED ROUTE, or HARD ROUTE.
Use only fictional/parody company or institution names found in the supplied state. Never name a real company or institution; if the supplied history contains one, replace it with a plausible fictional name.
Use hiddenState.eventFlags.careerState as the causal career spine. Prefer its leading candidates and selected organizations, and explicitly connect at least two careerState.evidence entries to the final role. Do not invent an organization outside that supplied pool.
If the character has a relationship life state (single, dating, cohabitation, married, divorced, widowed) or parenting state (expecting, newborn, toddler, school_age), reflect it naturally in the narrative. A marriage ending should feel earned from prior relationship history, not sudden. A parenting ending should show how the child changed the character's daily life and priorities. A single/independent ending should feel like a conscious choice, not a failure.`,
            },
            {
              role: "user",
              content: `주인공: ${state.name}, ${state.age}세, ${state.major}
주인공 성별/호칭: 여성. "오빠", "형", "군" 금지. 필요하면 "언니", "선배", "씨", 이름 사용.
결과 성격: ${state.resultMode ?? "final"}
공개 스탯 질적 요약: ${buildQualitativeStatsPrompt(state.stats)}
숨은 상태: ${JSON.stringify(state.hiddenState)}
관계도: ${JSON.stringify(state.relationships)}
전체 사건 기록(시간순, 하나도 생략하지 않음): ${JSON.stringify(buildEndingEventLedger(state.eventHistory))}
마지막 선택: ${state.finalChoiceSummary}
${state.relationshipLife ? `관계 생활 상태: ${state.relationshipLife.relationshipLife}${state.relationshipLife.parenting.hasChildren ? `, 자녀: ${state.relationshipLife.parenting.childCount}명 (${state.relationshipLife.parenting.parentingStage})` : ""}` : ""}

JSON fields: title, summary, longNarrative, careerPath, jobRole, destinationName, salaryBand, workplaceTone, satisfaction, growthPotential, workLifeBalance, healthState, relationshipState, tags.
jobRole과 destinationName은 careerPath와 일관된 구체적인 값이어야 한다. 절대 null이나 빈 문자열이면 안 된다. 예: careerPath가 "다람소프트 신입 실무자"이면 jobRole="신입 개발자", destinationName="다람소프트".`,
            },
          ];
}

function buildEndingEventLedger(
  eventHistory: { title: string; summary: string; statDelta: unknown; relationshipDelta: unknown; flagDelta: unknown }[],
) {
  return eventHistory.map((event, index) => ({
    order: index + 1,
    title: event.title,
    choice: event.summary,
    ...(hasMeaningfulEndingValue(event.statDelta) ? { statChange: event.statDelta } : {}),
    ...(hasMeaningfulEndingValue(event.relationshipDelta) ? { relationshipChange: event.relationshipDelta } : {}),
    ...(hasMeaningfulEndingValue(event.flagDelta) ? { consequence: event.flagDelta } : {}),
  }));
}

function hasMeaningfulEndingValue(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object" && value !== null) return Object.keys(value).length > 0;
  return value !== null && value !== undefined;
}

export function normalizeAiEnding(raw: unknown, state: { name: string; major: string; stats: Record<string, number>; finalChoiceSummary: string }) {
  const container = readRecord(raw) ?? {};
  const ending = readRecord(container.ending) ?? container;
  const careerPath = typeof ending.careerPath === "string" ? ending.careerPath : pickFallbackCareerPath(state.stats);
  const longNarrative = typeof ending.longNarrative === "string" ? ending.longNarrative :
    typeof ending.narrative === "string" ? ending.narrative :
    buildFallbackLongEnding({
      name: state.name,
      major: state.major,
      careerPath,
      stats: state.stats,
      finalChoiceSummary: state.finalChoiceSummary,
      relationshipState: typeof ending.relationshipState === "string" ? ending.relationshipState : "관계의 빛과 그림자가 함께 남음",
    });

  // Infer destinationName and jobRole from careerPath/title/summary when the
  // model omits them, so no successful ending record has null values.
  const inferredDestination = inferDestinationFromCareerPath(careerPath, ending, state);
  const inferredJobRole = inferJobRoleFromCareerPath(careerPath, ending, state);

  return {
    title: sanitizeEndingStatNumbers(typeof ending.title === "string" ? ending.title : `${state.name}의 ${careerPath}`),
    summary: sanitizeEndingStatNumbers(typeof ending.summary === "string" ? ending.summary : `${state.name}은 대학의 선택들을 지나 ${careerPath}에 닿았다.`),
    longNarrative: sanitizeEndingStatNumbers(longNarrative.length >= 500 ? longNarrative : `${longNarrative}\n\n${buildFallbackLongEnding({
      name: state.name,
      major: state.major,
      careerPath,
      stats: state.stats,
      finalChoiceSummary: state.finalChoiceSummary,
      relationshipState: typeof ending.relationshipState === "string" ? ending.relationshipState : "관계의 빛과 그림자가 함께 남음",
    })}`),
    careerPath,
    jobRole: sanitizeEndingStatNumbers(inferredJobRole),
    destinationName: sanitizeEndingStatNumbers(inferredDestination),
    salaryBand: typeof ending.salaryBand === "string" ? ending.salaryBand : null,
    workplaceTone: Array.isArray(ending.workplaceTone) ? ending.workplaceTone.filter((item) => typeof item === "string").map(sanitizeEndingStatNumbers) : [],
    satisfaction: clampScore(ending.satisfaction, Math.round((state.stats.health + state.stats.mental + state.stats.reputation) / 3)),
    growthPotential: clampScore(ending.growthPotential, Math.round((state.stats.academic + state.stats.practical + state.stats.charm) / 3)),
    workLifeBalance: clampScore(ending.workLifeBalance, Math.round((state.stats.health + state.stats.mental) / 2)),
    healthState: typeof ending.healthState === "string" ? sanitizeEndingStatNumbers(ending.healthState) : state.stats.health >= 6 ? "버틸 만함" : "쉽게 지침",
    relationshipState: typeof ending.relationshipState === "string" ? sanitizeEndingStatNumbers(ending.relationshipState) : "관계의 빛과 그림자가 함께 남음",
    tags: Array.isArray(ending.tags) && ending.tags.length > 0 ? ending.tags.filter((tag) => typeof tag === "string").map(sanitizeEndingStatNumbers).slice(0, 10) : ["선택의 결과", careerPath],
  };
}

function inferDestinationFromCareerPath(
  careerPath: string,
  ending: Record<string, unknown>,
  state: { name: string; major: string; stats: Record<string, number> },
): string {
  if (typeof ending.destinationName === "string" && ending.destinationName.trim().length > 0) {
    return ending.destinationName;
  }
  const title = typeof ending.title === "string" ? ending.title : "";
  const summary = typeof ending.summary === "string" ? ending.summary : "";
  const combined = `${careerPath} ${title} ${summary}`;

  if (combined.includes("다람소프트") || combined.includes("삼슨") || combined.includes("네이봐") ||
      combined.includes("카캉") || combined.includes("배달이민족") || combined.includes("규글") ||
      combined.includes("스타벅수") || combined.includes("엘쥐") || combined.includes("현댜") ||
      combined.includes("에스끼리텔")) {
    const companies = ["다람소프트", "삼슨전자", "네이봐", "카캉오", "배달이민족", "규글코리아", "스타벅수커피", "엘쥐전자", "현댜모터스", "에스끼리텔"];
    const matched = companies.find((c) => combined.includes(c));
    if (matched) return matched;
  }
  if (combined.includes("공공") || combined.includes("공무원") || combined.includes("공기업")) return "공공기관";
  if (combined.includes("창업") || combined.includes("스타트업")) return "창업";
  if (combined.includes("전문직") || combined.includes("시험") || combined.includes("회계사") || combined.includes("변리사") || combined.includes("로스쿨")) return "전문직 시험";
  if (combined.includes("대학원") || combined.includes("석사") || combined.includes("박사") || combined.includes("연구")) return "대학원";
  if (combined.includes("워홀") || combined.includes("해외")) return "해외";
  if (combined.includes("결혼") || combined.includes("연애") || combined.includes("가정")) return "가정";
  if (combined.includes("자영업") || combined.includes("프리랜서")) return "자영업";

  return `${careerPath} 관련 직장`;
}

function inferJobRoleFromCareerPath(
  careerPath: string,
  ending: Record<string, unknown>,
  state: { name: string; major: string; stats: Record<string, number> },
): string {
  if (typeof ending.jobRole === "string" && ending.jobRole.trim().length > 0) {
    return ending.jobRole;
  }
  const title = typeof ending.title === "string" ? ending.title : "";
  const summary = typeof ending.summary === "string" ? ending.summary : "";
  const combined = `${careerPath} ${title} ${summary}`;

  if (combined.includes("신입") || combined.includes("사원") || combined.includes("실무자")) return "신입 사원";
  if (combined.includes("대표") || combined.includes("CEO") || combined.includes("창업자")) return "창업자";
  if (combined.includes("연구") || combined.includes("개발") || combined.includes("엔지니어")) return "연구개발 직무";
  if (combined.includes("마케팅") || combined.includes("홍보") || combined.includes("콘텐츠")) return "마케팅 직무";
  if (combined.includes("영업") || combined.includes("세일즈")) return "영업 직무";
  if (combined.includes("회계") || combined.includes("재무") || combined.includes("경리")) return "회계/재무 직무";
  if (combined.includes("인사") || combined.includes("HR") || combined.includes("채용")) return "인사 직무";
  if (combined.includes("디자인") || combined.includes("UI") || combined.includes("UX")) return "디자인 직무";
  if (combined.includes("공무") || combined.includes("행정")) return "행정 직무";
  if (combined.includes("간호") || combined.includes("의사") || combined.includes("약사") || combined.includes("보건")) return "의료/보건 직무";
  if (combined.includes("교사") || combined.includes("강사") || combined.includes("교육")) return "교육 직무";

  return "일반 사무직";
}

function buildQualitativeStatsPrompt(stats: Record<string, number>) {
  const entries = [
    ["학업", stats.academic],
    ["실무 감각", stats.practical],
    ["건강", stats.health],
    ["멘탈", stats.mental],
    ["자산", stats.wealth],
    ["평판", stats.reputation],
    ["매력", stats.charm],
  ] as const;

  return entries.map(([label, value]) => `${label}: ${qualitativeStatLevel(value)}`).join(", ");
}

function qualitativeStatLevel(value: number | undefined) {
  const score = typeof value === "number" ? value : 5;
  if (score >= 8) return "강한 축";
  if (score >= 6) return "꽤 버팀";
  if (score >= 4) return "불안하지만 유지됨";
  if (score >= 2) return "취약함";
  return "거의 바닥남";
}

function sanitizeEndingStatNumbers(text: string) {
  const labels = [
    "학점",
    "학업",
    "지식",
    "실무",
    "실무력",
    "건강",
    "멘탈",
    "정신",
    "자산",
    "돈",
    "평판",
    "명성",
    "매력",
    "네트워크",
    "관계",
    "academic",
    "practical",
    "health",
    "mental",
    "wealth",
    "reputation",
    "charm",
    "network",
  ];
  const labelPattern = labels.join("|");
  return text
    .replace(new RegExp(`(${labelPattern})\\s*(?:수치|점수|스탯|stat)?\\s*(?:은|는|이|가|의)?\\s*[:：]?\\s*(?:10|[0-9])\\b`, "gi"), "$1")
    .replace(/[^\S\r\n]{2,}/g, " ")
    .replace(/\n[\t ]*\n(?:[\t ]*\n)+/g, "\n\n")
    .trim();
}

function clampScore(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(numeric) ? numeric : fallback)));
}

function extractJson(content: string) {
  try {
    return JSON.parse(content);
  } catch {
    // Strip markdown code fences and leading/trailing whitespace
    const cleaned = content.replace(/```(?:json)?\s*/gi, "").replace(/```\s*$/gm, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("No JSON object found");
    }
    return JSON.parse(match[0]);
  }
}

function extractStreamingBody(content: string) {
  const match = content.match(/"body"\s*:\s*"/);
  if (!match || match.index === undefined) return "";
  let output = "";
  let escaped = false;
  const start = match.index + match[0].length;

  for (let i = start; i < content.length; i += 1) {
    const char = content[i];
    if (escaped) {
      output += decodeJsonEscape(char);
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") break;
    output += char;
  }

  return output;
}

function decodeJsonEscape(char: string) {
  if (char === "n") return "\n";
  if (char === "r") return "\r";
  if (char === "t") return "\t";
  if (char === "\"") return "\"";
  if (char === "\\") return "\\";
  return char;
}

function safeJson(content: string) {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function extractChatToken(payload: unknown) {
  const choices = readRecord(payload)?.choices;
  if (!Array.isArray(choices)) return null;
  const choice = readRecord(choices[0]);
  const delta = readRecord(choice?.delta);
  const deltaContent = delta?.content;
  if (typeof deltaContent === "string" && deltaContent.length > 0) return deltaContent;
  const message = readRecord(choice?.message);
  const messageContent = message?.content;
  if (typeof messageContent === "string" && messageContent.length > 0) return messageContent;
  // Reasoning is not part of the structured event document. Never append it
  // to content: thinking text before the JSON would make the final document
  // look malformed even when the provider later emits valid JSON content.
  return null;
}

export function normalizeAiEvent(raw: unknown) {
  if (typeof raw !== "object" || raw === null) return raw;
  const container = raw as Record<string, unknown>;
  const event = readRecord(container.event) ?? readRecord(container.storyEvent) ?? container;
  const rawChoices = Array.isArray(event.choices) ? event.choices :
    Array.isArray(event.options) ? event.options :
    Array.isArray(event.actions) ? event.actions :
    [];
  const choices = rawChoices.map((choice) => normalizeChoice(choice)) as Array<{
    id: string;
    label: string;
    summary: string;
    statDelta: Record<string, number>;
    relationshipDelta: { name: string; trust: number; status?: string }[];
  }>;
  for (let index = 0; index < choices.length; index += 1) {
    const delta = choices[index].statDelta;
    if (typeof delta?.mental === "number" && delta.mental < 0 && !hasMeaningfulMentalCost(event, choices[index])) {
      choices[index] = { ...choices[index], statDelta: { ...delta, mental: 0 } };
    }
  }
  const mentalLossIndices = choices
    .map((c, i) => {
      const delta = c.statDelta;
      return (delta && typeof delta.mental === "number" && delta.mental < 0) ? i : -1;
    })
    .filter((i) => i >= 0);
  if (mentalLossIndices.length > 1) {
    for (let k = 1; k < mentalLossIndices.length; k++) {
      const idx = mentalLossIndices[k];
      const delta = choices[idx].statDelta;
      if (delta && typeof delta.mental === "number") {
        choices[idx] = { ...choices[idx], statDelta: { ...delta, mental: 0 } };
      }
    }
  }
  const nonLossCount = choices.filter((c) => {
    const delta = c.statDelta;
    return !delta || typeof delta.mental !== "number" || delta.mental >= 0;
  }).length;
  if (nonLossCount < 1 && choices.length > 0) {
    const firstLoss = choices.findIndex((c) => {
      const delta = c.statDelta;
      return delta && typeof delta.mental === "number" && delta.mental < 0;
    });
    if (firstLoss >= 0) {
      const delta = choices[firstLoss].statDelta;
      choices[firstLoss] = { ...choices[firstLoss], statDelta: { ...delta, mental: 0 } };
    }
  }
  return {
    title: event.title,
    body: typeof event.body === "string" ? event.body :
      typeof event.description === "string" ? event.description :
      event.narrative,
    tags: event.tags,
    choices,
  };
}

function hasMeaningfulMentalCost(
  event: Record<string, unknown>,
  choice: { label: string; summary: string },
) {
  const choiceText = `${choice.label ?? ""} ${choice.summary ?? ""}`;
  const directBurden = /(밤을?\s*새|밤샘|수면을?\s*포기|잠을?\s*줄|과로|무리(?:하|해서|를\s*감수)|혼자\s*(?:떠안|감당)|부담을?\s*숨|감정을?\s*숨|고립을?\s*택|관계를?\s*끊|이별|상실|장례|죽음|모욕|굴욕|망신|협박|폭력|범죄|불법|도박|위험을?\s*감수|양심을?\s*저버|배신|정면\s*충돌|격렬한\s*갈등|공황|극심한\s*(?:불안|공포)|두려움을?\s*억누)/;
  if (directBurden.test(choiceText)) return true;

  const eventText = `${String(event.title ?? "")} ${String(event.body ?? "")} ${Array.isArray(event.tags) ? event.tags.join(" ") : ""}`;
  const severeSituation = /(협박|폭력|범죄|불법|장례|죽음|이별\s*통보|해고|퇴출|심각한\s*갈등|공황|극심한\s*(?:불안|공포)|밤샘|과로)/.test(eventText);
  const engagedChoice = /(맞서|감수|버티|숨기|계속하|받아들이|혼자|직접\s*부딪)/.test(choiceText);
  return severeSituation && engagedChoice;
}

function normalizeChoice(raw: unknown) {
  const choice = readRecord(raw);
  if (!choice) return raw;
  const rawDelta = readRecord(choice.statDelta) ?? readRecord(choice.statChanges) ?? readRecord(choice.effects);
  const statDelta = rawDelta ? Object.fromEntries(
    Object.entries(rawDelta).map(([key, value]) => {
      if (allowedStats.includes(key as typeof allowedStats[number])) {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) {
          const minimum = key === "health" || key === "mental" ? -1 : -15;
          return [key, Math.max(minimum, Math.min(15, Math.round(numeric)))];
        }
      }
      return [key, value];
    }),
  ) : choice.statDelta ?? {};
  const summarySource = typeof choice.summary === "string" ? choice.summary :
    typeof choice.next === "string" ? choice.next :  // handle Ollama "next" field
    choice.nextEvent;
  const summary = typeof summarySource === "string" && !summarySource.startsWith("당신은")
    ? `당신은 ${summarySource}`
    : summarySource ?? `당신은 ${String(choice.label ?? choice.text ?? "선택")}을(를) 선택했다`;

  return {
    id: typeof choice.id === "string" ? choice.id :
      typeof choice.id === "number" ? String(choice.id) :
      (typeof choice.label === "string" ? choice.label : String(choice.text ?? "choice_0")).replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 40),
    label: typeof choice.label === "string" ? choice.label :
      choice.text,
    summary,
    statDelta,
    relationshipDelta: normalizeRelationshipDelta(choice.relationshipDelta ?? choice.relationshipChanges),
  };
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function normalizeRelationshipDelta(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const rel = readRecord(item);
      if (!rel || typeof rel.name !== "string") return null;
      const normalizedName = normalizeRelationshipName(rel.name);
      if (!normalizedName) return null;
      const trust = Number(rel.trust ?? rel.delta ?? rel.change);
      if (!Number.isFinite(trust)) return null;
      return {
        name: normalizedName,
        trust: Math.max(-30, Math.min(30, Math.round(trust))),
        ...(typeof rel.status === "string" && ["acquaintance", "friend", "crush", "dating", "ex"].includes(rel.status)
          ? { status: rel.status as "acquaintance" | "friend" | "crush" | "dating" | "ex" }
          : {}),
      };
    })
    .filter((item): item is { name: string; trust: number; status?: "acquaintance" | "friend" | "crush" | "dating" | "ex" } => Boolean(item));
}

const aiBranchProposalSchema = z.object({
  proposals: z
    .array(
      z.object({
        id: z.string().min(1).max(60),
        label: z.string().min(1).max(200),
        summary: z.string().min(1).max(500),
        suggestedDestinationKind: z.string().min(1).max(60).optional(),
        statRequirements: z
          .object({
            academic: z.number().int().min(1).max(10).optional(),
            practical: z.number().int().min(1).max(10).optional(),
            health: z.number().int().min(1).max(10).optional(),
            mental: z.number().int().min(1).max(10).optional(),
            wealth: z.number().int().min(1).max(10).optional(),
            reputation: z.number().int().min(1).max(10).optional(),
            charm: z.number().int().min(1).max(10).optional(),
          })
          .optional(),
        relationshipRequirements: z
          .array(
            z.object({
              name: z.string().min(1).max(60),
              minTrust: z.number().int().min(-100).max(100),
            }),
          )
          .optional(),
      }),
    )
    .min(2)
    .max(4),
});

export type AiBranchProposalResponse = z.infer<typeof aiBranchProposalSchema>;

const BRANCH_PROPOSAL_SYSTEM_PROMPT = `You are a creative director for a Korean college life text-adventure game.

Generate 2-4 possible future branch directions for the character. Each branch represents a possible life path the character could pursue.
Treat the protagonist as a woman by default. Do not use male-coded address such as "오빠", "형", or "군".

For each branch, provide:
- id: A unique short identifier (e.g., "career_company", "romance_marriage", "academic_grad_school")
- label: A short Korean label describing the branch (e.g., "대기업 취업 준비", "연애와 결혼", "대학원 진학")
- summary: A 1-3 sentence Korean description of what this branch entails
- suggestedDestinationKind (optional): The kind of destination this branch leads to (company, public_sector, professional_exam, startup, self_employment, graduate_school, overseas, lab)
- statRequirements (optional): Minimum stat levels needed for this branch
- relationshipRequirements (optional): Relationship trust levels needed

Consider:
- The character's current stats, relationships, and story arc
- Existing destination candidates the character has
- The character's academic plan and life stage
- Make branches feel connected to past events and choices
- Include a mix of career, academic, relationship, and life-style branches
- At least one branch should be achievable given current state
- Do not suggest branches that contradict established character state

Return ONLY valid JSON with a "proposals" array.`;

export async function generateAiBranchProposals(state: {
  name: string;
  age: number;
  major: string;
  gradeYear: number | null;
  coreEventCount: number;
  stats: Record<string, number>;
  relationships: { name: string; role: string; trust: number }[];
  lifeStage: string;
  graduation: string;
  destinationCandidates: { id: string; kind: string; name: string; status: string }[];
  storyArc: unknown;
}): Promise<{ success: true; proposals: AiBranchProposalResponse["proposals"] } | { success: false; reason: string }> {
  let lastFailure: { success: false; reason: string } = { success: false, reason: "no_key" };

  for (const provider of aiProviders()) {
    const result = await generateAiBranchProposalsWithProvider(provider, state);
    if (result.success) return result;
    lastFailure = result;
    console.warn("AI branch provider failed", { provider: provider.label, reason: result.reason });
  }

  return lastFailure;
}

async function generateAiBranchProposalsWithProvider(
  provider: AiProvider,
  state: {
    name: string;
    age: number;
    major: string;
    gradeYear: number | null;
    coreEventCount: number;
    stats: Record<string, number>;
    relationships: { name: string; role: string; trust: number }[];
    lifeStage: string;
    graduation: string;
    destinationCandidates: { id: string; kind: string; name: string; status: string }[];
    storyArc: unknown;
  },
): Promise<{ success: true; proposals: AiBranchProposalResponse["proposals"] } | { success: false; reason: string }> {
  if (!provider.key) return { success: false, reason: "no_key" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getOpenRouterTimeoutMs());

  try {
    const response = await fetch(provider.baseUrl + "/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.key}`,
        "Content-Type": "application/json",
        ...provider.headers,
      },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            { role: "system", content: BRANCH_PROPOSAL_SYSTEM_PROMPT },
            {
              role: "user",
              content: `주인공: ${state.name}, ${state.age}세, ${state.major}, ${state.gradeYear ?? "?"}학년
생활 단계: ${state.lifeStage}
졸업 상태: ${state.graduation}
진행된 핵심 사건 수: ${state.coreEventCount}
현재 공개 스탯: ${JSON.stringify(state.stats)}
주요 관계: ${JSON.stringify(state.relationships)}
기존 목적지 후보: ${JSON.stringify(state.destinationCandidates)}
스토리 아크: ${JSON.stringify(state.storyArc)}

위 정보를 바탕으로 2-4개의 미래 분기 방향을 생성하세요.`,
            },
          ],
          response_format: { type: "json_object" },
          max_tokens: 2000,
          temperature: 0.8,
        }),
      signal: controller.signal,
    });

    if (response.status === 429) return { success: false, reason: "rate_limited" };
    if (!response.ok) return { success: false, reason: "api_error" };

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return { success: false, reason: "invalid_response" };

    const parsed = extractJson(content);
    const validated = aiBranchProposalSchema.safeParse(parsed);

    if (!validated.success) return { success: false, reason: "invalid_response" };

    return { success: true, proposals: validated.data.proposals };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { success: false, reason: "timeout" };
    }
    return { success: false, reason: "api_error" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkDailyAiLimit(userId: string): Promise<{
  allowed: boolean;
  count: number;
  limit: null;
}> {
  const { prisma } = await import("@/lib/server/prisma");

  const today = new Date().toISOString().slice(0, 10);

  const usage = await prisma.aiUsage.findUnique({
    where: { userId_date: { userId, date: today } },
  });

  const count = usage?.count ?? 0;

  return { allowed: true, count, limit: null };
}

export async function incrementAiUsage(userId: string): Promise<void> {
  const { prisma } = await import("@/lib/server/prisma");

  const today = new Date().toISOString().slice(0, 10);

  await prisma.aiUsage.upsert({
    where: { userId_date: { userId, date: today } },
    update: { count: { increment: 1 } },
    create: { userId, date: today, count: 1 },
  });
}
