import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadPublicEnding = vi.hoisted(() => vi.fn());
const headers = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  headers,
}));

vi.mock("@/lib/game-ui/public-ending", () => ({
  loadPublicEnding,
}));

import { generateMetadata } from "@/app/share/[id]/page";
import SharePage from "@/app/share/[id]/page";

describe("public ending share page", () => {
  beforeEach(() => {
    headers.mockReset();
    loadPublicEnding.mockReset();
  });

  it("renders the shared ending detail from the normalized loader result", async () => {
    headers.mockResolvedValueOnce({
      get(name: string) {
        if (name === "host") return "example.com";
        if (name === "x-forwarded-proto") return "https";
        return null;
      },
    });
    loadPublicEnding.mockResolvedValueOnce({
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

    const element = await SharePage({ params: Promise.resolve({ id: "ending-1" }) });
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(headers).toHaveBeenCalledOnce();
    expect(loadPublicEnding).toHaveBeenCalledWith("ending-1", {
      baseUrl: "https://example.com",
    });
    expect(html).toContain("첫 기록");
    expect(html).toContain("긴 서사");
    expect(html).toContain("서비스 기획자");
    expect(html).toContain("민준 · 동기");
    expect(html).toContain("첫 입사");
    expect(html).toContain("태그");
  });

  it("builds metadata from the same public ending loader", async () => {
    headers.mockResolvedValueOnce({
      get(name: string) {
        if (name === "host") return "example.com";
        if (name === "x-forwarded-proto") return "https";
        return null;
      },
    });
    loadPublicEnding.mockResolvedValueOnce({
      id: "ending-2",
      title: "두 번째 기록",
      summary: "",
      longNarrative: "",
      careerPath: "개발",
      jobRole: null,
      destinationName: null,
      salaryBand: null,
      workplaceTone: [],
      satisfaction: 79,
      growthPotential: 88,
      workLifeBalance: 74,
      healthState: "",
      relationshipState: "",
      tags: [],
      statSnapshot: {},
      keyRelationships: [],
      majorEvents: [],
    });

    const metadata = await generateMetadata({ params: Promise.resolve({ id: "ending-2" }) });

    expect(metadata.title).toBe("두 번째 기록 - 선택의 결과");
    expect(metadata.description).toBe("개발 · 만족도 79");
  });
});
