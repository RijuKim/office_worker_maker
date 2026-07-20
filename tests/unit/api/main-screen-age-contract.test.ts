import { describe, expect, it } from "vitest";
import { buildFirstEvent, type NormalizedCharacterCreateInput } from "@/lib/game/character-foundation";
import { characterCreateSchema } from "@/lib/game/validation";

const baseInput = {
  name: "한서윤",
  residence: "studio",
  preferredStats: ["academic", "mental"],
} as const;

describe("main screen age contract", () => {
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
