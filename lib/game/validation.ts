import { z } from "zod";

export const publicStatKeys = ["academic", "practical", "health", "mental", "wealth", "charm", "reputation"] as const;
export const residenceKeys = ["family_home", "studio", "dorm"] as const;

export const signupSchema = z.object({
  email: z.string().email("올바른 이메일을 입력해 주세요.").trim().toLowerCase(),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다.").max(128, "비밀번호가 너무 깁니다."),
});

export const characterCreateSchema = z.object({
  name: z.preprocess(
    (value) => (typeof value === "string" ? value : ""),
    z.string().trim().min(1, "이름을 입력해 주세요.").max(24, "이름은 24자 이하로 입력해 주세요."),
  ),
  age: z.coerce.number().int().min(18, "나이는 18세 이상이어야 합니다.").max(80, "나이는 80세 이하이어야 합니다."),
  residence: z.enum(residenceKeys).default("studio"),
  preferredStats: z.array(z.enum(publicStatKeys)).length(2, "선호 스탯은 정확히 2개를 선택해 주세요."),
  startGradeYear: z.coerce.number().int().min(1, "학년은 1-4 사이여야 합니다.").max(4, "학년은 1-4 사이여야 합니다.").optional(),
  major: z.string().trim().min(1, "전공을 입력해 주세요.").max(40, "전공은 40자 이하로 입력해 주세요.").optional(),
});

export type CharacterCreateInput = z.infer<typeof characterCreateSchema>;
export type PublicStatKey = (typeof publicStatKeys)[number];
