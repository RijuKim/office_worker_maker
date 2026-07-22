import { expect, test } from "@playwright/test";

test("title-aligned combined menu replaces legacy chrome", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /일어나보니\s*대한민국 취준생/ })).toBeVisible();
  await expect(page.locator(".app-title > span")).toHaveText(["일어나보니", "대한민국 취준생"]);
  await expect(page.getByText("취준 생활 시뮬레이션", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "설정", exact: true })).toHaveCount(0);

  const menu = page.getByRole("button", { name: "메뉴", exact: true });
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("배경음", { exact: true })).toBeVisible();
  await expect(page.getByText("효과음", { exact: true })).toBeVisible();
  await expect(page.getByText("햅틱", { exact: true })).toBeVisible();
  await expect(page.getByText("새 이야기", { exact: true })).toHaveCount(0);
  const rows = page.locator(".app-menu-popover > button, .app-menu-popover > .menu-row, .menu-settings > .menu-row");
  const rowStyles = await rows.evaluateAll((elements) => elements.map((element) => {
    const style = getComputedStyle(element);
    return { fontSize: style.fontSize, fontWeight: style.fontWeight, height: element.getBoundingClientRect().height };
  }));
  expect(rowStyles.every((row) => row.fontSize === "14px" && row.fontWeight === "800" && row.height >= 44)).toBe(true);
  await menu.focus();
  await expect(menu).toBeFocused();
});

test("new run advances one approved question at a time", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("눈을 뜨니 오전 6시 07분입니다.", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "낯선 아침이 시작됩니다." })).toBeVisible();
  await expect(page.getByText("이번에는 어떤 사람이 될 수 있을까요?", { exact: false })).toBeVisible();
  await expect(page.getByText("이 이야기는 실제 진로 예측이 아닌 재미를 위한 허구의 시뮬레이션입니다.", { exact: true })).toBeVisible();
  await expect(page.locator("[data-testid='intro-dawn-art']")).toBeVisible();
  await expect(page.locator("[data-testid='pixel-scene-intro']")).toHaveAttribute("data-palette", "blue-lilac-apricot-cream");
  await expect(page.locator("[data-testid='intro-scene-svg'] [data-part='computer']")).toHaveCount(1);
  await expect(page.locator("[data-testid='intro-scene-svg'] [data-part*='cross']")).toHaveCount(0);

  await page.getByRole("button", { name: "시작하기", exact: true }).click();
  await expect(page.getByRole("heading", { name: "당신의 이름은 무엇인가요?" })).toBeVisible();
  await expect(page.getByText("당신의 나이는 몇 살인가요?", { exact: true })).toHaveCount(0);

  await page.getByLabel("당신의 이름은 무엇인가요?").fill("한서윤");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  const age = page.getByLabel("당신의 나이는 몇 살인가요?");
  await expect(age).toBeVisible();
  await expect(age.locator("option")).toHaveCount(63);
  await expect(age.locator("option").first()).toHaveAttribute("value", "18");
  await expect(age.locator("option").last()).toHaveAttribute("value", "80");

  await age.selectOption("80");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page.getByRole("button", { name: /^본가/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^자취방/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^기숙사/ })).toBeVisible();
  await expect(page.getByText(/선택됨\s*·/)).toHaveCount(0);

  await page.getByRole("button", { name: /^자취방/ }).click();
  await page.getByRole("button", { name: "이전", exact: true }).click();
  await expect(age).toHaveValue("80");
});

test("mobile title menu and onboarding do not overflow", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "메뉴", exact: true }).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  const geometry = await page.locator(".app-menu-popover").evaluate((element) => {
    const panel = element.getBoundingClientRect();
    const header = document.querySelector(".title-row")!.getBoundingClientRect();
    return { left: panel.left, right: panel.right, headerLeft: header.left, headerRight: header.right };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(geometry.headerLeft - 1);
  expect(geometry.right).toBeLessThanOrEqual(geometry.headerRight + 1);
});

test("desktop menu is right anchored and new simulation returns to intro", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/");
  await page.getByRole("button", { name: "메뉴", exact: true }).click();
  const aligned = await page.locator(".app-menu-popover").evaluate((element) => {
    const panel = element.getBoundingClientRect();
    const header = document.querySelector(".title-row")!.getBoundingClientRect();
    return Math.abs(panel.right - header.right) <= 1;
  });
  expect(aligned).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  await page.getByRole("button", { name: "새 시뮬레이션", exact: true }).click();
  await expect(page.getByRole("heading", { name: "낯선 아침이 시작됩니다." })).toBeVisible();
});

test("every menu row has an accessible name and works with Enter and Space", async ({ page }) => {
  for (const key of ["Enter", "Space"] as const) {
    await page.goto("/");
    const menu = page.getByRole("button", { name: "메뉴", exact: true });
    await menu.focus();
    await page.keyboard.press(key);
    await expect(page.getByRole("button", { name: "기록", exact: true })).toBeFocused();
    await page.keyboard.press(key);
    await expect(page.getByRole("heading", { name: "선택의 결과 기록", exact: true })).toBeVisible();

    await menu.focus();
    await page.keyboard.press(key);
    const newRun = page.getByRole("button", { name: "새 시뮬레이션", exact: true });
    await expect(newRun).toHaveAccessibleName("새 시뮬레이션");
    await newRun.focus();
    await page.keyboard.press(key);
    await expect(page.getByRole("heading", { name: "낯선 아침이 시작됩니다.", exact: true })).toBeVisible();

    await menu.focus();
    await page.keyboard.press(key);
    const login = page.getByRole("button", { name: "로그인/저장", exact: true });
    await expect(login).toHaveAccessibleName("로그인/저장");
    await login.focus();
    await page.keyboard.press(key);
    await expect(page.getByRole("heading", { name: "진행 저장하기", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "로그인", exact: true })).toBeVisible();

    await menu.focus();
    await page.keyboard.press(key);
    const privacy = page.getByRole("button", { name: "개인정보처리방침", exact: true });
    await expect(privacy).toHaveAccessibleName("개인정보처리방침");
    await privacy.focus();
    await page.keyboard.press(key);
    await expect(page).toHaveURL(/\/privacy$/);
  }

  // Native checkboxes toggle with Space. Enter is intentionally not asserted:
  // browsers do not define Enter as checkbox activation.
  for (const key of ["Space"] as const) {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.getByRole("button", { name: "메뉴", exact: true }).click();
    for (const [name, setting] of [["배경음", "music"], ["효과음", "sfx"], ["햅틱", "haptics"]] as const) {
      const toggle = page.getByRole("checkbox", { name, exact: true });
      await expect(toggle).toHaveAccessibleName(name);
      const before = await toggle.isChecked();
      await toggle.focus();
      await page.keyboard.press(key);
      await expect(toggle).toBeChecked({ checked: !before });
      await expect.poll(() => page.evaluate((keyName) => JSON.parse(localStorage.getItem("sano-audio-settings")!)[keyName], setting)).toBe(!before);
    }
  }
});
