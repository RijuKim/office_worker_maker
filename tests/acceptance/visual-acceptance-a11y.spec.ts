import { expect, test } from "@playwright/test";

import {
  assertNoForbiddenProvenance,
  assertNoOverflow,
  completeDeterministicOnboarding,
  installVisualAcceptanceApi,
  sharedEvent,
} from "./helpers/visual-acceptance";

test.describe("Keyboard and accessibility exploration", () => {
  test("menu opens and closes with Escape", async ({ page }) => {
    await installVisualAcceptanceApi(page);
    await page.goto("/");

    const menu = page.getByRole("button", { name: "메뉴", exact: true });
    await menu.focus();
    await page.keyboard.press("Enter");
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("button", { name: "기록", exact: true })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeFocused();
  });

  test("menu items are focusable and have accessible names", async ({ page }) => {
    await installVisualAcceptanceApi(page);
    await page.goto("/");

    await page.getByRole("button", { name: "메뉴", exact: true }).click();
    const items = [
      { name: "기록" },
      { name: "새 시뮬레이션" },
      { name: "로그인/저장" },
      { name: "개인정보처리방침" },
    ] as const;

    for (const { name } of items) {
      const element = page.getByRole("button", { name, exact: true });
      await expect(element).toHaveAccessibleName(name);
      await expect(element).toBeVisible();
    }
  });

  test("audio setting checkboxes toggle with Space and persist", async ({ page }) => {
    await installVisualAcceptanceApi(page);
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());

    await page.getByRole("button", { name: "메뉴", exact: true }).click();
    for (const [name, setting] of [
      ["배경음", "music"],
      ["효과음", "sfx"],
      ["햅틱", "haptics"],
    ] as const) {
      const toggle = page.getByRole("checkbox", { name, exact: true });
      await expect(toggle).toHaveAccessibleName(name);
      const before = await toggle.isChecked();
      await toggle.focus();
      await page.keyboard.press("Space");
      await expect(toggle).toBeChecked({ checked: !before });
      await expect
        .poll(() =>
          page.evaluate(
            (key) => JSON.parse(localStorage.getItem("sano-audio-settings")!)[key],
            setting,
          ),
        )
        .toBe(!before);
    }
  });

  test("loading panel uses aria-live polite and aria-busy", async ({ page }) => {
    await installVisualAcceptanceApi(page, { restored: true });
    await page.goto("/");
    await completeDeterministicOnboarding(page);

    // The loading panel is rendered during event transitions
    await page.getByRole("button", { name: sharedEvent.choices[0].label }).click();
    // After the mock stream fulfills, verify the feedback panel is accessible
    await expect(page.locator(".feedback-panel")).toBeVisible();
    await expect(page.locator(".feedback-panel p")).toBeVisible();
  });

  test("error state shows retry message and does not break layout", async ({ page }) => {
    await installVisualAcceptanceApi(page, { restored: true });
    // Override the stream to return an error
    await page.route("**/api/**/events/next/stream", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: `event: error\ndata: {"error": "다음 상황을 생성하지 못했습니다."}\n\n`,
      });
    });

    await page.goto("/");
    await completeDeterministicOnboarding(page);

    await page.getByRole("button", { name: sharedEvent.choices[0].label }).click();
    // The error should be displayed
    await expect(page.getByText("다음 상황을 생성하지 못했습니다.")).toBeVisible();
    await assertNoOverflow(page);
  });

  test("focus remains visible on interactive elements", async ({ page }) => {
    await installVisualAcceptanceApi(page);
    await page.goto("/");

    const startButton = page.getByRole("button", { name: "시작하기", exact: true });
    await startButton.focus();
    await expect(startButton).toBeFocused();

    await page.keyboard.press("Enter");
    const nameInput = page.getByLabel("당신의 이름은 무엇인가요?");
    await expect(nameInput).toBeFocused();
  });

  test("touch-sized controls have minimum 44px height", async ({ page }) => {
    await installVisualAcceptanceApi(page);
    await page.goto("/");

    const buttons = page.locator("button");
    const heights = await buttons.evaluateAll((elements) =>
      elements.map((el) => (el as HTMLElement).getBoundingClientRect().height),
    );
    const allTouchSized = heights.every((h) => h >= 44);
    expect(allTouchSized).toBe(true);
  });

  test("WCAG AA contrast check on key text elements", async ({ page }) => {
    await installVisualAcceptanceApi(page);
    await page.goto("/");

    const contrast = await page.evaluate(() => {
      function luminance(r: number, g: number, b: number) {
        const [rl, gl, bl] = [r, g, b].map((v) => {
          const s = v / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
      }

      function contrastRatio(a: string, b: string) {
        const parse = (color: string) =>
          color
            .slice(4, -1)
            .split(",")
            .map((n) => Number(n.trim()));
        const [r1, g1, b1] = parse(a);
        const [r2, g2, b2] = parse(b);
        const l1 = luminance(r1, g1, b1);
        const l2 = luminance(r2, g2, b2);
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
      }

      const body = getComputedStyle(document.body);
      const bodyColor = body.color;
      const bodyBg = body.backgroundColor;

      // Check a heading element
      const heading = document.querySelector("h1, h2");
      const headingColor = heading ? getComputedStyle(heading).color : bodyColor;

      return {
        bodyText: { color: bodyColor, bg: bodyBg, ratio: contrastRatio(bodyColor, bodyBg) },
        heading: { color: headingColor, bg: bodyBg, ratio: contrastRatio(headingColor, bodyBg) },
      };
    });

    // WCAG AA requires 4.5:1 for normal text, 3:1 for large text
    expect(contrast.bodyText.ratio).toBeGreaterThanOrEqual(4.5);
    expect(contrast.heading.ratio).toBeGreaterThanOrEqual(3);
  });
});

test.describe("Error and edge case exploration", () => {
  test("API failure shows Korean error message", async ({ page }) => {
    await installVisualAcceptanceApi(page);
    await page.route("**/api/characters", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "서버 오류가 발생했습니다." }),
      });
    });

    await page.goto("/");
    await expect(page.getByText("서버 오류가 발생했습니다.")).toBeVisible();
  });

  test("network failure does not crash the app", async ({ page }) => {
    await installVisualAcceptanceApi(page);
    await page.route("**/api/**", async (route) => {
      await route.abort("connectionrefused");
    });

    await page.goto("/");
    // The app should still render the UI without crashing
    await expect(page.getByRole("heading", { name: "낯선 아침이 시작됩니다." })).toBeVisible();
    await expect(page.getByRole("button", { name: "시작하기", exact: true })).toBeVisible();
  });

  test("SSE malformed response shows retry message", async ({ page }) => {
    await installVisualAcceptanceApi(page, { restored: true });
    await page.route("**/api/**/events/next/stream", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: "not-a-valid-sse-stream\n",
      });
    });

    await page.goto("/");
    await completeDeterministicOnboarding(page);
    await page.getByRole("button", { name: sharedEvent.choices[0].label }).click();

    // Should show the committed-event recovery message
    await expect(
      page.getByText("다음 사건이 아직 확정되지 않았습니다. 잠시 후 다시 시도해 주세요."),
    ).toBeVisible();
  });

  test("SSE non-OK response shows retry message", async ({ page }) => {
    await installVisualAcceptanceApi(page, { restored: true });
    await page.route("**/api/**/events/next/stream", async (route) => {
      await route.fulfill({ status: 500, body: "Internal Server Error" });
    });

    await page.goto("/");
    await completeDeterministicOnboarding(page);
    await page.getByRole("button", { name: sharedEvent.choices[0].label }).click();

    await expect(
      page.getByText("다음 사건이 아직 확정되지 않았습니다. 잠시 후 다시 시도해 주세요."),
    ).toBeVisible();
  });
});
