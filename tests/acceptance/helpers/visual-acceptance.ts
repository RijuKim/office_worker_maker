import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, type Page, type Route } from "@playwright/test";

// ── Shared Test Fixtures ──────────────────────────────────────────────

export const sharedEvent = {
  id: "event-1",
  title: "첫 면접 제안",
  body: "예상보다 이른 시간에 면접 제안이 도착했습니다.\n회사 메일을 확인하니 면접 일정 조율 요청이 와 있습니다.",
  source: "STATIC",
  choices: [
    { id: "choice-1", label: "담당자에게 가능한 시간을 묻는다", statDelta: { practical: 2 } },
    { id: "choice-2", label: "기업 정보를 먼저 정리한다", statDelta: { academic: 1 } },
    { id: "choice-3", label: "친구에게 모의 면접을 부탁한다", statDelta: { mental: 1 } },
  ],
};

export const nextEvent = {
  id: "event-2",
  title: "면접 준비의 밤",
  body: "답장을 보낸 뒤 준비할 항목을 차분히 펼쳐 봅니다.",
  source: "FALLBACK",
  choices: [
    { id: "choice-4", label: "경험을 직무와 연결해 본다", statDelta: { practical: 1 } },
    { id: "choice-5", label: "충분히 쉬고 내일 이어간다", statDelta: { health: 1 } },
  ],
};

export const sharedCharacter = {
  id: "run-1",
  name: "한서윤",
  age: 24,
  startGradeYear: 2,
  currentGradeYear: 2,
  major: "사회학과",
  academicStatus: "ENROLLED",
  currentEventId: sharedEvent.id,
  progressLabel: "2학년 1학기",
  relationships: [
    { name: "지민 선배", role: "동아리 선배", trust: 60, tags: ["동아리", "멘토"] },
    { name: "민하", role: "친구", trust: 40, tags: ["동기"] },
  ],
  eventHistory: [{ summary: "첫 면접 제안을 받았다.", createdAt: new Date().toISOString() }],
  coreEventCount: 1,
  stats: {
    academic: 5,
    practical: 5,
    communication: 4,
    creativity: 4,
    health: 5,
    mental: 5,
    network: 3,
    wealth: 120,
    reputation: 3,
    charm: 4,
  },
  events: [sharedEvent],
};

export const sharedRecords = [
  {
    id: "record-1",
    title: "첫 학기를 마쳤습니다",
    summary: "작은 선택들이 한 학기의 기록으로 남았습니다.",
    longNarrative:
      "한서윤은 차분하게 준비해 첫 면접을 마쳤습니다. 예상보다 까다로운 질문들이 있었지만 포트폴리오를 꼼꼼히 준비한 덕분에 자신 있게 답변할 수 있었습니다.",
    careerPath: "서비스 기획",
    jobRole: "서비스 기획자",
    destinationName: "가상 기업",
    salaryBand: "4,500만원",
    workplaceTone: ["차분함", "협력적"],
    satisfaction: 84,
    growthPotential: 91,
    workLifeBalance: 73,
    healthState: "양호",
    relationshipState: "안정",
    tags: ["첫 도전", "성장"],
    statSnapshot: { academic: 5, practical: 6, health: 4, mental: 5 },
    keyRelationships: [{ name: "지민 선배", role: "동아리 선배", trust: 60 }],
    majorEvents: [{ summary: "첫 면접 제안을 수락하고 준비했다." }],
  },
  {
    id: "record-2",
    title: "인턴 생활을 마쳤습니다",
    summary: "낯선 업무를 끝까지 배워 냈습니다.",
    longNarrative:
      "인턴 기간 동안 실무 경험을 쌓으며 직무 적응력을 키웠습니다. 팀원들의 피드백을 적극적으로 반영해 성장했습니다.",
    careerPath: "마케팅",
    jobRole: "마케터",
    destinationName: "스타트업",
    salaryBand: "3,800만원",
    workplaceTone: ["빠름", "도전적"],
    satisfaction: 72,
    growthPotential: 85,
    workLifeBalance: 58,
    healthState: "보통",
    relationshipState: "우호",
    tags: ["인턴", "성장"],
    statSnapshot: { academic: 4, practical: 7, health: 3, mental: 4 },
    keyRelationships: [],
    majorEvents: [],
  },
];

// ── Visual Oracle ────────────────────────────────────────────────────

export const webVisualOracle = {
  structures: {
    onboarding: [
      "section.screen-stack",
      "section.create-step",
      "button.primary-button",
    ],
    gameplay: [
      "section.screen-stack",
      "article.event-panel",
      "div.choice-stack",
    ],
    feedback: [
      "section.screen-stack",
      "div.feedback-panel",
      "article.event-panel",
      "div.choice-stack",
    ],
    loading: [
      "div.event-loading-panel",
      "div.event-loading-scene",
      "div.event-loading-copy",
    ],
    character: [
      "section.screen-stack",
      "div.character-sheet",
      "div.character-portrait-stage",
      "div.character-sheet-body",
    ],
    relationships: [
      "section.screen-stack",
      "div.relationship-grid",
      "div.relationship-card",
    ],
    records: [
      "main.records-screen",
      "article.record-card",
      "div.record-hero",
    ],
    menu: [
      "nav.app-menu-popover",
      "button[aria-label='메뉴']",
    ],
  },
  tokens: {
    shellBackground: "rgb(23, 38, 63)",
    panelBackground: "rgb(255, 248, 232)",
    controlBackground: "rgb(255, 248, 232)",
    text: "rgb(42, 36, 30)",
    muted: "rgb(112, 107, 98)",
    border: "rgb(42, 32, 24)",
    radius: "6px",
    panelPadding: "24px",
    stackGap: "24px",
  },
  safeArea: {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
} as const;

export const tossVisualOracle = {
  structures: webVisualOracle.structures,
  tokens: webVisualOracle.tokens,
  safeArea: {
    top: 44,
    right: 0,
    bottom: 34,
    left: 0,
  },
} as const;

export const forbiddenProvenance = /(?:^|\s)AI(?:\s|$)|AI 사건|FALLBACK|provider|source/i;

// ── Mock API Installation ─────────────────────────────────────────────

export interface MockApiController {
  requests: Array<{ path: string; method: string; body: unknown }>;
  restorePopulatedCharacter(): void;
  setRecords(records: typeof sharedRecords): void;
  setCharacter(character: typeof sharedCharacter): void;
}

export async function installVisualAcceptanceApi(
  page: Page,
  options: {
    restored?: boolean;
    records?: boolean;
    tossSession?: boolean;
  } = {},
): Promise<MockApiController> {
  let restored = options.restored ?? false;
  let recordPayload = options.records ? sharedRecords : [];
  let characterPayload = sharedCharacter;
  const requests: Array<{ path: string; method: string; body: unknown }> = [];

  await page.route("**/api/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const body = request.postData() ? JSON.parse(request.postData()!) : undefined;
    requests.push({ path, method: request.method(), body });

    if (path.endsWith("/events/next/stream")) {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: `event: event\ndata: ${JSON.stringify({ event: nextEvent })}\n\n`,
      });
      return;
    }

    if (options.tossSession && path.endsWith("/toss/session")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ token: "deterministic-toss-session-token" }),
      });
      return;
    }

    const json =
      path === "/api/characters" && request.method() === "POST"
        ? { character: characterPayload }
        : path === "/api/characters"
          ? { characters: restored ? [characterPayload] : [] }
          : path === `/api/characters/${characterPayload.id}`
            ? { character: characterPayload, currentEvent: sharedEvent }
            : path === `/api/characters/${characterPayload.id}/choices`
              ? {
                  result: {
                    stats: { ...characterPayload.stats, practical: 7 },
                    statDelta: { practical: 2 },
                    relationshipDelta: [{ name: "지민 선배", trust: 4 }],
                    summary: "차분한 답장으로 준비할 시간을 확보했습니다.",
                    endingTriggered: false,
                  },
                }
              : path === `/api/characters/${characterPayload.id}/events/next`
                ? { event: nextEvent }
                : path === "/api/records"
                  ? { records: recordPayload }
                  : path.includes("/specs")
                    ? { specs: [] }
                    : path.includes("/job-applications")
                      ? { jobApplications: [] }
                      : path.includes("/career-paths")
                        ? { paths: [] }
                        : {};

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(json),
    });
  });

  return {
    requests,
    restorePopulatedCharacter() {
      restored = true;
    },
    setRecords(records: typeof sharedRecords) {
      recordPayload = records;
    },
    setCharacter(character: typeof sharedCharacter) {
      characterPayload = character;
    },
  };
}

// ── Deterministic Onboarding Flow ─────────────────────────────────────

export async function completeDeterministicOnboarding(page: Page, name = "한서윤") {
  await expect(page.getByRole("button", { name: "시작하기", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "시작하기", exact: true }).click();
  await page.getByLabel("당신의 이름은 무엇인가요?").fill(name);
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByLabel("당신의 나이는 몇 살인가요?").selectOption("24");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("button", { name: /^자취방/ }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("button", { name: "실무", exact: true }).click();
  await page.getByRole("button", { name: "멘탈", exact: true }).click();
  await page.getByRole("button", { name: "눈을 뜬다", exact: true }).click();
}

// ── Screenshot Capture ───────────────────────────────────────────────

export async function captureScreenshot(
  page: Page,
  name: string,
  viewport: { width: number; height: number },
  evidenceDir: string,
) {
  const filename = `${name}-${viewport.width}x${viewport.height}.png`;
  const path = resolve(evidenceDir, filename);
  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({ path, fullPage: true });
  return path;
}

// ── Mask Definitions ─────────────────────────────────────────────────

export interface MaskRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Returns safe-area mask rectangles for the Toss host.
 * These are the regions where Toss WebView chrome (status bar, home indicator)
 * may cause pixel differences between web and Toss screenshots.
 */
export function getTossSafeAreaMasks(viewport: { width: number; height: number }): MaskRect[] {
  const masks: MaskRect[] = [];
  // Top safe area (status bar area)
  if (tossVisualOracle.safeArea.top > 0) {
    masks.push({ x: 0, y: 0, width: viewport.width, height: tossVisualOracle.safeArea.top });
  }
  // Bottom safe area (home indicator area)
  if (tossVisualOracle.safeArea.bottom > 0) {
    masks.push({
      x: 0,
      y: viewport.height - tossVisualOracle.safeArea.bottom,
      width: viewport.width,
      height: tossVisualOracle.safeArea.bottom,
    });
  }
  return masks;
}

/**
 * Computes the pixel-difference ratio between two screenshots.
 * Returns a value between 0 (identical) and 1 (completely different).
 * Masks are regions to exclude from comparison (e.g., safe-area, font antialiasing).
 */
export function computePixelDifference(
  actualPixels: Uint8ClampedArray,
  baselinePixels: Uint8ClampedArray,
  width: number,
  height: number,
  masks: MaskRect[] = [],
): number {
  if (actualPixels.length !== baselinePixels.length) {
    return 1;
  }

  const isMasked = (x: number, y: number): boolean =>
    masks.some((m) => x >= m.x && x < m.x + m.width && y >= m.y && y < m.y + m.height);

  let differingPixels = 0;
  let totalUnmaskedPixels = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isMasked(x, y)) continue;
      totalUnmaskedPixels++;
      const idx = (y * width + x) * 4;
      // Compare RGBA channels with a small tolerance for font antialiasing
      const dr = Math.abs(actualPixels[idx] - baselinePixels[idx]);
      const dg = Math.abs(actualPixels[idx + 1] - baselinePixels[idx + 1]);
      const db = Math.abs(actualPixels[idx + 2] - baselinePixels[idx + 2]);
      if (dr > 3 || dg > 3 || db > 3) {
        differingPixels++;
      }
    }
  }

  return totalUnmaskedPixels > 0 ? differingPixels / totalUnmaskedPixels : 0;
}

// ── Assertion Helpers ────────────────────────────────────────────────

export async function assertHeaderAndMenu(
  page: Page,
  width: number,
  expectAccountAction: boolean,
) {
  expect(await page.locator(".app-title > span").allTextContents()).toEqual([
    "일어나보니",
    "대한민국 취준생",
  ]);

  await page.getByRole("button", { name: "메뉴", exact: true }).click();

  const geometry = await page.evaluate(() => {
    const root = document.documentElement;
    const row = document.querySelector<HTMLElement>(".title-row")!.getBoundingClientRect();
    const menu = document.querySelector<HTMLElement>(".menu-popover")!.getBoundingClientRect();
    const items = [
      ...document.querySelectorAll<HTMLElement>(
        ".menu-popover > button, .menu-popover > .menu-row, .menu-popover .menu-settings > .menu-row",
      ),
    ].map((node) => {
      const style = getComputedStyle(node);
      return {
        size: style.fontSize,
        weight: style.fontWeight,
        height: node.getBoundingClientRect().height,
      };
    });
    return {
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      row: { left: row.left, right: row.right, width: row.width },
      menu: { left: menu.left, right: menu.right, width: menu.width },
      items,
    };
  });

  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
  expect(geometry.items.every((item) => item.size === "14px" && item.weight === "800" && item.height >= 44)).toBe(true);

  if (width <= 720) {
    expect(Math.abs(geometry.menu.left - geometry.row.left)).toBeLessThanOrEqual(1);
    expect(geometry.menu.width).toBeGreaterThanOrEqual(geometry.row.width);
    expect(geometry.menu.width - geometry.row.width).toBeLessThanOrEqual(24);
  } else {
    expect(Math.abs(geometry.menu.right - geometry.row.right)).toBeLessThanOrEqual(1);
  }

  // Check account action visibility
  const accountButton = page.getByRole("button", { name: /계정|로그인/ });
  if (expectAccountAction) {
    await expect(accountButton).toBeVisible();
  } else {
    await expect(accountButton).toHaveCount(0);
  }

  // Close menu
  await page.getByRole("button", { name: "메뉴", exact: true }).click();
}

export async function assertVisualTokens(page: Page, oracle: { tokens: typeof webVisualOracle.tokens }) {
  const measured = await page.evaluate(() => {
    const style = (selector: string) => getComputedStyle(document.querySelector<HTMLElement>(selector)!);
    const panel = document.querySelector<HTMLElement>(".pixel-panel");
    const panelStyle = panel ? style(".pixel-panel") : null;
    return {
      shellBackground: style("body").backgroundColor,
      panelBackground: panelStyle?.backgroundColor ?? "",
      text: panelStyle?.color ?? "",
      border: panelStyle?.borderColor ?? "",
      radius: panelStyle?.borderRadius ?? "",
    };
  });

  expect(measured.shellBackground).toBe(oracle.tokens.shellBackground);
  expect(measured.panelBackground).toBe(oracle.tokens.panelBackground);
  expect(measured.text).toBe(oracle.tokens.text);
  expect(measured.border).toBe(oracle.tokens.border);
  expect(measured.radius).toBe(oracle.tokens.radius);
}

export async function assertNoForbiddenProvenance(page: Page) {
  const bodyText = await page.locator("body").innerText();
  expect(bodyText).not.toMatch(forbiddenProvenance);
}

export async function assertNoOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
}
