import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Visual acceptance contracts", () => {
  it("defines a shared visual oracle with web and Toss tokens", () => {
    const helper = read("tests/acceptance/helpers/visual-acceptance.ts");
    expect(helper).toContain("webVisualOracle");
    expect(helper).toContain("tossVisualOracle");
    expect(helper).toContain("shellBackground");
    expect(helper).toContain("panelBackground");
    expect(helper).toContain("text");
    expect(helper).toContain("border");
    expect(helper).toContain("radius");
  });

  it("defines safe-area mask rectangles for Toss host", () => {
    const helper = read("tests/acceptance/helpers/visual-acceptance.ts");
    expect(helper).toContain("getTossSafeAreaMasks");
    expect(helper).toContain("tossVisualOracle.safeArea.top");
    expect(helper).toContain("tossVisualOracle.safeArea.bottom");
  });

  it("provides a pixel-difference calculator with mask support", () => {
    const helper = read("tests/acceptance/helpers/visual-acceptance.ts");
    expect(helper).toContain("computePixelDifference");
    expect(helper).toContain("differingPixels");
    expect(helper).toContain("totalUnmaskedPixels");
  });

  it("provides deterministic mock API installation for both hosts", () => {
    const helper = read("tests/acceptance/helpers/visual-acceptance.ts");
    expect(helper).toContain("installVisualAcceptanceApi");
    expect(helper).toContain("tossSession");
    expect(helper).toContain("restorePopulatedCharacter");
    expect(helper).toContain("setRecords");
  });

  it("defines shared test fixtures for character, event, and records", () => {
    const helper = read("tests/acceptance/helpers/visual-acceptance.ts");
    expect(helper).toContain("sharedCharacter");
    expect(helper).toContain("sharedEvent");
    expect(helper).toContain("sharedRecords");
    expect(helper).toContain("nextEvent");
    expect(helper).toContain("한서윤");
    expect(helper).toContain("첫 면접 제안");
  });

  it("provides a deterministic onboarding flow helper", () => {
    const helper = read("tests/acceptance/helpers/visual-acceptance.ts");
    expect(helper).toContain("completeDeterministicOnboarding");
    expect(helper).toContain("시작하기");
    expect(helper).toContain("눈을 뜬다");
  });

  it("provides assertion helpers for header, menu, tokens, overflow, and provenance", () => {
    const helper = read("tests/acceptance/helpers/visual-acceptance.ts");
    expect(helper).toContain("assertHeaderAndMenu");
    expect(helper).toContain("assertVisualTokens");
    expect(helper).toContain("assertNoForbiddenProvenance");
    expect(helper).toContain("assertNoOverflow");
    expect(helper).toContain("forbiddenProvenance");
  });

  it("defines a screenshot capture helper", () => {
    const helper = read("tests/acceptance/helpers/visual-acceptance.ts");
    expect(helper).toContain("captureScreenshot");
    expect(helper).toContain("fullPage: true");
  });

  it("creates a web visual acceptance spec with onboarding, gameplay, responsive, and screenshot tests", () => {
    expect(existsSync(resolve(root, "tests/acceptance/visual-acceptance-web.spec.ts"))).toBe(true);
    const spec = read("tests/acceptance/visual-acceptance-web.spec.ts");
    expect(spec).toContain("Web visual acceptance — onboarding");
    expect(spec).toContain("Web visual acceptance — gameplay");
    expect(spec).toContain("Web visual acceptance — responsive layout");
    expect(spec).toContain("Web visual acceptance — screenshots");
    expect(spec).toContain("390x844");
    expect(spec).toContain("1504x900");
  });

  it("creates a Toss visual acceptance spec with Vite server, onboarding, responsive, and screenshot tests", () => {
    expect(existsSync(resolve(root, "tests/acceptance/visual-acceptance-toss.spec.ts"))).toBe(true);
    const spec = read("tests/acceptance/visual-acceptance-toss.spec.ts");
    expect(spec).toContain("Toss visual acceptance — onboarding");
    expect(spec).toContain("Toss visual acceptance — responsive layout");
    expect(spec).toContain("Toss visual acceptance — screenshots");
    expect(spec).toContain("toss:dev");
    expect(spec).toContain("5175");
  });

  it("creates a keyboard/a11y/error exploration spec", () => {
    expect(existsSync(resolve(root, "tests/acceptance/visual-acceptance-a11y.spec.ts"))).toBe(true);
    const spec = read("tests/acceptance/visual-acceptance-a11y.spec.ts");
    expect(spec).toContain("Keyboard and accessibility exploration");
    expect(spec).toContain("Error and edge case exploration");
    expect(spec).toContain("Escape");
    expect(spec).toContain("aria-live");
    expect(spec).toContain("WCAG AA");
    expect(spec).toContain("SSE");
  });

  it("keeps the visual oracle tokens consistent with the production CSS", () => {
    const styles = read("lib/game-ui/styles.css");
    const helper = read("tests/acceptance/helpers/visual-acceptance.ts");
    // The production shell background is #17263f
    expect(styles).toContain("#17263f");
    expect(helper).toContain("23, 38, 63");
    // The production panel background is #fff8e8
    expect(styles).toContain("#fff8e8");
    expect(helper).toContain("255, 248, 232");
    // The production border color is #2a2018
    expect(styles).toContain("#2a2018");
    expect(helper).toContain("42, 32, 24");
  });

  it("forbids AI provenance strings in both host UIs", () => {
    const helper = read("tests/acceptance/helpers/visual-acceptance.ts");
    expect(helper).toContain("AI 사건");
    expect(helper).toContain("FALLBACK");
    expect(helper).toContain("provider");
    expect(helper).toContain("source");
  });
});
