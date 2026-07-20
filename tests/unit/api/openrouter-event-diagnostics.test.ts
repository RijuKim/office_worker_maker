import { afterEach, describe, expect, it, vi } from "vitest";

import {
  generateAiEvent,
  getOpenRouterTimeoutMs,
  parseAiEventContentDetailed,
} from "@/lib/game/openrouter";

const body = "당신은 늦은 오후 도서관 창가에서 오래 미뤄 둔 지원서를 펼쳤다. 빗소리가 유리창을 두드리고, 낯선 제안이 도착한다. 선택에는 분명한 비용과 다음 장면으로 이어질 약속이 함께 놓여 있다.";
const validEvent = {
  title: "비 오는 날의 제안",
  body,
  tags: ["진로"],
  choices: [
    { id: "a", label: "제안을 검토한다", summary: "당신은 제안을 검토했다.", statDelta: { mental: -1 } },
    { id: "b", label: "다른 길을 찾는다", summary: "당신은 다른 길을 찾았다.", statDelta: { wealth: -1 } },
  ],
};

describe("AI event diagnostics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.OPENROUTER_API_KEY;
  });

  it.each([
    [undefined, 30_000],
    ["abc", 30_000],
    ["4999", 30_000],
    ["120001", 30_000],
    ["45000", 45_000],
    ["5000", 5_000],
    ["120000", 120_000],
  ])("parses timeout %s as %i ms", (raw, expected) => {
    expect(getOpenRouterTimeoutMs(raw)).toBe(expected);
  });

  it("classifies malformed JSON separately", () => {
    expect(parseAiEventContentDetailed("{broken")).toEqual({
      success: false,
      reason: "malformed_json",
      issues: ["json"],
    });
  });

  it.each([
    [{ ...validEvent, body: "짧다" }, "narrative_schema"],
    [{ ...validEvent, choices: [validEvent.choices[0]] }, "choice_count"],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], label: "x".repeat(201) }, validEvent.choices[1]] }, "choice_field"],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], statDelta: { mental: -16 } }, validEvent.choices[1]] }, "choice_stat_range"],
  ])("returns the diagnostic reason %s", (candidate, reason) => {
    expect(parseAiEventContentDetailed(JSON.stringify(candidate))).toMatchObject({ success: false, reason });
  });

  it("accepts a slow successful provider response without fallback or a second call", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(12_001)
      .mockReturnValue(12_001);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(validEvent) } }],
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const result = await generateAiEvent({
      name: "서윤", major: "문학", gradeYear: 2, age: 21, coreEventCount: 4,
      recentSummaries: [], usedEventTitles: [], stats: {}, relationships: [], storyArc: {},
    }, { skipPrimary: true });

    expect(result).toMatchObject({ success: true, slow: true, totalElapsedMs: 12_001 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
