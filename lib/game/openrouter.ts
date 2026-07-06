import { z } from "zod";

const apiKey = () => process.env.OPENROUTER_API_KEY ?? null;
const model = () => process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";

const AI_TIMEOUT_MS = 10_000;

const aiEventSchema = z.object({
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(2000),
  choices: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1).max(200),
        summary: z.string().min(1).max(300),
        statDelta: z.object({
          academic: z.number().int().min(-15).max(15).optional(),
          practical: z.number().int().min(-15).max(15).optional(),
          communication: z.number().int().min(-15).max(15).optional(),
          creativity: z.number().int().min(-15).max(15).optional(),
          health: z.number().int().min(-15).max(15).optional(),
          mental: z.number().int().min(-15).max(15).optional(),
          network: z.number().int().min(-15).max(15).optional(),
          wealth: z.number().int().min(-15).max(15).optional(),
          reputation: z.number().int().min(-15).max(15).optional(),
          charm: z.number().int().min(-15).max(15).optional(),
        }),
      }),
    )
    .min(2)
    .max(4),
  tags: z.array(z.string()).min(1).max(5),
});

export type AiEventResponse = z.infer<typeof aiEventSchema>;

const SYSTEM_PROMPT = `You are a creative writer for a Korean college life text-adventure game.

Generate ONE narrative event in JSON format. The event should:
- Be in Korean
- Be a slice-of-life college scenario (study, relationships, part-time jobs, clubs, career exploration)
- Include 2-4 meaningful choices that affect character stats
- Each choice's statDelta must be within -15 to +15 range
- No real company names, no real executives, no real controversies
- Use fictional/parody names only
- Return ONLY valid JSON, no markdown wrapping`;

export function buildUserPrompt(state: {
  name: string;
  major: string;
  gradeYear: number | null;
  recentSummaries: string[];
  stats: Record<string, number>;
}): string {
  return `Character: ${state.name}, ${state.major}, ${state.gradeYear ?? "?"}학년
Recent events: ${state.recentSummaries.join("; ") || "새로운 시작"}
Current stats: ${JSON.stringify(state.stats)}

Generate a new event with choices. Respond in Korean. Use fictional names only.`;
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
          max_tokens: 1024,
          temperature: 0.9,
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

    const parsed = JSON.parse(content);
    const validated = aiEventSchema.safeParse(parsed);

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