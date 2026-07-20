import { z } from "zod";

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

const DEFAULT_AI_TIMEOUT_MS = 30_000;
const MIN_AI_TIMEOUT_MS = 5_000;
const MAX_AI_TIMEOUT_MS = 120_000;
export const SLOW_AI_GENERATION_MS = 10_000;

export function getOpenRouterTimeoutMs(raw = process.env.OPENROUTER_TIMEOUT_MS): number {
  if (raw === undefined || !/^\d+$/.test(raw.trim())) return DEFAULT_AI_TIMEOUT_MS;
  const parsed = Number(raw);
  return parsed >= MIN_AI_TIMEOUT_MS && parsed <= MAX_AI_TIMEOUT_MS
    ? parsed
    : DEFAULT_AI_TIMEOUT_MS;
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

const SYSTEM_PROMPT = `You are a creative writer for a Korean college life text-adventure game.

Generate ONE narrative event in JSON format. Use these exact field names: "title", "body", "choices", "tags". Each choice must have: "id", "label", "summary", "statDelta", "relationshipDelta". The event should:
- Be in Korean
- Use "당신은" as the primary second-person narration voice. Do not use "너" or detached third-person narration.
- Treat the protagonist as a woman by default unless the prompt explicitly says otherwise.
- Do not have anyone call the protagonist "오빠", "형", "00군", or other male-coded terms. Use "언니", "선배", "씨", or the protagonist's name when a direct address is necessary.
- Make body 2-4 paragraphs, 8-14 sentences total, with literary text-adventure pacing and sensory detail.
- The event must be one small incident inside the provided larger story arc.
- Follow the current story phase: 발단, 전개, 위기, 절정, 결말의 흐름. Do not resolve the whole life too early.
- Keep continuity with recent choices, relationships, open threads, foreshadowing, and stats.
- Be a slice-of-life college scenario that can organically lead to career/life outcomes: study, relationships, romance, family, revenge, betrayal, part-time jobs, clubs, career exploration, leave of absence, internship, exam prep, public sector, police track, professional licenses, entrepreneurship, self-employment, overseas working holiday, detective-like investigation, crime temptation, marriage, solitude, or recovery.
- Also use non-school life as serious event material: gym, running crews, climbing, swimming, dance, book clubs, exhibitions, concerts, movie clubs, game communities, tabletop games, cooking, travel, volunteering, neighborhood meetups, hobbies, and quiet leisure. These should affect health, mental state, network, money, romance, portfolio, or job opportunities.
- Pick a clear event category and emotional valence internally: academic / romance / family / money / career / revenge / mystery / crime / health / friendship / overseas, and positive / negative / mixed. Reflect it in tags.
- At least one element must come from previous choices, existing relationships, or open threads. Never feel like an isolated random encounter.
- If the player already accepted, declined, ignored, deferred, joined, skipped, refused, or withdrew from a proposal, do not ask the same proposal again. Write consequences, aftermath, or a new different problem instead.
- Respect cooldown guidance. Avoid overusing the same event category or the same supporting characters unless the prompt explicitly says they are required for a gate or closure.
- In the first 5 core events, do not default to recurring helpers such as Min-ha/Jimin-like friends or seniors. Prefer new contexts and one-off or new supporting people: classes, part-time work, family calls, gym, book clubs, exhibitions, game groups, language tests, overseas information sessions, professor office hours, commuting, residence, or neighborhood meetups.
- If a relationship appears, the scene must show why that person's trust changes. Do not adjust trust without a narrated interaction.
- Each event should leave a concrete seed for a possible future event: a promise, threat, debt, clue, invitation, rumor, missed call, application result, family pressure, or romantic ambiguity.
- Include 2-4 meaningful choices that affect character stats
- Choices may include relationshipDelta with name and trust from -30 to +30. Use it when a person clearly appears in the scene.
- Relationships can become romantic, friendly, hostile, or hateful depending on trust. Let some choices worsen relationships.
- Trust around 80+ suggests romance, below -80 suggests hatred. Do not create romance unless the scene has earned it.
- Use only these public stats in statDelta: academic, practical, health, mental, wealth, charm, reputation
- Each choice's statDelta must be within -15 to +15 range
- health is fragile on the 1-10 scale. Never decrease health by more than -1 in a single choice.
- Every choice must include at least one negative statDelta. Good opportunities still cost time, health, money, reputation, or mental energy.
- At least one choice should be clearly risky with a larger downside.
- No real company names, no real executives, no real controversies
- Use fictional/parody names only
- Choice labels should be natural actions, not system descriptions.
- Each summary must start with "당신은".
- Make every choice morally or emotionally distinct. Avoid generic "study/rest/talk" choices unless the context makes them specific.
- Return ONLY valid JSON, no markdown wrapping`;

export type AiEventPromptState = {
  name: string;
  major: string;
  gradeYear: number | null;
  age: number;
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
    toneGuidance = "이야기는 막 시작되었다. 가벼운 일상, 학교 탐색, 새로운 만남, 작은 고민 위주로 전개하라. 가족의 경제난, 범죄, 중대한 갈등은 아직 등장하지 않는다. 첫인상과 작은 선택의 의미를 느끼게 하는 장면이어야 한다.";
  } else if (progressRatio < 0.35) {
    toneGuidance = "대학 생활에 조금 익숙해진 시기다. 가벼운 갈등이나 압박이 등장할 수 있지만, 여전히 일상과 탐색이 중심이다. 알바, 동아리, 시험, 인간관계의 미묘한 변화를 다룬다.";
  } else if (progressRatio < 0.55) {
    toneGuidance = "본격적인 갈등과 선택의 무게가 느껴지는 시기다. 돈, 진로, 관계, 가족 압박이 겹치기 시작한다. 위험한 제안이나 윤리적 딜레마가 등장할 수 있다.";
  } else if (progressRatio < 0.75) {
    toneGuidance = "이전 선택의 결과가 현실로 다가온다. 취업 준비, 시험, 관계의 결말, 재정 위기 등 구체적인 결과와 마주하는 시기다. 긴장감이 높아진다.";
  } else {
    toneGuidance = "마지막 관문을 앞둔 시점이다. 진로의 방향, 관계의 결말, 학사의 마무리가 결정된다. 모든 선택이 최종 결과로 수렴하는 느낌을 준다.";
  }

  return `주인공: ${state.name}, ${state.age}세, ${state.major}, ${state.gradeYear ?? "?"}학년
주인공 성별/호칭: 여성. 다른 인물이 주인공을 부를 때 "오빠", "형", "군"을 쓰지 말 것. 필요하면 "언니", "선배", "씨", 또는 이름을 쓸 것.
전공 처리: 전공은 시작 배경과 일부 자격/국가고시 루트의 조건일 뿐, 취업·창업·해외·예체능·일반기업·공공기관·전공무관 직무를 강제로 막지 않는다. 전공과 다른 길로 새는 선택도 자연스럽게 허용한다.
생활 단계: ${state.lifeStage ?? "unknown"}
졸업/학사 상태: ${state.graduation ?? "normal"}
현재 학기: ${semesterLabel} (전체 ${totalSemesters}개 학기 중 ${currentSemester}번째, ${state.coreEventCount}번째 사건)
진행된 핵심 사건 수: ${state.coreEventCount}
큰 사건 아크: ${JSON.stringify(state.storyArc)}
진행도 가이드: ${toneGuidance}
최근 선택과 기억: ${state.recentSummaries.join("; ") || "당신은 낯선 아침에 눈을 떴다."}
이미 사용한 사건 제목: ${state.usedEventTitles.join("; ") || "없음"}
이미 처리된 제안과 닫힌 갈림길: ${buildResolvedOfferPrompt(state.eventFlags)}
이번 사건에서 피해야 할 반복 범주: ${state.avoidCategories?.join(", ") || "없음"}
이번 사건에서 우선 고려할 덜 나온 범주: ${state.preferCategories?.join(", ") || "없음"}
이번 사건에서 가능하면 쉬게 할 인물: ${state.avoidPeople?.join(", ") || "없음"}
현재 공개 스탯: ${JSON.stringify(state.stats)}
주요 관계: ${JSON.stringify(state.relationships)}
학업 계획: ${JSON.stringify(state.academicPlan ?? null)}
목적지 후보: ${JSON.stringify(state.destinationCandidates ?? [])}
현재 스펙: ${JSON.stringify(state.specs ?? [])}
진행 중인 지원 전형: ${JSON.stringify((state.jobApplications ?? []).filter((app) => app.isActive))}
진로/시험 트랙: ${JSON.stringify(state.careerPaths ?? [])}
취준 다양성 지침: ${buildCareerDiversityPrompt(state)}

위 정보를 바탕으로 다음 작은 사건 하나를 생성하세요. 이미 사용한 사건 제목과 같은 상황, 같은 장소, 같은 갈등을 반복하지 마세요. 이미 수락하거나 거절한 제안을 다시 묻지 말고, 그 선택의 결과나 새로운 문제로 이어가세요. 최근에 같은 범주나 같은 인물이 반복되었다면 이번에는 다른 생활권, 다른 갈등, 다른 인물을 우선하세요. 이번 사건은 이전 선택의 결과가 느껴져야 하며, 동시에 다음 장면을 궁금하게 만드는 미해결 감각을 남겨야 합니다.`;
}

function buildCareerDiversityPrompt(state: AiEventPromptState) {
  const activeSpecs = (state.specs ?? []).filter((spec) => spec.status === "IN_PROGRESS");
  const activeApps = (state.jobApplications ?? []).filter((app) => app.isActive);
  const activePaths = (state.careerPaths ?? []).filter((path) => path.status !== "COMPLETED" && path.status !== "FAILED");
  const guidance: string[] = [];

  if (activeSpecs.length > 0) {
    guidance.push(`진행 중인 스펙(${activeSpecs.map((spec) => `${spec.specType}:${spec.specName}`).join(", ")})의 중간 과정, 시험일, 결과 대기, 비용, 팀 갈등, 번아웃을 사건화할 것`);
  }
  if (activeApps.length > 0) {
    guidance.push(`지원 중인 회사(${activeApps.map((app) => `${app.companyName}/${app.companyType ?? "회사"}/${app.currentStage}`).join(", ")})의 현재 전형 단계를 구체적으로 다룰 것`);
  }
  if (activePaths.length > 0) {
    guidance.push(`진로 트랙(${activePaths.map((path) => `${path.pathType}:${path.pathName ?? ""}`).join(", ")})에 맞는 준비, 실패 가능성, 주변 압박을 사건화할 것`);
  }
  if (state.lifeStage === "college_mid" || state.lifeStage === "college_late") {
    guidance.push("스터디만 반복하지 말고 인턴 6개월, TOEIC/TOEFL/JLPT/HSK, 포트폴리오, 공모전, 현장실습, 교수 추천서, 복수전공, 추가학기, 워홀, 시험 준비 중 하나를 우선 고려할 것");
  }
  if (state.lifeStage === "college_late") {
    guidance.push("4학년 후반이면 서류, 인성검사, 코딩테스트, 1차/2차 면접, 최종 발표, 불합격 통보, 합격 후 조건 협상 같은 한국 취준 전형을 현실적으로 다룰 것");
  }
  if (state.lifeStage === "college_late" || state.graduation === "gate_ready") {
    guidance.push("졸업 직전 관문 사건은 반드시 최근 선택, 진행 중인 지원 전형, 스펙, 관계 중 최소 두 가지를 본문에 반영할 것. 일반적인 취준 템플릿처럼 쓰지 말고 이 캐릭터가 실제로 지나온 행보의 결과처럼 보여야 한다");
    guidance.push("최종 관문 선택지는 합격/불합격을 직접 고르는 버튼이 아니라, 무엇을 앞세울지, 누구에게 도움을 청할지, 어떤 리스크를 감수할지처럼 행동 전략으로 구성할 것");
  }
  if (state.major.includes("교육")) {
    guidance.push("교육 계열이면 임용고시가 선택지로 가능하지만, 다른 전공에는 임용을 억지로 넣지 말 것");
  }
  guidance.push("사건마다 장소, 이해관계자, 압박의 종류를 바꿀 것. 같은 선배/친구/스터디룸으로만 이어가지 말 것");
  guidance.push("취준/학업 사건이 최근 반복되었다면 운동, 외부 독서모임, 전시, 영화, 게임, 취미 클래스, 여행, 봉사, 동네 모임처럼 학교 밖 생활 사건을 우선 고려할 것");
  guidance.push("여가 사건도 단순 휴식으로 끝내지 말고 새 인맥, 예상치 못한 비용, 포트폴리오 소재, 건강 변화, 연애/우정의 갈림길, 취업 정보 같은 후속 씨앗을 남길 것");

  return guidance.join(" / ");
}

function buildResolvedOfferPrompt(flags: Record<string, unknown> | undefined) {
  if (!flags) return "없음";
  const resolved: string[] = [];
  if (flags.contestJoined !== undefined) resolved.push("공모전 팀 제안 수락됨");
  if (flags.contestSkipped !== undefined) resolved.push("공모전 팀 제안 거절됨");
  if (flags.studentCouncil !== undefined) resolved.push(`학생회 제안 처리됨(${String(flags.studentCouncil)})`);
  if (flags.startupThread !== undefined) resolved.push(`앱/창업 아이디어 선택됨(${String(flags.startupThread)})`);
  if (flags.publicSectorThread !== undefined) resolved.push(`공공/공기업 스터디 제안 처리됨(${String(flags.publicSectorThread)})`);
  if (flags.overseasThread !== undefined) resolved.push(`해외/워홀 갈림길 처리됨(${String(flags.overseasThread)})`);
  if (flags.crimeThread !== undefined) resolved.push(`회색지대 돈 제안 처리됨(${String(flags.crimeThread)})`);
  if (flags.pyramidRefused !== undefined || flags.pyramidHeard !== undefined) resolved.push("다단계 제안 처리됨");
  if (flags.underworldRefused !== undefined || flags.underworldEntered !== undefined) resolved.push("밤거리 위험 제안 처리됨");
  if (flags.gamblingRefused !== undefined || flags.gamblingTried !== undefined) resolved.push("도박 제안 처리됨");
  if (flags.usbInvestigation !== undefined) resolved.push(`USB 사건 처리됨(${String(flags.usbInvestigation)})`);
  if (flags.eunjiInterview !== undefined) resolved.push(`은지 면접 부탁 처리됨(${String(flags.eunjiInterview)})`);
  if (flags.studyShare !== undefined) resolved.push(`취업 스터디 경쟁자 제안 처리됨(${String(flags.studyShare)})`);
  if (flags.personalTraining !== undefined) resolved.push(`개인 운동 제안 처리됨(${String(flags.personalTraining)})`);
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
  if (!provider.key) return { success: false, reason: "no_key", providerId: provider.id, providerLabel: provider.label, providerElapsedMs: 0 };

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
      return failure("rate_limited");
    }

    if (!response.ok) {
      console.warn("AI event provider returned non-ok response", {
        provider: provider.label,
        status: response.status,
      });
      return failure("api_error");
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return failure("empty_content");
    }

    const parsed = parseAiEventContentDetailed(content);
    if (!parsed.success) {
      return failure(parsed.reason, parsed.issues);
    }

    return { success: true, event: parsed.event, providerId: provider.id, providerLabel: provider.label, providerElapsedMs: Date.now() - startedAt, totalElapsedMs: 0, slow: false, retryUsed: false, providerFailures: [] };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return failure("timeout");
    }
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
  if (!provider.key) return { success: false, reason: "no_key", providerId: provider.id, providerLabel: provider.label, providerElapsedMs: 0 };

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

    if (response.status === 429) return failure("rate_limited");
    if (!response.ok || !response.body) {
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
    if (!parsed.success) return failure(parsed.reason, parsed.issues);
    return { success: true, event: parsed.event, providerId: provider.id, providerLabel: provider.label, providerElapsedMs: Date.now() - startedAt, totalElapsedMs: 0, slow: false, retryUsed: false, providerFailures: [] };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return failure("timeout");
    }
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
    response_format: { type: "json_object" },
    max_tokens: 2600,
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
    max_tokens: 2600,
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
    const match = content.match(/\{[\s\S]*\}/);
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
