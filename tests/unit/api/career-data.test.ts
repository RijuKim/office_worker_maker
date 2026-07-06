import { describe, expect, it } from "vitest";

import { validateCareerDestination, seedCareerDestinations } from "@/lib/game/career-data";

describe("seedCareerDestinations", () => {
  it("provides 40+ destinations", () => {
    const seeds = seedCareerDestinations();
    expect(seeds.length).toBeGreaterThanOrEqual(40);
  });

  it("covers all destination types", () => {
    const seeds = seedCareerDestinations();
    const types = new Set(seeds.map((s) => s.destinationType));
    expect(types.has("PARODY_COMPANY")).toBe(true);
    expect(types.has("PUBLIC_SECTOR")).toBe(true);
    expect(types.has("LICENSED_PROFESSION")).toBe(true);
    expect(types.has("ENTREPRENEURSHIP")).toBe(true);
    expect(types.has("SELF_EMPLOYMENT")).toBe(true);
  });

  it("all seeds pass safety validation", () => {
    const seeds = seedCareerDestinations();
    for (const seed of seeds) {
      const errors = validateCareerDestination(seed);
      expect(errors, `Failed for: ${seed.displayName}`).toEqual([]);
    }
  });

  it("each seed has required fields", () => {
    const seeds = seedCareerDestinations();
    for (const seed of seeds) {
      expect(seed.displayName).toBeTruthy();
      expect(seed.industry).toBeTruthy();
      expect((seed.roles as string[]).length).toBeGreaterThanOrEqual(1);
      expect(seed.salaryBand).toBeTruthy();
      expect(seed.preferredStats).toBeTruthy();
    }
  });
});

describe("validateCareerDestination", () => {
  it("rejects real company names", () => {
    const errors = validateCareerDestination({
      displayName: "삼성전자",
      destinationType: "PARODY_COMPANY",
      industry: "전자",
      roles: ["개발"],
      salaryBand: "5000",
      cultureTags: [],
      hiringDifficulty: 3,
      preferredStats: { academic: 50 },
      eventTone: ["전문적"],
    });
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });
});