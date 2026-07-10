import { describe, expect, it } from "vitest";
import { CATEGORY_ORDER, CODEX_CATALOG, getCategoryHint, type CodexCategory } from "@/lib/game/codex-catalog";
import type { EndingArtType } from "@/lib/game/ending-art";
import type { CareerEndingRecord } from "@prisma/client";

const KNOWN_CAREER_PATHS = [
  "삼슨전자 신입 실무자",
  "네이봐 신입 실무자",
  "카캉오 신입 실무자",
  "배달이민족 신입 실무자",
  "규글코리아 신입 실무자",
  "스타벅수커피 신입 실무자",
  "엘쥐전자 신입 실무자",
  "현댜모터스 신입 실무자",
  "에스끼리텔 신입 실무자",
  "전문직 수습 과정",
  "전문직 시험 재도전",
  "공공안전 직무 합격자",
  "공공안전 직무 준비생",
  "새싹엔진 선정 창업자",
  "창업 또는 자영업",
  "연애와 결혼을 선택한 생활인",
  "혼자 살며 조용히 안정된 사람",
  "해외 워홀 이후 다시 길을 찾은 사람",
  "자퇴 후 진로",
  "위험한 돈에서 겨우 발을 뺀 생존자",
  "아르바이트 경력자",
  "마케팅·콘텐츠 직무",
  "기업 채용 재도전",
  "첫 직장 신입 실무자",
  "기업 면접 탈락 후 재지원 준비",
  "공공기관 또는 공무원 준비",
  "전문직 시험 준비생",
  "불확실하지만 계속되는 취업 준비",
  "첫 지원 탈락 후 이어지는 준비",
  "창업 심사 탈락 후 아이디어 검증",
  "공공안전 전형 재준비",
  "졸업 후 취업",
  "휴학 중 경험",
  "진로 탐색",
  "마지막 관문을 앞둔 진로 준비",
] as const;

const EXEMPT_CAREER_PATHS = ["obsolete_ending_v0"] as const;

const makeRecord = (careerPath: string) => ({ careerPath, tags: [] }) as unknown as CareerEndingRecord;

describe("codex catalog integrity", () => {
  it("모든 slot에 필수 필드 존재", () => {
    for (const slot of CODEX_CATALOG) {
      expect(slot.id).toBeTruthy();
      expect(slot.title).toBeTruthy();
      expect(slot.category).toBeTruthy();
      expect(slot.categoryHint).toBeTruthy();
      expect(slot.endingArtType).toBeTruthy();
      expect(slot.matches).toBeTypeOf("function");
    }
  });

  it("slot id 중복 없음", () => {
    const ids = CODEX_CATALOG.map((slot) => slot.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("모든 endingArtType이 유효", () => {
    const validEndingArtTypes: EndingArtType[] = [
      "company",
      "professional",
      "public_safety",
      "startup",
      "self_employment",
      "graduate_school",
      "marriage",
      "parenting",
      "solitude",
      "overseas",
      "dropout",
      "burnout",
      "default",
    ];

    for (const slot of CODEX_CATALOG) {
      expect(validEndingArtTypes).toContain(slot.endingArtType);
    }
  });

  it("최소 30개 슬롯 정의", () => {
    expect(CODEX_CATALOG.length).toBeGreaterThanOrEqual(30);
  });

  it("모든 카테고리 힌트 존재", () => {
    for (const category of CATEGORY_ORDER) {
      const hint = getCategoryHint(category as CodexCategory);
      expect(hint).toEqual(expect.any(String));
      expect(hint.trim()).not.toHaveLength(0);
    }
  });

  it("matches predicate가 함수", () => {
    for (const slot of CODEX_CATALOG) {
      expect(slot.matches).toBeTypeOf("function");
    }
  });

  it("matches predicate가 record에 대해 boolean 반환", () => {
    const record = makeRecord("테스트 경로");

    for (const slot of CODEX_CATALOG) {
      expect(() => slot.matches(record)).not.toThrow();
      expect(slot.matches(record)).toBeTypeOf("boolean");
    }
  });

  it("무결성: 모든 careerPath가 catalog에 매핑됨", () => {
    const catalog = CODEX_CATALOG;

    for (const careerPath of KNOWN_CAREER_PATHS) {
      if (EXEMPT_CAREER_PATHS.includes(careerPath as (typeof EXEMPT_CAREER_PATHS)[number])) continue;

      const record = makeRecord(careerPath);
      const matched = catalog.some((slot) => {
        try {
          return slot.matches(record);
        } catch {
          return false;
        }
      });

      expect(matched, careerPath).toBe(true);
    }
  });
});
