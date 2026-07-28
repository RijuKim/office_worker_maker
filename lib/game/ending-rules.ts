/**
 * Pure ending-rule helpers for replay-balance.
 *
 * NORMAL_FINAL_ENDING_THRESHOLD  = 20 — a graduation-ready run can end here.
 * HARD_FALLBACK_ENDING_THRESHOLD = 24 — any eligible non-early run ends here.
 *
 * These thresholds are exported as named constants so tests do not duplicate
 * magic numbers.  The choice API consumes this helper without changing its
 * response DTOs.
 */

export const NORMAL_FINAL_ENDING_THRESHOLD = 20;
export const HARD_FALLBACK_ENDING_THRESHOLD = 24;

export type FinalEndingInput = {
  coreEventCount: number;
  lifeStage: string;
  graduation: string;
};

/**
 * Returns true when the run should create a final ending record.
 *
 * - A post-graduation / graduated character may end at 20.
 * - Any eligible non-early run that has not otherwise ended must end by 24.
 * - Immediate collapse endings (handled upstream) are not affected.
 */
export function shouldCreateFinalEnding(input: FinalEndingInput): boolean {
  const { coreEventCount, lifeStage, graduation } = input;

  // Graduation-ready: normal final ending eligible at 20.
  if (
    lifeStage === "post_graduation" &&
    graduation === "graduated" &&
    coreEventCount >= NORMAL_FINAL_ENDING_THRESHOLD
  ) {
    return true;
  }

  // Hard fallback: any non-early run that hasn't ended by 24.
  if (
    coreEventCount >= HARD_FALLBACK_ENDING_THRESHOLD &&
    lifeStage !== "college_early"
  ) {
    return true;
  }

  return false;
}
