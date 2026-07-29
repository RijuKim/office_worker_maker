import { describe, expect, it } from "vitest";

import {
  buildLongFallbackEnding,
  sanitizeResultText,
} from "@/lib/game/ending-copy";

describe("ending copy", () => {
  it("removes internal event-count and final-gate wording from generated copy", () => {
    expect(sanitizeResultText("24개의 사건과 마지막 관문을 지나 새로운 길에 들어섰다."))
      .toBe("지금까지의 선택을 지나 새로운 길에 들어섰다.");
  });

  it("varies fallback narratives using the actual route history", () => {
    const first = buildLongFallbackEnding(
      "서윤", "사회학과", "콘텐츠 기획자",
      { academic: 7, practical: 5, health: 6, mental: 6, reputation: 5 },
      "당신은 작은 제안을 받아들였다.", "친구들과 연락을 이어감",
      [{ event: { title: "낡은 편집실" }, summary: "당신은 밤새 원고를 다듬었다." }],
    );
    const second = buildLongFallbackEnding(
      "서윤", "사회학과", "콘텐츠 기획자",
      { academic: 7, practical: 5, health: 6, mental: 6, reputation: 5 },
      "당신은 작은 제안을 받아들였다.", "친구들과 연락을 이어감",
      [{ event: { title: "옥상의 마지막 발표" }, summary: "당신은 팀 앞에서 계획을 설명했다." }],
    );

    expect(first).not.toBe(second);
    expect(first).toContain("낡은 편집실");
    expect(second).toContain("옥상의 마지막 발표");
    expect(first).not.toContain("24개의 사건");
  });
});
