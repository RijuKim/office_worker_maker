import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  createEmptyPublicEndingDto,
  createHostFailure,
  createSafeAreaInsets,
  normalizePublicEndingDto,
  parseRouteIntent,
  ZERO_SAFE_AREA_INSETS,
} from "./types";
import {
  createTossAccountSurface,
  createTossHostCapabilities,
  createWebAccountSurface,
  createWebHostCapabilities,
  createZeroInsetSafeAreaPort,
} from "./host";

describe("game-ui contracts", () => {
  it("provide zero safe-area defaults and visible account surface capability only for web", () => {
    expect(ZERO_SAFE_AREA_INSETS).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    expect(createSafeAreaInsets()).toEqual(ZERO_SAFE_AREA_INSETS);

    expect(createWebHostCapabilities()).toEqual({
      kind: "web",
      accountSurface: { available: true },
      audio: true,
      haptics: true,
    });
    expect(createTossHostCapabilities()).toEqual({
      kind: "toss",
      accountSurface: {
        available: false,
        reason: "토스 앱에서는 계정/이메일 표면을 숨깁니다.",
      },
      audio: true,
      haptics: true,
    });

    expect(createWebAccountSurface()).toEqual({ available: true, label: "계정" });
    expect(createTossAccountSurface()).toEqual({ available: false, label: "계정 없음" });

    const safeArea = createZeroInsetSafeAreaPort();
    expect(safeArea.get()).toEqual(ZERO_SAFE_AREA_INSETS);
    expect(safeArea.subscribe(() => undefined)).toEqual(expect.any(Function));
  });

  it("parses share deep-link intents and falls back to play for non-share routes", () => {
    expect(parseRouteIntent("/share/record-123")).toEqual({ kind: "share", recordId: "record-123" });
    expect(parseRouteIntent("intoss://sano-job-seeker/share/record%2042")).toEqual({
      kind: "share",
      recordId: "record 42",
    });
    expect(parseRouteIntent("/play")).toEqual({ kind: "play" });
    expect(parseRouteIntent("https://example.com/nope")).toEqual({ kind: "play" });
  });

  it("treats malformed route values as play routes instead of throwing", () => {
    for (const value of [undefined, null, 0, 42, true, false, {}, []]) {
      expect(() => parseRouteIntent(value as never)).not.toThrow();
      expect(parseRouteIntent(value as never)).toEqual({ kind: "play" });
    }
  });

  it("rejects malformed share IDs and encoded separators as play routes", () => {
    expect(parseRouteIntent("/share/record%2F123")).toEqual({ kind: "play" });
    expect(parseRouteIntent("/share/record%5C123")).toEqual({ kind: "play" });
    expect(parseRouteIntent("/share/record%3F123")).toEqual({ kind: "play" });
    expect(parseRouteIntent("intoss://sano-job-seeker/share/record%23abc")).toEqual({ kind: "play" });
    expect(parseRouteIntent("/share/%E0%A4%A")).toEqual({ kind: "play" });
    expect(parseRouteIntent(new URL("https://example.com/share/record%2F123"))).toEqual({ kind: "play" });
  });

  it("normalizes public ending payloads to the exact allowlist and drops extra data", () => {
    const normalized = normalizePublicEndingDto({
      id: "ending-1",
      title: "첫 선택의 끝",
      summary: "요약",
      longNarrative: "긴 서사",
      careerPath: "기획",
      jobRole: "서비스 기획자",
      destinationName: null,
      salaryBand: "4,500만원",
      workplaceTone: ["차분함", 1, null],
      satisfaction: 83,
      growthPotential: 91,
      workLifeBalance: 72,
      healthState: "양호",
      relationshipState: "안정",
      tags: ["태그", 2],
      statSnapshot: { logic: 8, focus: 7, hidden: "ignore" },
      keyRelationships: [
        { name: "민준", role: "동기", trust: 80, hidden: true },
        { name: "", role: "", trust: 0 },
      ],
      majorEvents: [{ summary: "첫 입사" }, { summary: 1 }],
      hiddenState: "ignore me",
    });

    expect(normalized).toEqual({
      id: "ending-1",
      title: "첫 선택의 끝",
      summary: "요약",
      longNarrative: "긴 서사",
      careerPath: "기획",
      jobRole: "서비스 기획자",
      destinationName: null,
      salaryBand: "4,500만원",
      workplaceTone: ["차분함"],
      satisfaction: 83,
      growthPotential: 91,
      workLifeBalance: 72,
      healthState: "양호",
      relationshipState: "안정",
      tags: ["태그"],
      statSnapshot: { logic: 8, focus: 7 },
      keyRelationships: [
        { name: "민준", role: "동기", trust: 80 },
      ],
      majorEvents: [{ summary: "첫 입사" }],
    });
    expect(createEmptyPublicEndingDto()).toMatchObject({
      id: "",
      workplaceTone: [],
      statSnapshot: {},
      keyRelationships: [],
      majorEvents: [],
    });
  });

  it("creates typed Korean-facing host failures", () => {
    expect(createHostFailure("clipboard-failed", "링크를 만들지 못했습니다. 다시 시도해 주세요.")).toEqual({
      code: "clipboard-failed",
      message: "링크를 만들지 못했습니다. 다시 시도해 주세요.",
      retryable: true,
    });
  });

  it("keeps the shared files free of server-only imports", () => {
    const files = [
      resolve(process.cwd(), "lib/game-ui/types.ts"),
      resolve(process.cwd(), "lib/game-ui/host.ts"),
      resolve(process.cwd(), "lib/game-ui/web-host.ts"),
    ];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/next-auth|@apps-in-toss\/web-framework|@\/lib\/server|from "prisma"|from 'prisma'/i);
    }
  });
});
