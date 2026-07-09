import type { CareerEndingRecord } from "@prisma/client";

import type { CodexCategory, CodexSlot } from "@/lib/game/codex-catalog";

export type CodexSlotState = {
  slot: CodexSlot;
  unlocked: boolean;
  firstAchievedAt: Date | null;
  achievementCount: number;
};

export type CodexState = {
  slots: CodexSlotState[];
  totalSlots: number;
  unlockedCount: number;
  byCategory: Record<string, { total: number; unlocked: number }>;
};

export function isRecordOrphan(record: CareerEndingRecord, catalog: readonly CodexSlot[]): boolean {
  return !catalog.some((slot) => slot.matches(record));
}

export function deriveCodexState(records: CareerEndingRecord[], catalog: readonly CodexSlot[]): CodexState {
  const claimedRecordIds = new Set<string>();
  const slots: CodexSlotState[] = [];
  const categoryTotals = new Map<CodexCategory, { total: number; unlocked: number }>();

  for (const slot of catalog) {
    const categoryState = categoryTotals.get(slot.category) ?? { total: 0, unlocked: 0 };
    categoryState.total += 1;

    const matchingRecords = records.filter((record) => !claimedRecordIds.has(record.id) && slot.matches(record));
    const unlocked = matchingRecords.length > 0;

    if (unlocked) {
      categoryState.unlocked += 1;
      for (const record of matchingRecords) {
        claimedRecordIds.add(record.id);
      }
    }

    categoryTotals.set(slot.category, categoryState);

    slots.push({
      slot,
      unlocked,
      firstAchievedAt: unlocked ? earliestDate(matchingRecords) : null,
      achievementCount: matchingRecords.length,
    });
  }

  const byCategory = Object.fromEntries(
    [...categoryTotals.entries()].map(([category, value]) => [category, { total: value.total, unlocked: value.unlocked }]),
  ) as Record<string, { total: number; unlocked: number }>;

  return {
    slots,
    totalSlots: slots.length,
    unlockedCount: slots.filter((slotState) => slotState.unlocked).length,
    byCategory,
  };
}

function earliestDate(records: readonly CareerEndingRecord[]): Date | null {
  let earliest: Date | null = null;
  for (const record of records) {
    const d = new Date(record.createdAt);
    if (earliest === null || d < earliest) {
      earliest = d;
    }
  }
  return earliest;
}
