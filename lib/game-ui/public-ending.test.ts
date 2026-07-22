import { describe, expect, it, vi } from "vitest";

import { loadPublicEnding } from "./public-ending";

describe("public ending loader", () => {
  it("loads and normalizes the public ending dto from the read-only endpoint", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        id: "ending-1",
        title: "첫 기록",
        summary: "요약",
        longNarrative: "긴 서사",
        careerPath: "기획",
        jobRole: "",
        destinationName: "   ",
        salaryBand: "4,500만원",
        workplaceTone: ["차분함", 1],
        satisfaction: 84,
        growthPotential: 91,
        workLifeBalance: 73,
        healthState: "양호",
        relationshipState: "안정",
        tags: ["태그", 2],
        statSnapshot: { academic: 8, hidden: "ignore" },
        keyRelationships: [{ name: "민준", role: "동기", trust: 80, hidden: true }],
        majorEvents: [{ summary: "첫 입사" }, { summary: 1 }],
        hiddenState: "ignore me",
      }),
    );

    const ending = await loadPublicEnding("ending-1", {
      baseUrl: "https://example.com",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [input, init] = fetchImpl.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit?];
    expect(String(input)).toBe("https://example.com/api/share/ending-1");
    expect(init).toMatchObject({
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });
    expect(ending).toEqual({
      id: "ending-1",
      title: "첫 기록",
      summary: "요약",
      longNarrative: "긴 서사",
      careerPath: "기획",
      jobRole: null,
      destinationName: null,
      salaryBand: "4,500만원",
      workplaceTone: ["차분함"],
      satisfaction: 84,
      growthPotential: 91,
      workLifeBalance: 73,
      healthState: "양호",
      relationshipState: "안정",
      tags: ["태그"],
      statSnapshot: { academic: 8 },
      keyRelationships: [{ name: "민준", role: "동기", trust: 80 }],
      majorEvents: [{ summary: "첫 입사" }],
    });
  });

  it("returns null for the agreed missing state", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ error: "기록을 찾을 수 없습니다" }, { status: 404 }));

    await expect(
      loadPublicEnding("missing", {
        baseUrl: "https://example.com",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toBeNull();
  });
});
