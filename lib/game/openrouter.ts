import { z } from "zod";

import { logger } from "@/lib/server/logger";

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
};

const primaryProvider = (): AiProvider => ({
  id: "ollama",
  label: "Ollama DeepSeek",
  baseUrl: "https://ollama.com/v1",
  key: process.env.OLLAMA_API_KEY ?? null,
  model: "deepseek-v4-flash:cloud",
});

const fallbackProvider = (): AiProvider => ({
  id: "openrouter",
  label: "OpenRouter",
  baseUrl: "https://openrouter.ai/api/v1",
  key: process.env.OPENROUTER_API_KEY ?? null,
  model: process.env.OPENROUTER_MODEL ?? "qwen/qwen3-30b-a3b:free",
  headers: {
    "HTTP-Referer": process.env.NEXTAUTH_URL ?? "https://sano-officeworker.vercel.app",
    "X-Title": "Sano Officeworker",
  },
});

const aiProviders = (options: AiProviderOptions = {}) =>
  options.skipPrimary ? [fallbackProvider()] : [primaryProvider(), fallbackProvider()];

// Default to the full generation window unless deployment overrides it.
const DEFAULT_AI_TIMEOUT_MS = 60_000;
const MIN_AI_TIMEOUT_MS = 5_000;
const MAX_AI_TIMEOUT_MS = 120_000;
export const SLOW_AI_GENERATION_MS = 10_000;

const DEFAULT_AI_MAX_TOKENS = 1_800;
const MIN_AI_MAX_TOKENS = 400;
const MAX_AI_MAX_TOKENS = 4_000;

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

const aiEventSchema = z.object({
  title: z.string().min(1).max(100),
  body: z.string().min(100).max(5200),
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
          mental: z.number().int().min(-15).max(15).optional(),
          wealth: z.number().int().min(-15).max(15).optional(),
          reputation: z.number().int().min(-15).max(15).optional(),
          charm: z.number().int().min(-15).max(15).optional(),
        }).strict(),
        relationshipDelta: z.array(z.object({
          name: z.string().min(1).max(60),
          trust: z.number().int().min(-30).max(30),
        })).optional(),
      }),
    )
    .min(2)
    .max(4),
  tags: z.array(z.string()).min(1).max(5),
});

export type AiEventResponse = z.infer<typeof aiEventSchema>;

const aiEndingSchema = z.object({
  title: z.string().min(1).max(120),
  summary: z.string().min(80).max(500),
  longNarrative: z.string().min(500).max(5000),
  careerPath: z.string().min(1).max(100),
  jobRole: z.string().nullable().optional(),
  destinationName: z.string().nullable().optional(),
  salaryBand: z.string().nullable().optional(),
  workplaceTone: z.array(z.string()).max(8).default([]),
  satisfaction: z.number().int().min(0).max(100),
  growthPotential: z.number().int().min(0).max(100),
  workLifeBalance: z.number().int().min(0).max(100),
  healthState: z.string().min(1).max(80),
  relationshipState: z.string().min(1).max(120),
  tags: z.array(z.string()).min(1).max(10),
});

export type AiEndingResponse = z.infer<typeof aiEndingSchema>;

const allowedStats = ["academic", "practical", "health", "mental", "wealth", "reputation", "charm"] as const;

const SYSTEM_PROMPT = `You are a Korean college-life text-adventure writer.

Return ONLY valid JSON in a single JSON object with "title", "body", "tags", and "choices". "choices" must contain 2-4 complete objects, and each choice must include "id", "label", "summary", "statDelta", and "relationshipDelta". Keep the event in Korean, in "당신은" voice, with 2-3 paragraphs and 6-10 sentences. Make it one small incident inside the larger story arc.

Keep continuity with recent choices, relationships, open threads, and stats. Avoid repeating closed proposals or stale scenes. Use only the public stats in statDelta, keep health decreases at -1 or above, and make at least one choice clearly risky with a downside. Choice labels should be natural actions. Summaries must start with "당신은".

The scene can come from college, work, family, romance, clubs, career prep, exams, overseas plans, hobbies, or other daily life. Treat the protagonist as a woman by default, avoid male-coded address, and use fictional/parody names only.
`;

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
  avoidPeople?: string[];
};

export function buildUserPrompt(state: AiEventPromptState): string {
  const semesterLabel = state.academicTerm ?? `${state.gradeYear ?? "?"}학년`;
  const totalSemesters = 8;
  const eventsPerSemester = 5;
  const currentSemester = Math.min(Math.floor(state.coreEventCount / eventsPerSemester) + 1, totalSemesters);
  const progressRatio = state.coreEventCount / 40;

  let toneGuidance = "";
  if (progressRatio < 0.15) {
    toneGuidance = "발단: 가벼운 일상, 학교 탐색, 작은 선택.";
  } else if (progressRatio < 0.35) {
    toneGuidance = "전개: 알바, 동아리, 시험, 관계의 미묘한 변화.";
  } else if (progressRatio < 0.55) {
    toneGuidance = "위기: 돈, 진로, 관계, 가족 압박과 위험한 제안.";
  } else if (progressRatio < 0.75) {
    toneGuidance = "절정: 이전 선택의 결과와 구체적인 대가.";
  } else {
    toneGuidance = "결말: 진로, 관계, 학사의 방향이 수렴.";
  }

  const contextParts = [
    `주인공=${state.name}|${state.age}세|${state.major}|${state.gradeYear ?? "?"}학년|${state.residence ?? "미상"}`,
    `단계=${state.lifeStage ?? "unknown"}|${state.graduation ?? "normal"}|학기=${semesterLabel}/${totalSemesters}|사건=${state.coreEventCount}|가이드=${toneGuidance}`,
    `아크=${JSON.stringify(state.storyArc)}`,
    `최근=${state.recentSummaries.slice(0, 4).join(" || ") || "낯선 아침"}`,
    `사용제목=${state.usedEventTitles.slice(0, 8).join(" | ") || "없음"}`,
    `닫힘=${buildResolvedOfferPrompt(state.eventFlags)}`,
    `회피=${state.avoidCategories?.join(",") || "없음"}|우선=${state.preferCategories?.join(",") || "없음"}|회피인물=${state.avoidPeople?.join(",") || "없음"}`,
    `스탯=${JSON.stringify(state.stats)}`,
    `관계=${JSON.stringify(state.relationships)}`,
  ];

  const activeParts = [
    state.academicPlan ? `학업=${JSON.stringify(state.academicPlan)}` : "",
    state.destinationCandidates ? `목적지=${JSON.stringify(state.destinationCandidates)}` : "",
    (state.specs ?? []).length > 0 ? `스펙=${JSON.stringify(state.specs)}` : "",
    (state.jobApplications ?? []).some((app) => app.isActive) ? `지원=${JSON.stringify((state.jobApplications ?? []).filter((app) => app.isActive))}` : "",
    (state.careerPaths ?? []).length > 0 ? `진로=${JSON.stringify(state.careerPaths)}` : "",
    buildCareerDiversityPrompt(state),
  ].filter(Boolean);

  return [...contextParts, ...activeParts].join("\n");
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
    guidance.push("중반/후반: 스터디만 반복하지 말고 인턴, 어학, 포트폴리오, 공모전, 현장실습, 추가학기, 워홀, 시험 준비를 우선 고려");
  }
  if (state.lifeStage === "college_late") {
    guidance.push("후반: 서류/인성검사/코테/면접/발표/불합격/조건협상");
  }
  if (state.lifeStage === "college_late" || state.graduation === "gate_ready") {
    guidance.push("관문: 최근 선택+지원/스펙/관계 2개 이상 반영");
    guidance.push("관문 선택지는 합격/불합격이 아니라 전략 행동으로");
  }
  if (state.major.includes("교육")) {
    guidance.push("교육계열만 임용 가능");
  }
    guidance.push("장소/인물/압박을 바꾸고, 학교 밖 사건도 우선 고려");
    guidance.push("여가도 끝내지 말고 인맥/비용/포트폴리오/관계/정보 씨앗을 남길 것");

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

export async function generateAiEvent(
  state: AiEventPromptState,
  options: AiProviderOptions = {},
): Promise<OpenRouterResult | OpenRouterFailure> {
  const totalStartedAt = Date.now();
  let lastFailure: OpenRouterFailure = { success: false, reason: "no_key" };
  const providerFailures: AiProviderFailureTelemetry[] = [];

  for (const provider of aiProviders(options)) {
    const providerStartedAt = Date.now();
    const remainingMs = getOpenRouterTimeoutMs() - (providerStartedAt - totalStartedAt);
    if (remainingMs <= 0) break;
    const result = await generateAiEventWithProvider(provider, state, remainingMs, providerStartedAt);
    const totalElapsedMs = Date.now() - totalStartedAt;
    const measured = { ...result, totalElapsedMs, slow: totalElapsedMs > SLOW_AI_GENERATION_MS };
    if (measured.success) return { ...measured, retryUsed: providerFailures.length > 0, providerFailures };
    lastFailure = measured;
    providerFailures.push(toProviderFailureTelemetry(provider, measured));
    console.warn("AI event provider failed", { provider: provider.label, reason: measured.reason });
  }

  return { ...lastFailure, retryUsed: providerFailures.length > 1, providerFailures };
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
  const failure = (reason: AiEventFailureReason, issues?: string[]): OpenRouterFailure => ({
    success: false,
    reason,
    providerId: provider.id,
    providerLabel: provider.label,
    providerElapsedMs: Date.now() - startedAt,
    issues,
  });

  try {
    const response = await fetch(
      `${provider.baseUrl}/chat/completions`,
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
    const choices = data?.choices;
    const firstChoice = Array.isArray(choices) ? choices[0] : null;
    const message = firstChoice && typeof firstChoice === "object" ? (firstChoice as Record<string, unknown>).message : null;
    const content: string | undefined = message && typeof message === "object" ? (message as Record<string, unknown>).content as string | undefined : undefined;

    if (!content) {
      logAiAttempt({
        kind: "json",
        providerId: provider.id,
        providerLabel: provider.label,
        success: false,
        reason: "empty_content",
        providerElapsedMs: Date.now() - startedAt,
        responseJsonMs: Date.now() - startedAt,
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
      });
      return failure(parsed.reason, parsed.issues);
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

  for (const provider of aiProviders(options)) {
    const providerStartedAt = Date.now();
    const remainingMs = getOpenRouterTimeoutMs() - (providerStartedAt - totalStartedAt);
    if (remainingMs <= 0) break;
    let providerSentBody = false;
    const result = await generateAiEventStreamWithProvider(provider, state, (delta) => {
      providerSentBody = true;
      onBodyDelta(delta);
    }, remainingMs, providerStartedAt);
    const totalElapsedMs = Date.now() - totalStartedAt;
    const measured = { ...result, totalElapsedMs, slow: totalElapsedMs > SLOW_AI_GENERATION_MS };
    if (measured.success) return { ...measured, retryUsed: providerFailures.length > 0, providerFailures };
    lastFailure = measured;
    providerFailures.push(toProviderFailureTelemetry(provider, measured));
    console.warn("AI event stream provider failed", { provider: provider.label, reason: measured.reason });
    if (providerSentBody) break;
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
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
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
  return {
    model: provider.model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(state) },
    ],
    max_tokens: getOpenRouterMaxTokens(),
    temperature: 0.85,
  };
}

function buildAiEventStreamRequestBody(state: AiEventPromptState, provider: AiProvider) {
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
    max_tokens: getOpenRouterMaxTokens(),
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

export function parseAiEventContentDetailed(content: string): AiEventParseResult {
  let raw: unknown;
  try {
    raw = extractJson(content);
  } catch {
    return { success: false, reason: "malformed_json", issues: ["json"] };
  }
  const validated = aiEventSchema.safeParse(normalizeAiEvent(raw));
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
    console.warn("AI ending provider failed", { provider: provider.label, reason: result.reason });
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
            {
              role: "system",
              content: `You write final result records for a Korean literary career text-adventure. Return ONLY valid JSON.
The result must be Korean prose, second-person "당신은" voice, and longNarrative must be at least 500 Korean characters.
Treat the protagonist as a woman by default. Do not call the protagonist "오빠", "형", "군", or use male-coded address. Use "언니", "선배", "씨", or the protagonist's name if needed.
Use public stats, hidden state, every major event, and relationships. Include career life and what happened afterward.
The result must be layered, surprising, and novelistic: success can contain private loss, failure can contain quiet dignity, bad relationships can return as reversals. However, do not make every ordinary final result feel like a bad ending. If result mode is "final", write a mixed but livable life with costs, gains, and a future. Reserve collapse, ruin, and hopelessness for result mode "crisis".
Possible results are not limited to office jobs. They may include romance, marriage, living alone, overseas working holiday, police/public safety, private investigator, lawyer/accountant/professional, founder, self-employed owner, artist/marketer, civil servant, criminal downfall, whistleblower, quiet rural life, or a lonely but peaceful life.
Do not use the word "엔딩" in title, summary, tags, or longNarrative. Call it "선택의 결과", "기록", or describe the concrete life result.
Never expose raw stat numbers in prose. Do not write phrases like "학점 10", "건강 6", "네트워크 3", "mental 4", "reputation 2", or any stat label followed by a number. Translate stats into qualitative language such as "성실하게 쌓은 지식", "좁지만 남은 관계망", "무리를 견디기 어려운 몸", or "쉽게 흔들리는 마음".
Do not grant a licensed profession, specific company job, public safety role, or startup selection unless hiddenState.eventFlags.careerGate.status is "passed" for that path. If the gate is failed or absent, write about preparation, rejection, retrying, or a different unspecific path.
The longNarrative must be 700-1400 Korean characters when possible. It must cover:
1. What career/life path happened right after university.
2. A turning point caused by at least one past event or relationship.
3. How love, marriage, solitude, family, money, health, or reputation changed afterward.
4. A reversal or irony based on mismatched stats/relationships, such as high academic + bad relationship, high wealth + low mental, high charm + low reputation.
5. A final image, not a generic lesson.
Mention at least three concrete past event titles or relationship names from the supplied history when they matter. Avoid generic summaries that could fit any playthrough.
Do not write route grades such as A/B/C, GOOD ROUTE, MIXED ROUTE, or HARD ROUTE.
Use fictional/parody company or institution names only. No real defamatory claims.
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
전체 사건 기록: ${JSON.stringify(state.eventHistory)}
마지막 선택: ${state.finalChoiceSummary}
${state.relationshipLife ? `관계 생활 상태: ${state.relationshipLife.relationshipLife}${state.relationshipLife.parenting.hasChildren ? `, 자녀: ${state.relationshipLife.parenting.childCount}명 (${state.relationshipLife.parenting.parentingStage})` : ""}` : ""}

JSON fields: title, summary, longNarrative, careerPath, jobRole, destinationName, salaryBand, workplaceTone, satisfaction, growthPotential, workLifeBalance, healthState, relationshipState, tags.`,
            },
          ],
          response_format: { type: "json_object" },
          max_tokens: 4000,
          temperature: 0.9,
        }),
      signal: controller.signal,
    });

    if (response.status === 429) return { success: false, reason: "rate_limited" };
    if (!response.ok) return { success: false, reason: "api_error" };

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return { success: false, reason: "invalid_response" };

    const parsed = extractJson(content);
    const validated = aiEndingSchema.safeParse(normalizeAiEnding(parsed, state));
    if (!validated.success) return { success: false, reason: "invalid_response" };

    return { success: true, ending: validated.data, providerId: provider.id, providerLabel: provider.label };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { success: false, reason: "timeout" };
    }
    return { success: false, reason: "api_error" };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeAiEnding(raw: unknown, state: { name: string; major: string; stats: Record<string, number>; finalChoiceSummary: string }) {
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
    jobRole: typeof ending.jobRole === "string" ? sanitizeEndingStatNumbers(ending.jobRole) : null,
    destinationName: typeof ending.destinationName === "string" ? sanitizeEndingStatNumbers(ending.destinationName) : null,
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
    .replace(/\s{2,}/g, " ")
    .trim();
}

function clampScore(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(numeric) ? numeric : fallback)));
}

function pickFallbackCareerPath(stats: Record<string, number>) {
  if (stats.academic >= 8 && stats.reputation < 4) return "전문직을 준비했으나 관계의 역풍을 맞은 삶";
  if (stats.practical >= 7 && stats.wealth >= 6) return "창업과 자영업 사이의 독립";
  if (stats.reputation >= 7 && stats.charm >= 6) return "기업 조직의 핵심 실무자";
  if (stats.academic >= 7) return "공공기관 또는 자격시험의 긴 길";
  return "불확실한 취업 준비 이후의 조용한 생존";
}

function buildFallbackLongEnding(input: {
  name: string;
  major: string;
  careerPath: string;
  stats: Record<string, number>;
  finalChoiceSummary: string;
  relationshipState: string;
}) {
  const strength = input.stats.academic >= input.stats.practical ? "공부로 버티는 법" : "현장에서 배우는 법";
  const weakness = input.stats.health < 5 ? "몸을 너무 늦게 돌본 대가" :
    input.stats.mental < 5 ? "마음을 오래 방치한 대가" :
    input.stats.reputation < 5 ? "사람들 사이에 남은 오해" :
    "끝내 놓지 못한 미련";
  return `당신은 ${input.major}의 강의실에서 시작한 여러 사건 끝에 ${input.careerPath}라는 이름의 문 앞에 섰다. 마지막에 남은 선택은 단순한 합격이나 취업이 아니라, 그동안 쌓인 모든 태도의 계산서에 가까웠다. ${input.finalChoiceSummary} 그 문장은 이력서에는 쓰이지 않았지만, 훗날 당신이 중요한 결정을 앞두고 잠시 말을 멈추게 만드는 기억이 되었다. 당신은 ${strength}을 알고 있었고, 그래서 남들보다 늦게 무너질 수 있었다. 하지만 ${weakness}는 예상하지 못한 순간에 되돌아왔다. 한때 좋았던 관계는 추천서가 되기도 했고, 틀어진 관계는 가장 중요한 면접장이나 협상 자리에서 차가운 표정으로 다시 나타나기도 했다. 그래서 당신의 커리어는 곧장 상승하는 선이 아니라, 몇 번의 후퇴와 우회로 이루어진 긴 문장에 가까웠다. 시간이 지나 당신은 처음 꿈꾸던 모습과는 조금 다른 사람이 되었다. 돈을 더 벌 때도 있었고, 조용히 물러서야 할 때도 있었으며, 누군가에게는 성공한 사람으로, 누군가에게는 조금 차가워진 사람으로 기억되었다. 그래도 당신은 완전히 실패하지 않았다. ${input.relationshipState}이라는 결론 속에서, 당신은 자신이 무엇을 얻었고 무엇을 잃었는지 알고 살아가는 사람이 되었다.`;
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
  const deltaContent = readRecord(choice?.delta)?.content;
  if (typeof deltaContent === "string") return deltaContent;
  const messageContent = readRecord(choice?.message)?.content;
  return typeof messageContent === "string" ? messageContent : null;
}

function normalizeAiEvent(raw: unknown) {
  if (typeof raw !== "object" || raw === null) return raw;
  const container = raw as Record<string, unknown>;
  const event = readRecord(container.event) ?? readRecord(container.storyEvent) ?? container;
  const rawChoices = Array.isArray(event.choices) ? event.choices :
    Array.isArray(event.options) ? event.options :
    Array.isArray(event.actions) ? event.actions :
    [];
  return {
    title: event.title,
    body: typeof event.body === "string" ? event.body :
      typeof event.description === "string" ? event.description :
      event.narrative,
    tags: event.tags,
    choices: rawChoices.map((choice) => normalizeChoice(choice)),
  };
}

function normalizeChoice(raw: unknown) {
  const choice = readRecord(raw);
  if (!choice) return raw;
  const rawDelta = readRecord(choice.statDelta) ?? readRecord(choice.statChanges) ?? readRecord(choice.effects);
  const statDelta = rawDelta ? Object.fromEntries(
    Object.entries(rawDelta).map(([key, value]) => {
      if (allowedStats.includes(key as typeof allowedStats[number]) && typeof value === "string") {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) return [key, Math.round(numeric)];
      }
      return [key, value];
    }),
  ) : choice.statDelta;
  const summarySource = typeof choice.summary === "string" ? choice.summary :
    choice.nextEvent;
  const summary = typeof summarySource === "string" && !summarySource.startsWith("당신은")
    ? `당신은 ${summarySource}`
    : summarySource;

  return {
    id: choice.id,
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
      const trust = Number(rel.trust ?? rel.delta ?? rel.change);
      if (!Number.isFinite(trust)) return null;
      return {
        name: rel.name,
        trust: Math.max(-30, Math.min(30, Math.round(trust))),
      };
    })
    .filter((item): item is { name: string; trust: number } => Boolean(item));
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
