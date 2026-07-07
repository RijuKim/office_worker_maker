import { z } from "zod";

const apiKey = () => process.env.OPENROUTER_API_KEY ?? null;
const model = () => process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-v4-flash:cloud";

const AI_TIMEOUT_MS = 25_000;

const aiEventSchema = z.object({
  title: z.string().min(1).max(100),
  body: z.string().min(450).max(5200),
  choices: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1).max(200),
        summary: z.string().min(1).max(360),
        statDelta: z.object({
          academic: z.number().int().min(-15).max(15).optional(),
          practical: z.number().int().min(-15).max(15).optional(),
          health: z.number().int().min(-15).max(15).optional(),
          mental: z.number().int().min(-15).max(15).optional(),
          wealth: z.number().int().min(-15).max(15).optional(),
          reputation: z.number().int().min(-15).max(15).optional(),
          charm: z.number().int().min(-15).max(15).optional(),
        }),
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

Generate ONE narrative event in JSON format. The event should:
- Be in Korean
- Use "당신은" as the primary second-person narration voice. Do not use "너" or detached third-person narration.
- Make body 2-4 paragraphs, 8-14 sentences total, with literary text-adventure pacing and sensory detail.
- The event must be one small incident inside the provided larger story arc.
- Follow the current story phase: 발단, 전개, 위기, 절정, 결말의 흐름. Do not resolve the whole life too early.
- Keep continuity with recent choices, relationships, open threads, foreshadowing, and stats.
- Be a slice-of-life college scenario that can organically lead to career/life outcomes: study, relationships, romance, family, revenge, betrayal, part-time jobs, clubs, career exploration, leave of absence, internship, exam prep, public sector, police track, professional licenses, entrepreneurship, self-employment, overseas working holiday, detective-like investigation, crime temptation, marriage, solitude, or recovery.
- Pick a clear event category and emotional valence internally: academic / romance / family / money / career / revenge / mystery / crime / health / friendship / overseas, and positive / negative / mixed. Reflect it in tags.
- At least one element must come from previous choices, existing relationships, or open threads. Never feel like an isolated random encounter.
- If a relationship appears, the scene must show why that person's trust changes. Do not adjust trust without a narrated interaction.
- Each event should leave a concrete seed for a possible future event: a promise, threat, debt, clue, invitation, rumor, missed call, application result, family pressure, or romantic ambiguity.
- Include 2-4 meaningful choices that affect character stats
- Choices may include relationshipDelta with name and trust from -30 to +30. Use it when a person clearly appears in the scene.
- Relationships can become romantic, friendly, hostile, or hateful depending on trust. Let some choices worsen relationships.
- Trust around 80+ suggests romance, below -80 suggests hatred. Do not create romance unless the scene has earned it.
- Use only these public stats in statDelta: academic, practical, health, mental, wealth, charm, reputation
- Each choice's statDelta must be within -15 to +15 range
- Every choice must include at least one negative statDelta. Good opportunities still cost time, health, money, reputation, or mental energy.
- At least one choice should be clearly risky with a larger downside.
- No real company names, no real executives, no real controversies
- Use fictional/parody names only
- Choice labels should be natural actions, not system descriptions.
- Each summary must start with "당신은".
- Make every choice morally or emotionally distinct. Avoid generic "study/rest/talk" choices unless the context makes them specific.
- Return ONLY valid JSON, no markdown wrapping`;

export function buildUserPrompt(state: {
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
}): string {
  return `주인공: ${state.name}, ${state.age}세, ${state.major}, ${state.gradeYear ?? "?"}학년
진행된 핵심 사건 수: ${state.coreEventCount}
큰 사건 아크: ${JSON.stringify(state.storyArc)}
최근 선택과 기억: ${state.recentSummaries.join("; ") || "당신은 낯선 아침에 눈을 떴다."}
이미 사용한 사건 제목: ${state.usedEventTitles.join("; ") || "없음"}
현재 공개 스탯: ${JSON.stringify(state.stats)}
주요 관계: ${JSON.stringify(state.relationships)}

위 정보를 바탕으로 다음 작은 사건 하나를 생성하세요. 이미 사용한 사건 제목과 같은 상황, 같은 장소, 같은 갈등을 반복하지 마세요. 이번 사건은 이전 선택의 결과가 느껴져야 하며, 동시에 다음 장면을 궁금하게 만드는 미해결 감각을 남겨야 합니다.`;
}

export interface OpenRouterResult {
  success: true;
  event: AiEventResponse;
}

export interface OpenRouterFailure {
  success: false;
  reason: "no_key" | "timeout" | "rate_limited" | "invalid_response" | "api_error";
}

export interface OpenRouterEndingResult {
  success: true;
  ending: AiEndingResponse;
}

export async function generateAiEvent(
  state: Parameters<typeof buildUserPrompt>[0],
): Promise<OpenRouterResult | OpenRouterFailure> {
  const key = apiKey();
  if (!key) {
    return { success: false, reason: "no_key" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://college-career-sim.local",
          "X-Title": "College Career Sim",
        },
        body: JSON.stringify({
          model: model(),
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildUserPrompt(state) },
          ],
          response_format: { type: "json_object" },
          max_tokens: 4000,
          temperature: 0.85,
          reasoning: { effort: "none" },
        }),
        signal: controller.signal,
      },
    );

    if (response.status === 429) {
      return { success: false, reason: "rate_limited" };
    }

    if (!response.ok) {
      return { success: false, reason: "api_error" };
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return { success: false, reason: "invalid_response" };
    }

    const parsed = extractJson(content);
    const validated = aiEventSchema.safeParse(normalizeAiEvent(parsed));

    if (!validated.success) {
      return { success: false, reason: "invalid_response" };
    }

    return { success: true, event: validated.data };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { success: false, reason: "timeout" };
    }
    return { success: false, reason: "api_error" };
  } finally {
    clearTimeout(timeout);
  }
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
  relationshipLife?: { relationshipLife: string; parenting: { hasChildren: boolean; childCount: number; parentingStage: string } };
}): Promise<OpenRouterEndingResult | OpenRouterFailure> {
  const key = apiKey();
  if (!key) return { success: false, reason: "no_key" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://office-worker-maker.local",
        "X-Title": "일어나보니 대한민국 취준생",
      },
        body: JSON.stringify({
          model: model(),
          messages: [
            {
              role: "system",
              content: `You write final result records for a Korean literary career text-adventure. Return ONLY valid JSON.
The result must be Korean prose, second-person "당신은" voice, and longNarrative must be at least 500 Korean characters.
Use public stats, hidden state, every major event, and relationships. Include career life and what happened afterward.
The result must be layered, surprising, and novelistic: success can contain private loss, failure can contain quiet dignity, bad relationships can return as reversals.
Possible results are not limited to office jobs. They may include romance, marriage, living alone, overseas working holiday, police/public safety, private investigator, lawyer/accountant/professional, founder, self-employed owner, artist/marketer, civil servant, criminal downfall, whistleblower, quiet rural life, or a lonely but peaceful life.
Do not use the word "엔딩" in title, summary, tags, or longNarrative. Call it "선택의 결과", "기록", or describe the concrete life result.
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
공개 스탯: ${JSON.stringify(state.stats)}
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
          reasoning: { effort: "none" },
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

    return { success: true, ending: validated.data };
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
    title: typeof ending.title === "string" ? ending.title : `${state.name}의 ${careerPath}`,
    summary: typeof ending.summary === "string" ? ending.summary : `${state.name}은 대학의 선택들을 지나 ${careerPath}에 닿았다.`,
    longNarrative: longNarrative.length >= 500 ? longNarrative : `${longNarrative}\n\n${buildFallbackLongEnding({
      name: state.name,
      major: state.major,
      careerPath,
      stats: state.stats,
      finalChoiceSummary: state.finalChoiceSummary,
      relationshipState: typeof ending.relationshipState === "string" ? ending.relationshipState : "관계의 빛과 그림자가 함께 남음",
    })}`,
    careerPath,
    jobRole: typeof ending.jobRole === "string" ? ending.jobRole : null,
    destinationName: typeof ending.destinationName === "string" ? ending.destinationName : null,
    salaryBand: typeof ending.salaryBand === "string" ? ending.salaryBand : null,
    workplaceTone: Array.isArray(ending.workplaceTone) ? ending.workplaceTone.filter((item) => typeof item === "string") : [],
    satisfaction: clampScore(ending.satisfaction, Math.round((state.stats.health + state.stats.mental + state.stats.reputation) / 3)),
    growthPotential: clampScore(ending.growthPotential, Math.round((state.stats.academic + state.stats.practical + state.stats.charm) / 3)),
    workLifeBalance: clampScore(ending.workLifeBalance, Math.round((state.stats.health + state.stats.mental) / 2)),
    healthState: typeof ending.healthState === "string" ? ending.healthState : state.stats.health >= 60 ? "버틸 만함" : "쉽게 지침",
    relationshipState: typeof ending.relationshipState === "string" ? ending.relationshipState : "관계의 빛과 그림자가 함께 남음",
    tags: Array.isArray(ending.tags) && ending.tags.length > 0 ? ending.tags.filter((tag) => typeof tag === "string").slice(0, 10) : ["선택의 결과", careerPath],
  };
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

function normalizeAiEvent(raw: unknown) {
  if (typeof raw !== "object" || raw === null) return raw;
  const container = raw as Record<string, unknown>;
  const event = readRecord(container.event) ?? readRecord(container.storyEvent) ?? container;
  const rawChoices = Array.isArray(event.choices) ? event.choices :
    Array.isArray(event.options) ? event.options :
    Array.isArray(event.actions) ? event.actions :
    [];
  const tags = Array.isArray(event.tags)
    ? event.tags.filter((tag) => typeof tag === "string").slice(0, 5)
    : [];

  return {
    title: typeof event.title === "string" ? event.title : "이름 없는 하루",
    body: typeof event.body === "string" ? event.body :
      typeof event.description === "string" ? event.description :
      typeof event.narrative === "string" ? event.narrative :
      "",
    tags: tags.length > 0 ? tags : ["AI"],
    choices: rawChoices.map((choice, index) => normalizeChoice(choice, index)),
  };
}

function normalizeChoice(raw: unknown, index: number) {
  const choice = typeof raw === "object" && raw !== null ? raw as Record<string, unknown> : {};
  const rawDelta = readRecord(choice.statDelta) ?? readRecord(choice.statChanges) ?? {};
  const statDelta = Object.fromEntries(
    Object.entries(rawDelta)
      .map(([key, value]) => [key, Number(value)] as const)
      .filter(([key, value]) => allowedStats.includes(key as typeof allowedStats[number]) && Number.isFinite(value))
      .map(([key, value]) => [key, Math.max(-15, Math.min(15, Math.round(value)))]),
  );
  const adjustedStatDelta = ensureChoiceCost(statDelta, index);
  const summarySource = typeof choice.summary === "string" ? choice.summary :
    typeof choice.nextEvent === "string" ? choice.nextEvent :
    "선택의 결과가 다음 장면으로 이어졌다.";
  const summary = summarySource.startsWith("당신은") ? summarySource : `당신은 ${summarySource}`;

  return {
    id: typeof choice.id === "string" ? choice.id : `choice_${index + 1}`,
    label: typeof choice.label === "string" ? choice.label :
      typeof choice.text === "string" ? choice.text :
      `${index + 1}번째 선택을 한다.`,
    summary,
    statDelta: adjustedStatDelta,
    relationshipDelta: normalizeRelationshipDelta(choice.relationshipDelta ?? choice.relationshipChanges),
  };
}

function ensureChoiceCost(statDelta: Record<string, number>, index: number) {
  if (Object.values(statDelta).some((value) => value < 0)) {
    return statDelta;
  }
  const costByIndex = ["mental", "health", "wealth", "reputation"] as const;
  const key = costByIndex[index % costByIndex.length];
  return {
    ...statDelta,
    [key]: Math.min(-1, statDelta[key] ?? (index === 0 ? -2 : -3)),
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
  const key = apiKey();
  if (!key) return { success: false, reason: "no_key" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://college-career-sim.local",
        "X-Title": "College Career Sim",
      },
        body: JSON.stringify({
          model: model(),
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
          reasoning: { effort: "none" },
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
  limit: number;
}> {
  const { prisma } = await import("@/lib/server/prisma");

  const today = new Date().toISOString().slice(0, 10);
  const limit = 30;

  const usage = await prisma.aiUsage.findUnique({
    where: { userId_date: { userId, date: today } },
  });

  const count = usage?.count ?? 0;

  return { allowed: count < limit, count, limit };
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
