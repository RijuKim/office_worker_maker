import { describe, expect, it } from "vitest";

import { normalizeCareerNarrativeState, ORGANIZATIONS } from "@/lib/game/career-narrative";

const ALL_ORG_NAMES = ORGANIZATIONS.map((org) => org.name);

/** Generate N distinct character-run seeds that look like real UUIDs */
function* seedSequence(n: number): Generator<string> {
  const prefixes = ["cm0", "cm1", "cm2", "cm3", "cm4", "cm5", "cm6", "cm7", "cm8", "cm9"];
  const suffixes = "abcdefghijklmnopqrstuvwxyz0123456789";
  let seq = 0;
  while (seq < n) {
    const prefix = prefixes[seq % prefixes.length];
    const mid = Math.floor(seq / prefixes.length);
    const suffix = Array.from({ length: 20 }, (_, i) => suffixes[(seq * 7 + i * 13) % suffixes.length]).join("");
    yield `${prefix}${mid}${suffix}`;
    seq++;
  }
}

describe("organization distribution across seeds", () => {
  it("selects organizations deterministically per seed", () => {
    const first = normalizeCareerNarrativeState(null, { storySeed: "test-seed-1", major: "방사선학과", coreEventCount: 0 });
    const same = normalizeCareerNarrativeState(null, { storySeed: "test-seed-1", major: "방사선학과", coreEventCount: 0 });
    expect(first.organizations.map((o) => o.id)).toEqual(same.organizations.map((o) => o.id));
  });

  it("selects different organization sets for different seeds", () => {
    // Check multiple seed pairs; some may coincidentally overlap
    const pairs = [
      ["seed-alpha", "seed-beta"],
      ["aaa", "bbb"],
      ["cm0xxxxxxxxxxxxxxxxxxxx", "cm1xxxxxxxxxxxxxxxxxxxx"],
    ];
    const allDifferent = pairs.some(([a, b]) => {
      const setA = normalizeCareerNarrativeState(null, { storySeed: a, major: "방사선학과", coreEventCount: 0 });
      const setB = normalizeCareerNarrativeState(null, { storySeed: b, major: "방사선학과", coreEventCount: 0 });
      const idsA = setA.organizations.map((o) => o.id);
      const idsB = setB.organizations.map((o) => o.id);
      return JSON.stringify(idsA) !== JSON.stringify(idsB);
    });
    expect(allDifferent).toBe(true);
  });

  it("hanbit-medical does not dominate across 200 distinct seeds", () => {
    const SEED_COUNT = 200;
    const selectionCounts: Record<string, number> = {};

    for (const seed of seedSequence(SEED_COUNT)) {
      const state = normalizeCareerNarrativeState(null, {
        storySeed: seed,
        major: "방사선학과",
        coreEventCount: 0,
      });
      for (const org of state.organizations) {
        selectionCounts[org.id] = (selectionCounts[org.id] ?? 0) + 1;
      }
    }

    const hanbitCount = selectionCounts["hanbit-medical"] ?? 0;

    // With 16 orgs and 8 selected per run, each org has p=0.5 selection per trial.
    // For 200 trials the 99.7% (~3σ) binomial interval is 50% ± ~10.6% = 200*0.106 ≈ 21.
    // So 200*0.5 ± 50 is an extremely generous bound (true 3σ is only ±21).
    // This test catches only catastrophic bias (e.g. 한빛 selected 90%+ of the time).
    expect(hanbitCount).toBeGreaterThanOrEqual(30);
    expect(hanbitCount).toBeLessThanOrEqual(170);
  });

  it("no single organization appears in >80% or <15% of 200 distinct seeds", () => {
    const SEED_COUNT = 200;
    const selectionCounts: Record<string, number> = {};

    for (const seed of seedSequence(SEED_COUNT)) {
      const state = normalizeCareerNarrativeState(null, {
        storySeed: seed,
        major: "방사선학과",
        coreEventCount: 0,
      });
      for (const org of state.organizations) {
        selectionCounts[org.id] = (selectionCounts[org.id] ?? 0) + 1;
      }
    }

    for (const orgId of ORGANIZATIONS.map((o) => o.id)) {
      const count = selectionCounts[orgId] ?? 0;
      const pct = count / SEED_COUNT;
      expect(pct).toBeGreaterThan(0.15);
      expect(pct).toBeLessThan(0.8);
    }
  });

  it("exposes the ORGANIZATIONS constant for test use", () => {
    expect(ORGANIZATIONS).toHaveLength(16);
    expect(ORGANIZATIONS.some((org) => org.id === "hanbit-medical")).toBe(true);
  });
});
