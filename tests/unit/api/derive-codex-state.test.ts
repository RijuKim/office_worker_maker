import { describe, expect, it } from "vitest";

import { deriveCodexState, isRecordOrphan } from "@/lib/game/derive-codex-state";
import { CODEX_CATALOG } from "@/lib/game/codex-catalog";
import {
  buildCompleteRecordsFixture,
  buildDuplicateRecordsFixture,
  buildEmptyRecordsFixture,
  buildOrphanRecordFixture,
  buildPartialRecordsFixture,
} from "@/tests/fixtures/codex-fixtures";

describe("deriveCodexState", () => {
  it("empty records → all locked, unlockedCount=0", () => {
    const state = deriveCodexState(buildEmptyRecordsFixture(), CODEX_CATALOG);

    expect(state.unlockedCount).toBe(0);
    expect(state.slots.every((slot) => slot.unlocked === false)).toBe(true);
  });

  it("partial records → correct slots unlocked", () => {
    const state = deriveCodexState(buildPartialRecordsFixture(), CODEX_CATALOG);

    expect(state.unlockedCount).toBe(3);
    expect(state.slots.filter((slot) => slot.unlocked).map((slot) => slot.slot.id)).toEqual(
      expect.arrayContaining(["company-samson", "professional-trainee", "marriage-life"]),
    );
  });

  it("complete records → all unlocked", () => {
    const records = buildCompleteRecordsFixture();
    const state = deriveCodexState(records, CODEX_CATALOG);

    expect(state.unlockedCount).toBe(state.totalSlots);
    expect(state.slots.every((slot) => slot.unlocked)).toBe(true);
  });

  it("orphan record silently skipped", () => {
    const state = deriveCodexState([buildOrphanRecordFixture()], CODEX_CATALOG);

    expect(state.unlockedCount).toBe(0);
    expect(state.slots.every((slot) => slot.unlocked === false)).toBe(true);
  });

  it("duplicate records → 1 unlock, earliest createdAt", () => {
    const records = buildDuplicateRecordsFixture();
    const state = deriveCodexState(records, CODEX_CATALOG);
    const samsonSlot = state.slots.find((slot) => slot.slot.id === "company-samson");

    expect(state.unlockedCount).toBe(1);
    expect(samsonSlot?.unlocked).toBe(true);
    expect(samsonSlot?.achievementCount).toBe(3);
    expect(samsonSlot?.firstAchievedAt).toEqual(records[0].createdAt);
  });

  it("tie-break: catalog order first slot wins", () => {
    const record = {
      ...buildOrphanRecordFixture(),
      id: "00000000-0000-4000-8000-00000000aaaa",
      careerPath: "건강 붕괴",
      title: "겹치는 번아웃 기록",
      summary: "여러 슬롯에 동시에 걸리는 기록이다.",
      longNarrative: "health와 멘탈 태그를 모두 가진 기록이다.",
      tags: ["health", "멘탈"],
    };
    const state = deriveCodexState([record], CODEX_CATALOG);

    expect(state.unlockedCount).toBe(1);
    expect(state.slots.find((slot) => slot.slot.id === "burnout-health")?.unlocked).toBe(true);
    expect(state.slots.find((slot) => slot.slot.id === "burnout-mental")?.unlocked).toBe(false);
  });

  it("byCategory counts correctly", () => {
    const state = deriveCodexState(buildPartialRecordsFixture(), CODEX_CATALOG);

    expect(state.byCategory).toMatchObject({
      회사취업: { total: CODEX_CATALOG.filter((slot) => slot.category === "회사취업").length, unlocked: 1 },
      전문직: { total: CODEX_CATALOG.filter((slot) => slot.category === "전문직").length, unlocked: 1 },
      결혼: { total: CODEX_CATALOG.filter((slot) => slot.category === "결혼").length, unlocked: 1 },
    });

    for (const category of Object.keys(state.byCategory)) {
      if (!["회사취업", "전문직", "결혼"].includes(category)) {
        expect(state.byCategory[category].unlocked).toBe(0);
      }
    }
  });

  it("achievementCount matches record count per slot", () => {
    const state = deriveCodexState(buildDuplicateRecordsFixture(), CODEX_CATALOG);
    const samsonSlot = state.slots.find((slot) => slot.slot.id === "company-samson");

    expect(samsonSlot?.achievementCount).toBe(3);
  });

  it("complete records track category totals as unlocked", () => {
    const state = deriveCodexState(buildCompleteRecordsFixture(), CODEX_CATALOG);

    for (const [category, counts] of Object.entries(state.byCategory)) {
      expect(counts.unlocked).toBe(counts.total);
      expect(counts.total).toBe(CODEX_CATALOG.filter((slot) => slot.category === category).length);
    }
  });
});

describe("isRecordOrphan", () => {
  it("valid record → false", () => {
    expect(isRecordOrphan(buildPartialRecordsFixture()[0], CODEX_CATALOG)).toBe(false);
  });

  it("orphan careerPath → true", () => {
    expect(isRecordOrphan(buildOrphanRecordFixture(), CODEX_CATALOG)).toBe(true);
  });
});
