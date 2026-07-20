import { describe, expect, it } from "vitest";
import { buildFirstEvent, type NormalizedCharacterCreateInput } from "@/lib/game/character-foundation";
import { characterCreateSchema } from "@/lib/game/validation";

const baseInput = {
  name: "한서윤",
  residence: "studio",
  preferredStats: ["academic", "mental"],
} as const;

describe("main screen age contract", () => {
  it("exposes every ordered integer age from 18 through 80", () => {
    expect(Array.from({ length: 63 }, (_, index) => index + 18)).toEqual([
      18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35,
      36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53,
      54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71,
      72, 73, 74, 75, 76, 77, 78, 79, 80,
    ]);
  });
  it.each([18, 40, 80])("accepts age %i and carries it into the first event context", (age) => {
    const parsed = characterCreateSchema.parse({ ...baseInput, age });
    const event = buildFirstEvent({
      ...parsed,
      startGradeYear: 2,
      major: "사회학과",
    } as NormalizedCharacterCreateInput);

    expect(event.body).toContain(`현재 ${age}세인 당신`);
  });

  it.each([17, 81])("rejects age %i at the creation boundary", (age) => {
    expect(characterCreateSchema.safeParse({ ...baseInput, age }).success).toBe(false);
  });
});
