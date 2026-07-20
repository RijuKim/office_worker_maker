import { expect, test } from "@playwright/test";

test("title-aligned combined menu replaces legacy chrome", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /일어나보니\s*대한민국 취준생/ })).toBeVisible();
  await expect(page.getByText("취준 생활 시뮬레이션", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "설정", exact: true })).toHaveCount(0);

  const menu = page.getByRole("button", { name: "메뉴", exact: true });
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("배경음", { exact: true })).toBeVisible();
  await expect(page.getByText("효과음", { exact: true })).toBeVisible();
  await expect(page.getByText("햅틱", { exact: true })).toBeVisible();
  await expect(page.getByText("새 이야기", { exact: true })).toHaveCount(0);
});

test("new run advances one approved question at a time", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("눈을 뜨니 오전 6시 07분입니다.", { exact: false })).toBeVisible();
  await expect(page.getByText("이번에는 어떤 사람이 될 수 있을까요?", { exact: false })).toBeVisible();
  await expect(page.getByText("이 이야기는 실제 진로 예측이 아닌 재미를 위한 허구의 시뮬레이션입니다.", { exact: true })).toBeVisible();
  await expect(page.locator("[data-testid='intro-dawn-art']")).toBeVisible();

  await page.getByRole("button", { name: "시작하기", exact: true }).click();
  await expect(page.getByRole("heading", { name: "당신의 이름은 무엇인가요?" })).toBeVisible();
  await expect(page.getByText("당신의 나이는 몇 살인가요?", { exact: true })).toHaveCount(0);

  await page.getByLabel("당신의 이름은 무엇인가요?").fill("한서윤");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  const age = page.getByLabel("당신의 나이는 몇 살인가요?");
  await expect(age).toBeVisible();
  await expect(age.locator("option")).toHaveCount(63);
  await expect(age.locator("option").first()).toHaveValue("18");
  await expect(age.locator("option").last()).toHaveValue("80");

  await age.selectOption("80");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page.getByRole("button", { name: "본가", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "자취방", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "기숙사", exact: true })).toBeVisible();
  await expect(page.getByText(/선택됨\s*·/)).toHaveCount(0);

  await page.getByRole("button", { name: "자취방", exact: true }).click();
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
});

