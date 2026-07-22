import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/share/[id]/route";

const { findUnique } = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    careerEndingRecord: {
      findUnique,
    },
  },
}));

describe("public ending share route", () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it("returns an allowlisted ending dto and strips private fields", async () => {
    findUnique.mockResolvedValueOnce({
      id: "ending-1",
      title: "첫 기록",
      summary: "요약",
      longNarrative: "긴 서사",
      careerPath: "기획",
      jobRole: "서비스 기획자",
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
      userId: "private-user",
      characterRunId: "private-run",
    });

    const response = await GET(new Request("http://localhost/api/share/ending-1"), { params: Promise.resolve({ id: "ending-1" }) });
    const body = await response.json();

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "ending-1" },
      select: {
        id: true,
        title: true,
        summary: true,
        longNarrative: true,
        careerPath: true,
        jobRole: true,
        destinationName: true,
        salaryBand: true,
        workplaceTone: true,
        satisfaction: true,
        growthPotential: true,
        workLifeBalance: true,
        healthState: true,
        relationshipState: true,
        tags: true,
        statSnapshot: true,
        keyRelationships: true,
        majorEvents: true,
      },
    });
    expect(response.status).toBe(200);
    expect(body).toEqual({
      id: "ending-1",
      title: "첫 기록",
      summary: "요약",
      longNarrative: "긴 서사",
      careerPath: "기획",
      jobRole: "서비스 기획자",
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
    expect(JSON.stringify(body)).not.toContain("private-user");
    expect(JSON.stringify(body)).not.toContain("private-run");
  });

  it("returns the agreed korean 404 for missing records", async () => {
    findUnique.mockResolvedValueOnce(null);

    const response = await GET(new Request("http://localhost/api/share/missing"), { params: Promise.resolve({ id: "missing" }) });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "기록을 찾을 수 없습니다" });
  });
});
