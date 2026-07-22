import { spawn, type ChildProcess } from "node:child_process";
import { expect, test } from "@playwright/test";

import {
  assertHeaderAndMenu,
  assertNoForbiddenProvenance,
  assertNoOverflow,
  assertVisualTokens,
  captureScreenshot,
  completeDeterministicOnboarding,
  installVisualAcceptanceApi,
  nextEvent,
  sharedEvent,
  sharedRecords,
  tossVisualOracle,
} from "./helpers/visual-acceptance";

const TOSS_BASE_URL = "http://127.0.0.1:5175";
const EVIDENCE_DIR = ".tenet/runs/2026-07-22-toss-ui-unification/evidence/visual-acceptance-toss";

async function waitForToss() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      if ((await fetch(TOSS_BASE_URL)).ok) return;
    } catch {
      // server is still starting
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Toss Vite server did not become ready");
}

test.describe("Toss visual acceptance — onboarding", () => {
  let server: ChildProcess | undefined;

  test.beforeAll(async () => {
    try {
      if (!(await fetch(TOSS_BASE_URL)).ok) throw new Error();
    } catch {
      server = spawn("npm", ["run", "toss:dev", "--", "--host", "127.0.0.1", "--port", "5175", "--strictPort"], {
        cwd: process.cwd(),
        stdio: "ignore",
        detached: true,
        env: { ...process.env, VITE_TOSS_DEV_USER_KEY: "deterministic-browser-user" },
      });
      await waitForToss();
    }
  });

  test.afterAll(() => {
    if (server?.pid) process.kill(-server.pid, "SIGTERM");
  });

  test("intro step renders the approved dawn art without account action", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "one Chromium run covers Toss simulation");
    await installVisualAcceptanceApi(page, { tossSession: true });
    await page.addInitScript(() => sessionStorage.clear());
    await page.goto(TOSS_BASE_URL);

    await expect(page.getByText("눈을 뜨니 오전 6시 07분입니다.", { exact: false })).toBeVisible();
    await expect(page.getByRole("heading", { name: "낯선 아침이 시작됩니다." })).toBeVisible();
    await expect(page.locator("[data-testid='intro-dawn-art']")).toBeVisible();
    await expect(page.locator("[data-testid='pixel-scene-intro']")).toHaveAttribute("data-palette", "blue-lilac-apricot-cream");
    await expect(page.getByRole("button", { name: "시작하기", exact: true })).toBeVisible();
    await assertNoForbiddenProvenance(page);
    await assertNoOverflow(page);
  });

  test("onboarding completes and shows event with Toss host variant", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "one Chromium run covers Toss simulation");
    await installVisualAcceptanceApi(page, { restored: true, tossSession: true });
    await page.addInitScript(() => sessionStorage.clear());
    await page.goto(TOSS_BASE_URL);
    await completeDeterministicOnboarding(page);

    await expect(page.locator(".event-panel h2")).toHaveText(sharedEvent.title);
    await expect(page.locator(".choice-stack button")).toHaveCount(3);
    await expect(page.locator(".stats-grid")).toBeVisible();
    for (const selector of tossVisualOracle.structures.gameplay) {
      await expect(page.locator(selector)).toHaveCount(1);
    }
    // Toss host should NOT show account action
    await assertHeaderAndMenu(page, 1280, false);
    await assertVisualTokens(page, tossVisualOracle);
    await assertNoForbiddenProvenance(page);
    await assertNoOverflow(page);
  });

  test("choice feedback works in Toss host", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "one Chromium run covers Toss simulation");
    await installVisualAcceptanceApi(page, { restored: true, tossSession: true });
    await page.addInitScript(() => sessionStorage.clear());
    await page.goto(TOSS_BASE_URL);
    await completeDeterministicOnboarding(page);

    await page.getByRole("button", { name: sharedEvent.choices[0].label }).click();
    await expect(page.locator(".feedback-panel strong")).toHaveText("실무 +2");
    await expect(page.locator(".feedback-panel p")).toHaveText(
      "차분한 답장으로 준비할 시간을 확보했습니다.",
    );
    await expect(page.locator(".event-panel h2")).toHaveText(nextEvent.title);
    await expect(page.locator(".choice-stack button")).toHaveCount(2);
    await assertNoForbiddenProvenance(page);
    await assertNoOverflow(page);
  });

  test("records list shows populated cards in Toss host", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "one Chromium run covers Toss simulation");
    await installVisualAcceptanceApi(page, { restored: true, records: true, tossSession: true });
    await page.addInitScript(() => sessionStorage.clear());
    await page.goto(TOSS_BASE_URL);
    await completeDeterministicOnboarding(page);

    await page.getByRole("button", { name: "메뉴", exact: true }).click();
    await page.getByRole("button", { name: "기록", exact: true }).click();
    await expect(page.locator("article.record-panel")).toHaveCount(2);
    await expect(page.getByRole("button", { name: "🔗 링크 복사" }).first()).toBeVisible();
    await assertNoForbiddenProvenance(page);
    await assertNoOverflow(page);
  });

  test("records empty state in Toss host", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "one Chromium run covers Toss simulation");
    await installVisualAcceptanceApi(page, { restored: true, records: false, tossSession: true });
    await page.addInitScript(() => sessionStorage.clear());
    await page.goto(TOSS_BASE_URL);
    await completeDeterministicOnboarding(page);

    await page.getByRole("button", { name: "메뉴", exact: true }).click();
    await page.getByRole("button", { name: "기록", exact: true }).click();
    await expect(page.getByText("아직 남겨진 기록이 없습니다.")).toBeVisible();
    await assertNoOverflow(page);
  });
});

test.describe("Toss visual acceptance — responsive layout", () => {
  let server: ChildProcess | undefined;

  test.beforeAll(async () => {
    try {
      if (!(await fetch(TOSS_BASE_URL)).ok) throw new Error();
    } catch {
      server = spawn("npm", ["run", "toss:dev", "--", "--host", "127.0.0.1", "--port", "5175", "--strictPort"], {
        cwd: process.cwd(),
        stdio: "ignore",
        detached: true,
        env: { ...process.env, VITE_TOSS_DEV_USER_KEY: "deterministic-browser-user" },
      });
      await waitForToss();
    }
  });

  test.afterAll(() => {
    if (server?.pid) process.kill(-server.pid, "SIGTERM");
  });

  test("Toss menu has responsive geometry at 390, 720, 721, and 1024", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "one Chromium run covers all explicit viewport widths");
    await installVisualAcceptanceApi(page, { tossSession: true });
    await page.addInitScript(() => sessionStorage.clear());

    for (const width of [390, 720, 721, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(TOSS_BASE_URL);
      await page.getByRole("button", { name: "메뉴", exact: true }).click();

      const layout = await page.evaluate(() => {
        const root = document.documentElement;
        const row = document.querySelector<HTMLElement>(".title-row")!.getBoundingClientRect();
        const menu = document.querySelector<HTMLElement>(".menu-popover")!.getBoundingClientRect();
        const items = [
          ...document.querySelectorAll<HTMLElement>(
            ".menu-popover > button, .menu-popover > .menu-row, .menu-popover .menu-settings > .menu-row",
          ),
        ].map((item) => {
          const style = getComputedStyle(item);
          return {
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            height: item.getBoundingClientRect().height,
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

      expect(layout.scrollWidth).toBe(layout.clientWidth);
      expect(layout.items.length).toBeGreaterThanOrEqual(5);
      expect(
        layout.items.every(
          (item) => item.fontSize === "14px" && item.fontWeight === "800" && item.height >= 44,
        ),
      ).toBe(true);

      if (width <= 720) {
        expect(Math.abs(layout.menu.left - layout.row.left)).toBeLessThanOrEqual(1);
        expect(layout.menu.width).toBeGreaterThanOrEqual(layout.row.width);
        expect(layout.menu.width - layout.row.width).toBeLessThanOrEqual(24);
      } else {
        expect(Math.abs(layout.menu.right - layout.row.right)).toBeLessThanOrEqual(1);
        expect(layout.menu.width).toBeLessThan(layout.row.width);
      }
    }
  });

  test("Toss 390x844 play surface does not overflow", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "one Chromium run covers Toss simulation");
    await installVisualAcceptanceApi(page, { restored: true, tossSession: true });
    await page.addInitScript(() => sessionStorage.clear());
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(TOSS_BASE_URL);
    await completeDeterministicOnboarding(page);

    const choice = page.locator(".choice-stack button").first();
    const box = await choice.boundingBox();
    expect(box ? box.width : 391).toBeLessThanOrEqual(390);
    await assertNoOverflow(page);
  });
});

test.describe("Toss visual acceptance — screenshots", () => {
  let server: ChildProcess | undefined;

  test.beforeAll(async () => {
    try {
      if (!(await fetch(TOSS_BASE_URL)).ok) throw new Error();
    } catch {
      server = spawn("npm", ["run", "toss:dev", "--", "--host", "127.0.0.1", "--port", "5175", "--strictPort"], {
        cwd: process.cwd(),
        stdio: "ignore",
        detached: true,
        env: { ...process.env, VITE_TOSS_DEV_USER_KEY: "deterministic-browser-user" },
      });
      await waitForToss();
    }
  });

  test.afterAll(() => {
    if (server?.pid) process.kill(-server.pid, "SIGTERM");
  });

  test("capture key Toss screens at 390x844", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "screenshots captured once in desktop project");
    await installVisualAcceptanceApi(page, { restored: true, records: true, tossSession: true });
    await page.addInitScript(() => sessionStorage.clear());
    await page.setViewportSize({ width: 390, height: 844 });

    // Onboarding intro
    await page.goto(TOSS_BASE_URL);
    await captureScreenshot(page, "toss-onboarding-intro", { width: 390, height: 844 }, EVIDENCE_DIR);

    // Onboarding name step
    await page.getByRole("button", { name: "시작하기", exact: true }).click();
    await captureScreenshot(page, "toss-onboarding-name", { width: 390, height: 844 }, EVIDENCE_DIR);

    // Onboarding age step
    await page.getByLabel("당신의 이름은 무엇인가요?").fill("한서윤");
    await page.getByRole("button", { name: "다음", exact: true }).click();
    await captureScreenshot(page, "toss-onboarding-age", { width: 390, height: 844 }, EVIDENCE_DIR);

    // Onboarding residence step
    await page.getByLabel("당신의 나이는 몇 살인가요?").selectOption("24");
    await page.getByRole("button", { name: "다음", exact: true }).click();
    await captureScreenshot(page, "toss-onboarding-residence", { width: 390, height: 844 }, EVIDENCE_DIR);

    // Onboarding abilities step
    await page.getByRole("button", { name: /^자취방/ }).click();
    await page.getByRole("button", { name: "다음", exact: true }).click();
    await captureScreenshot(page, "toss-onboarding-abilities", { width: 390, height: 844 }, EVIDENCE_DIR);

    // Play surface with event
    await page.getByRole("button", { name: "실무", exact: true }).click();
    await page.getByRole("button", { name: "멘탈", exact: true }).click();
    await page.getByRole("button", { name: "눈을 뜬다", exact: true }).click();
    await expect(page.locator(".event-panel h2")).toHaveText(sharedEvent.title);
    await captureScreenshot(page, "toss-gameplay-event", { width: 390, height: 844 }, EVIDENCE_DIR);

    // Menu open
    await page.getByRole("button", { name: "메뉴", exact: true }).click();
    await captureScreenshot(page, "toss-gameplay-menu", { width: 390, height: 844 }, EVIDENCE_DIR);
    await page.getByRole("button", { name: "메뉴", exact: true }).click();

    // Records
    await page.getByRole("button", { name: "메뉴", exact: true }).click();
    await page.getByRole("button", { name: "기록", exact: true }).click();
    await expect(page.locator("article.record-panel")).toHaveCount(2);
    await captureScreenshot(page, "toss-records-populated", { width: 390, height: 844 }, EVIDENCE_DIR);
  });
});
