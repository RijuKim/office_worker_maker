import { describe, expect, it } from "vitest";

import { buildDiversityCategoryGuidance } from "@/lib/game/event-diversity";

describe("event diversity guidance", () => {
  it("keeps categories seen once eligible while avoiding immediate and repeated categories", () => {
    const result = buildDiversityCategoryGuidance(
      ["알바", "연애", "알바", "가족", "건강"],
      ["알바", "연애", "가족", "건강", "취미"],
    );

    expect(result.avoidCategories).toEqual(expect.arrayContaining(["알바", "연애"]));
    expect(result.avoidCategories).not.toContain("가족");
    expect(result.preferCategories).toEqual(["취미"]);
  });
});
