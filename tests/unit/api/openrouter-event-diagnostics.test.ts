import { afterEach, describe, expect, it, vi } from "vitest";

import {
  generateAiEnding,
  generateAiEvent,
  generateAiEventStream,
  getAiEndingTimeoutMs,
  getOllamaEventMaxTokens,
  getOpenRouterMaxTokens,
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
    delete process.env.OLLAMA_API_KEY;
    delete process.env.OPENROUTER_TIMEOUT_MS;
    delete process.env.OLLAMA_EVENT_MAX_TOKENS;
    delete process.env.AI_ENDING_TIMEOUT_MS;
    delete process.env.AI_PRIMARY_PROVIDER;
    vi.useRealTimers();
  });

  it.each([
    [undefined, 60_000],
    ["abc", 60_000],
    ["4999", 60_000],
    ["120001", 60_000],
    ["60000", 60_000],
    [" 60000 ", 60_000],
    ["5000", 5_000],
    ["120000", 120_000],
  ])("uses a 60000 ms default while preserving configured timeout bounds (%s -> %i ms)", (raw, expected) => {
    expect(getOpenRouterTimeoutMs(raw)).toBe(expected);
  });

  it.each([
    [undefined, 1_400],
    ["abc", 1_400],
    ["399", 1_400],
    ["400", 400],
    ["1800", 1_800],
    ["4000", 4_000],
    ["4001", 1_400],
  ])("parses max tokens %s as %i", (raw, expected) => {
    expect(getOpenRouterMaxTokens(raw)).toBe(expected);
  });

  it.each([
    [undefined, 1_600],
    ["abc", 1_600],
    ["399", 1_600],
    ["1600", 1_600],
    ["2600", 2_600],
    ["4000", 4_000],
    ["4001", 1_600],
  ])("parses Ollama event token budget %s as %i", (raw, expected) => {
    expect(getOllamaEventMaxTokens(raw)).toBe(expected);
  });

  it.each([
    [undefined, 120_000],
    ["invalid", 120_000],
    ["29999", 120_000],
    ["30000", 30_000],
    ["120000", 120_000],
    ["240000", 240_000],
    ["240001", 120_000],
  ])("parses ending timeout %s as %i", (raw, expected) => {
    expect(getAiEndingTimeoutMs(raw)).toBe(expected);
  });

  it("gives Ollama enough output budget and preserves every event in the ending prompt", async () => {
    process.env.AI_PRIMARY_PROVIDER = "ollama";
    process.env.OLLAMA_API_KEY = "test-key";
    const eventHistory = Array.from({ length: 24 }, (_, index) => ({
      title: `${index + 1}번째 선택`,
      summary: `당신은 ${index + 1}번째 갈림길에서 스스로 결정을 내렸다.`,
      statDelta: index === 0 ? { academic: 1 } : {},
      relationshipDelta: [],
      flagDelta: index === 23 ? { finalThread: "resolved" } : {},
    }));
    const validEnding = {
      title: "남겨 둔 불빛",
      summary: "당신은 여러 갈림길에서 내린 결정을 이어 자신만의 일을 만들었고, 곁에 남은 사람들과 생활의 속도를 다시 조율했다. 오래 미뤄 둔 약속과 몸의 신호도 외면하지 않으며 다음 계절을 맞았다.",
      longNarrative: "당신은 졸업 뒤에도 이전 선택들을 잊지 않았다. ".repeat(45),
      careerPath: "기획자",
      jobRole: "서비스 기획",
      destinationName: "새길연구소",
      salaryBand: "안정적",
      workplaceTone: ["자율", "협업"],
      satisfaction: 74,
      growthPotential: 81,
      workLifeBalance: 68,
      healthState: "회복 중",
      relationshipState: "서로의 거리를 존중하는 관계",
      tags: ["선택", "성장"],
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      message: { content: JSON.stringify(validEnding) },
    }), { status: 200 }));

    const result = await generateAiEnding({
      name: "서윤", age: 24, major: "사회학과",
      stats: { academic: 7, practical: 6, health: 5, mental: 5, wealth: 4, reputation: 6, charm: 5 },
      hiddenState: { eventFlags: { careerState: { evidence: [] } } },
      relationships: [{ name: "민서", role: "친구", trust: 7, tags: [] }],
      eventHistory,
      finalChoiceSummary: "당신은 마지막 제안을 받아들였다.",
    });

    expect(result).toMatchObject({ success: true, providerId: "ollama" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://ollama.com/api/chat");
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(request.options.num_predict).toBe(5_000);
    expect(request.format).toBe("json");
    const prompt = request.messages[1].content as string;
    expect(prompt).toContain('"order":1');
    expect(prompt).toContain('"title":"1번째 선택"');
    expect(prompt).toContain('"order":24');
    expect(prompt).toContain('"title":"24번째 선택"');
  });

  it("repairs an invalid Ollama ending with Ollama instead of switching providers", async () => {
    process.env.AI_PRIMARY_PROVIDER = "ollama";
    process.env.OLLAMA_API_KEY = "ollama-key";
    process.env.OPENROUTER_API_KEY = "openrouter-key";
    const baseEnding = {
      title: "남겨 둔 불빛",
      longNarrative: "당신은 졸업 뒤 과거의 선택을 새로운 일의 기준으로 삼았다. 오래 지킨 약속은 동료의 신뢰로 돌아왔고, 무리했던 날의 기억은 생활의 속도를 늦추게 했다. ".repeat(12),
      careerPath: "서비스 기획",
      jobRole: "기획자",
      destinationName: "새길연구소",
      salaryBand: "안정적",
      workplaceTone: ["협업"],
      satisfaction: 72,
      growthPotential: 78,
      workLifeBalance: 66,
      healthState: "회복 중",
      relationshipState: "좁지만 안정적",
      tags: ["선택", "성장"],
    };
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: { content: JSON.stringify({ ...baseEnding, summary: "너무 짧다" }) } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: { content: JSON.stringify({
        ...baseEnding,
        summary: "당신은 오래 지킨 약속과 무리했던 날의 비용을 함께 기억하며 새로운 실무를 시작했고, 관계와 건강을 다시 조율하면서 다음 계절의 생활을 스스로 만들었다.",
      }) } }), { status: 200 }));

    const result = await generateAiEnding({
      name: "서윤", age: 24, major: "사회학과", stats: {}, hiddenState: {}, relationships: [], eventHistory: [],
      finalChoiceSummary: "당신은 제안을 받아들였다.",
    });

    expect(result).toMatchObject({ success: true, providerId: "ollama" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([url]) => String(url) === "https://ollama.com/api/chat")).toBe(true);
    const repairRequest = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(repairRequest.options).toEqual({ temperature: 0.2, num_predict: 2400 });
    expect(repairRequest.messages[1].content).toContain("summary");
  });

  it("calls OpenRouter exactly once after a concrete Ollama failure", async () => {
    process.env.AI_PRIMARY_PROVIDER = "ollama";
    process.env.OLLAMA_API_KEY = "ollama-key";
    process.env.OPENROUTER_API_KEY = "openrouter-key";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("upstream failure", { status: 500 }));

    const result = await generateAiEvent({
      name: "서윤", major: "문학", gradeYear: 2, age: 21, coreEventCount: 4,
      recentSummaries: [], usedEventTitles: [], stats: {}, relationships: [], storyArc: {},
    });

    expect(result).toMatchObject({ success: false, providerId: "openrouter" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("ollama.com");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("openrouter.ai");
  });

  it("classifies malformed JSON separately", () => {
    expect(parseAiEventContentDetailed("{broken")).toEqual({
      success: false,
      reason: "malformed_json",
      issues: ["json"],
    });
  });

  it.each([
    [{ ...validEvent, title: undefined }, "narrative_schema"],
    [{ ...validEvent, tags: undefined }, "narrative_schema"],
    [{ ...validEvent, choices: [] }, "choice_count"],
    [{ ...validEvent, body: "짧다" }, "narrative_schema"],
    [{ ...validEvent, choices: [validEvent.choices[0]] }, "choice_count"],
    [{ ...validEvent, choices: [...validEvent.choices, validEvent.choices[0], validEvent.choices[1], validEvent.choices[0]] }, "choice_count"],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], id: undefined }, validEvent.choices[1]] }, null],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], id: 42 }, validEvent.choices[1]] }, null],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], label: undefined }, validEvent.choices[1]] }, "choice_field"],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], label: 42 }, validEvent.choices[1]] }, "choice_field"],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], summary: undefined }, validEvent.choices[1]] }, null],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], summary: 42 }, validEvent.choices[1]] }, null],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], statDelta: undefined }, validEvent.choices[1]] }, null],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], statDelta: "bad" }, validEvent.choices[1]] }, "choice_schema"],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], statDelta: { mental: "bad" } }, validEvent.choices[1]] }, "choice_schema"],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], statDelta: { secretStat: -1 } }, validEvent.choices[1]] }, "choice_schema"],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], label: "x".repeat(201) }, validEvent.choices[1]] }, "choice_field"],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], statDelta: { mental: -15, health: -1 } }, validEvent.choices[1]] }, null],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], statDelta: { mental: 15, health: 15 } }, validEvent.choices[1]] }, null],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], statDelta: { mental: -16 } }, validEvent.choices[1]] }, null],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], statDelta: { mental: 16 } }, validEvent.choices[1]] }, null],
    [{ ...validEvent, choices: [{ ...validEvent.choices[0], statDelta: { health: -2 } }, validEvent.choices[1]] }, null],
  ])("returns the diagnostic reason %s", (candidate, reason) => {
    const result = parseAiEventContentDetailed(JSON.stringify(candidate));
    if (reason === null) expect(result).toMatchObject({ success: true });
    else expect(result).toMatchObject({ success: false, reason });
  });

  it("clamps numeric provider stat deltas instead of discarding an otherwise valid event", () => {
    const result = parseAiEventContentDetailed(JSON.stringify({
      ...validEvent,
      choices: [
        { ...validEvent.choices[0], statDelta: { academic: 28, health: -8, wealth: "-30" } },
        validEvent.choices[1],
      ],
    }));

    expect(result).toMatchObject({ success: true });
    if (!result.success) throw new Error("expected a normalized event");
    expect(result.event.choices[0]?.statDelta).toEqual({ academic: 15, health: -1, wealth: -15 });
  });

  it("removes unjustified mental loss while clamping other excessive loss", () => {
    const result = parseAiEventContentDetailed(JSON.stringify({
      ...validEvent,
      choices: [
        { ...validEvent.choices[0], statDelta: { mental: -20, health: -8 } },
        validEvent.choices[1],
      ],
    }));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.event.choices[0]?.statDelta).toEqual({ mental: 0, health: -1 });
  });

  it("accepts a slow successful provider response without fallback or a second call", async () => {
    process.env.OLLAMA_API_KEY = "test-key";
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(12_001)
      .mockReturnValue(12_001);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      message: { content: JSON.stringify(validEvent) },
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const result = await generateAiEvent({
      name: "서윤", major: "문학", gradeYear: 2, age: 21, coreEventCount: 4,
      recentSummaries: [], usedEventTitles: [], stats: {}, relationships: [], storyArc: {},
    });

    expect(result).toMatchObject({ success: true, slow: true, totalElapsedMs: 12_001, providerElapsedMs: 12_001, providerFailures: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("aborts at the configured timeout and returns bounded timeout telemetry", async () => {
    vi.useFakeTimers();
    process.env.OLLAMA_API_KEY = "test-key";
    process.env.OPENROUTER_TIMEOUT_MS = "5000";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }));

    const pending = generateAiEvent({
      name: "서윤", major: "문학", gradeYear: 2, age: 21, coreEventCount: 4,
      recentSummaries: [], usedEventTitles: [], stats: {}, relationships: [], storyArc: {},
    });
    await vi.advanceTimersByTimeAsync(5_000);
    const result = await pending;

    expect(result).toMatchObject({
      success: false, reason: "timeout", providerId: "ollama",
      providerElapsedMs: 5_000, totalElapsedMs: 5_000, slow: false,
      providerFailures: [{ providerId: "ollama", stage: "provider", reason: "timeout", providerElapsedMs: 5_000 }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it("shares one total timeout budget across primary and secondary providers", async () => {
    vi.useFakeTimers();
    process.env.OLLAMA_API_KEY = "primary-key";
    process.env.OPENROUTER_API_KEY = "secondary-key";
    process.env.OPENROUTER_TIMEOUT_MS = "5000";
    let call = 0;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      call += 1;
      if (call === 1) {
        return new Promise((resolve) => setTimeout(() => resolve(new Response("rate limited", { status: 429 })), 4_000));
      }
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    });

    const pending = generateAiEvent({
      name: "서윤", major: "문학", gradeYear: 2, age: 21, coreEventCount: 4,
      recentSummaries: [], usedEventTitles: [], stats: {}, relationships: [], storyArc: {},
    });
    await vi.advanceTimersByTimeAsync(4_000);
    await vi.advanceTimersByTimeAsync(1_000);
    const result = await pending;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ success: false, reason: "timeout", totalElapsedMs: 5_000 });
    expect(result.providerFailures).toEqual([
      expect.objectContaining({ providerId: "ollama", reason: "rate_limited", providerElapsedMs: 4_000 }),
      expect.objectContaining({ providerId: "openrouter", reason: "timeout", providerElapsedMs: 1_000 }),
    ]);
  });

  it("does not call the secondary provider when the primary exhausts the total budget", async () => {
    vi.useFakeTimers();
    process.env.OLLAMA_API_KEY = "primary-key";
    process.env.OPENROUTER_API_KEY = "secondary-key";
    process.env.OPENROUTER_TIMEOUT_MS = "5000";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }));

    const pending = generateAiEvent({
      name: "서윤", major: "문학", gradeYear: 2, age: 21, coreEventCount: 4,
      recentSummaries: [], usedEventTitles: [], stats: {}, relationships: [], storyArc: {},
    });
    await vi.advanceTimersByTimeAsync(5_000);
    const result = await pending;

    expect(result).toMatchObject({ success: false, reason: "timeout", providerId: "ollama", totalElapsedMs: 5_000 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses one bounded structured request for narrative and all choices", async () => {
    process.env.OLLAMA_API_KEY = "test-key";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      message: { content: JSON.stringify(validEvent) },
    }), { status: 200 }));

    await generateAiEvent({
      name: "서윤", major: "문학", gradeYear: 2, age: 21, coreEventCount: 4,
      recentSummaries: [], usedEventTitles: [], stats: {}, relationships: [], storyArc: {},
    });
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(request.options.num_predict).toBeLessThanOrEqual(4_000);
    expect(request.format).toBe("json");
    const instructions = request.messages.map((message: { content: string }) => message.content).join("\n");
    for (const required of ["title", "body", "tags", "choices", "id", "label", "summary", "statDelta", "relationshipDelta"]) {
      expect(instructions).toContain(`\"${required}\"`);
    }
    expect(instructions).toContain("2-3 complete objects");
    expect(instructions).toContain("single JSON object");
    expect(JSON.stringify(request)).not.toContain("choice-only");
  });

  it("ignores Ollama reasoning tokens before the structured JSON content", async () => {
    process.env.OLLAMA_API_KEY = "test-key";
    const stream = [
      `data: ${JSON.stringify({ choices: [{ delta: { reasoning: "We need to reason first." } }] })}`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: JSON.stringify(validEvent) } }] })}`,
      "data: [DONE]",
    ].join("\n\n");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(stream, { status: 200 }));

    const result = await generateAiEventStream({
      name: "서윤", major: "문학", gradeYear: 2, age: 21, coreEventCount: 4,
      recentSummaries: [], usedEventTitles: [], stats: {}, relationships: [], storyArc: {},
    }, () => {});

    expect(result).toMatchObject({ success: true, providerId: "ollama" });
  });

  it("retains safe primary failure telemetry when the secondary provider succeeds", async () => {
    process.env.OLLAMA_API_KEY = "primary-secret";
    process.env.OPENROUTER_API_KEY = "secondary-secret";
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("limited", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(validEvent) } }] }), { status: 200 }));

    const result = await generateAiEvent({
      name: "서윤", major: "문학", gradeYear: 2, age: 21, coreEventCount: 4,
      recentSummaries: [], usedEventTitles: [], stats: {}, relationships: [], storyArc: {},
    });

    expect(result).toMatchObject({ success: true, providerId: "openrouter", retryUsed: true, providerFailures: [{ providerId: "ollama", stage: "provider", reason: "rate_limited" }] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(result)).not.toContain("primary-secret");
    expect(JSON.stringify(result)).not.toContain("secondary-secret");
    expect(JSON.stringify(result)).not.toContain("주인공:");
  });

  it("classifies a missing provider key without making a request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const result = await generateAiEvent({ name: "서윤", major: "문학", gradeYear: 2, age: 21, coreEventCount: 4, recentSummaries: [], usedEventTitles: [], stats: {}, relationships: [], storyArc: {} }, { primaryOnly: true });
    expect(result).toMatchObject({ success: false, reason: "no_key", providerId: "ollama", providerElapsedMs: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([[429, "rate_limited"], [500, "api_error"]] as const)("classifies HTTP %i as %s", async (status, reason) => {
    process.env.OLLAMA_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("upstream failure", { status }));
    const result = await generateAiEvent({ name: "서윤", major: "문학", gradeYear: 2, age: 21, coreEventCount: 4, recentSummaries: [], usedEventTitles: [], stats: {}, relationships: [], storyArc: {} }, { primaryOnly: true });
    expect(result).toMatchObject({ success: false, reason, providerId: "ollama" });
  });

  it.each([
    ["empty content", { choices: [{ message: { content: "" } }] }, "empty_content"],
    ["malformed JSON", { choices: [{ message: { content: "{broken" } }] }, "malformed_json"],
  ])("classifies %s responses", async (_label, payload, reason) => {
    process.env.OLLAMA_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    const result = await generateAiEvent({ name: "서윤", major: "문학", gradeYear: 2, age: 21, coreEventCount: 4, recentSummaries: [], usedEventTitles: [], stats: {}, relationships: [], storyArc: {} }, { primaryOnly: true });
    expect(result).toMatchObject({ success: false, reason });
  });

  it.each([
    ["choice_count", { ...validEvent, choices: [validEvent.choices[0]] }],
    ["choice_field", { ...validEvent, choices: [{ ...validEvent.choices[0], label: 42 }, validEvent.choices[1]] }],
    ["choice_schema", { ...validEvent, choices: [{ ...validEvent.choices[0], statDelta: "bad" }, validEvent.choices[1]] }],
  ] as const)("classifies real provider choice output as %s with one bounded call", async (reason, candidate) => {
    process.env.OLLAMA_API_KEY = "test-key";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(candidate) } }],
    }), { status: 200 }));
    const result = await generateAiEvent({
      name: "서윤", major: "문학", gradeYear: 2, age: 21, coreEventCount: 4,
      recentSummaries: [], usedEventTitles: [], stats: {}, relationships: [], storyArc: {},
    }, { primaryOnly: true });
    expect(result).toMatchObject({ success: false, reason, providerFailures: [expect.objectContaining({ reason, stage: "parse" })] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])("classifies HTTP-200 SSE in-band errors (EOF=%s)", async (atEof) => {
    process.env.OLLAMA_API_KEY = "test-key";
    const suffix = atEof ? "" : "\n\n";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(`data: {"error":{"message":"upstream failed"}}${suffix}`, { status: 200 }));
    const result = await generateAiEventStream({ name: "서윤", major: "문학", gradeYear: 2, age: 21, coreEventCount: 4, recentSummaries: [], usedEventTitles: [], stats: {}, relationships: [], storyArc: {} }, () => {}, { primaryOnly: true });
    expect(result).toMatchObject({ success: false, reason: "api_error" });
  });
});
