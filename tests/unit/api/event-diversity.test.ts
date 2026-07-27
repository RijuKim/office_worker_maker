import { describe, expect, it } from "vitest";

import {
  buildDiversityCategoryGuidance,
  EVENT_DIVERSITY_CATEGORIES,
  eventMatchesCategory,
  normalizeEventCategory,
  selectStoryCategoryPalette,
} from "@/lib/game/event-diversity";

describe("event diversity guidance", () => {
  it("keeps categories seen once eligible while avoiding immediate and repeated categories", () => {
    const result = buildDiversityCategoryGuidance(
      ["알바", "연애", "알바", "가족", "건강"],
      ["알바", "연애", "가족", "건강", "취미"],
    );

    expect(result.avoidCategories).toEqual(expect.arrayContaining(["알바/일", "연애"]));
    expect(result.avoidCategories).not.toContain("가족");
    expect(result.preferCategories[0]).toBe("취미/문화");
  });

  it("normalizes emerging and leisure activities into shared categories", () => {
    expect(normalizeEventCategory("버튜버 데뷔")).toBe("온라인 창작");
    expect(normalizeEventCategory("뮤지컬 관람")).toBe("취미/문화");
    expect(normalizeEventCategory("친구와 당일치기 여행")).toBe("여행/외출");
    expect(normalizeEventCategory("룸메이트와 사소한 다툼")).toBe("사소한 갈등");
  });

  it("selects one concrete underrepresented target from the broad catalog", () => {
    const result = buildDiversityCategoryGuidance(
      ["학업", "실습", "알바", "가족", "면접"],
      EVENT_DIVERSITY_CATEGORIES,
    );

    expect(result.targetCategory).toBeTruthy();
    expect(result.avoidCategories).toEqual(expect.arrayContaining(["학업/수업"]));
    expect(["학업/수업", "알바/일", "가족", "진로/취업"]).not.toContain(result.targetCategory);
  });

  it("recognizes category intent from title, body, or tags", () => {
    expect(eventMatchesCategory("온라인 창작", {
      title: "첫 버튜버 방송",
      body: "당신은 아바타를 켜고 첫 라이브를 시작한다.",
      tags: ["도전"],
    })).toBe(true);
  });

  it("can preserve continuity without forcing a new category every event", () => {
    const result = buildDiversityCategoryGuidance(
      ["학업", "우정", "취미"],
      EVENT_DIVERSITY_CATEGORIES,
      2,
      false,
    );

    expect(result.targetCategory).toBeNull();
  });

  it("keeps a stable limited category palette for one story", () => {
    const first = selectStoryCategoryPalette("character-run-a");
    const same = selectStoryCategoryPalette("character-run-a");
    const other = selectStoryCategoryPalette("character-run-b");

    expect(first).toEqual(same);
    expect(first).toHaveLength(9);
    expect(first).toEqual(expect.arrayContaining(["학업/수업", "진로/취업", "우정/사교"]));
    expect(other).not.toEqual(first);
  });
});
