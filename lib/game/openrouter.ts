import { z } from "zod";

const apiKey = () => process.env.OPENROUTER_API_KEY ?? null;
const model = () => process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";

const AI_TIMEOUT_MS = 10_000;

const aiEventSchema = z.object({
  title: z.string().min(1).max(100),
  body: z.string().min(80).max(4200),
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

const allowedStats = ["academic", "practical", "health", "mental", "wealth", "reputation", "charm"] as const;

const SYSTEM_PROMPT = `You are a creative writer for a Korean college life text-adventure game.

Generate ONE narrative event in JSON format. The event should:
- Be in Korean
- Use "당신은" as the primary second-person narration voice. Do not use "너" or detached third-person narration.
- Make body 2-4 paragraphs, 8-12 sentences total, with literary text-adventure pacing.
- The event must be one small incident inside the provided larger story arc.
- Follow the current story phase: 발단, 전개, 위기, 절정, 결말의 흐름. Do not resolve the whole life too early.
- Keep continuity with recent choices, relationships, open threads, foreshadowing, and stats.
- Be a slice-of-life college scenario that can organically lead to career outcomes: study, relationships, part-time jobs, clubs, career exploration, leave of absence, internship, exam prep, public sector, professional licenses, entrepreneurship, or self-employment.
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
          max_tokens: 2200,
          temperature: 0.85,
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
