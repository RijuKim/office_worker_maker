import { expect, test, type Page } from "@playwright/test";

import { CODEX_CATALOG } from "@/lib/game/codex-catalog";

test.use({ baseURL: "http://localhost:3000" });

const password = "Password123!";
const TOTAL_SLOTS = CODEX_CATALOG.length;

async function signUpAndCreateCharacter(page: Page, email: string) {
  await page.goto("/");
  await page.getByRole("link", { name: /회원가입|가입|sign up/i }).click();
  await page.getByLabel(/이메일|email/i).fill(email);
  await page.getByLabel(/비밀번호|password/i).fill(password);
  await page.getByRole("button", { name: /회원가입|가입|sign up/i }).click();
  await expect(page.getByText(/캐릭터|character/i)).toBeVisible();

  await page.getByRole("button", { name: /새 캐릭터|캐릭터 만들기|create/i }).click();
  await page.getByLabel(/이름|name/i).fill("한서윤");
  await page.getByLabel(/나이|age/i).selectOption({ label: "21" });
  await page.getByLabel(/학년|grade|year/i).selectOption({ label: "2" });
  await page.getByLabel(/전공|과|major/i).selectOption({ label: "사회학과" });
  await page.getByRole("button", { name: /시작|생성|create/i }).click();
  await expect(page.getByText("한서윤")).toBeVisible();
}

async function seedEndingRecords(page: Page, count: number) {
  await page.evaluate(async (n) => {
    try {
      await fetch("/api/test/records/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: n }),
      });
    } catch {
      // Seed endpoint is test-only and may be absent in some environments;
      // the test still asserts on rendered UI so it degrades gracefully.
    }
  }, count);
}

async function openCodexTab(page: Page) {
  await page.goto("/records");
  await page.getByRole("tab", { name: "도감" }).click();
  await expect(page.getByRole("tab", { name: "도감" })).toHaveAttribute("aria-selected", "true");
}

function codexCards(page: Page) {
  return page.getByRole("button").filter({ has: page.locator("h3") });
}

test.describe("ending codex", () => {
  test("empty user: shows all locked slots with progress 0/N", async ({ page }) => {
    const email = `codex-empty-${Date.now()}@example.com`;
    await signUpAndCreateCharacter(page, email);
    await openCodexTab(page);

    await expect(
      page.getByRole("heading", { name: new RegExp(`0\\s*/\\s*${TOTAL_SLOTS}\\s*달성`) }),
    ).toBeVisible();

    const lockedTitles = page.getByRole("heading", { name: "???" });
    await expect(lockedTitles.first()).toBeVisible();
    expect(await lockedTitles.count()).toBeGreaterThanOrEqual(TOTAL_SLOTS);

    const firstHint = CODEX_CATALOG[0].categoryHint;
    await expect(page.getByText(firstHint).first()).toBeVisible();

    for (const slot of CODEX_CATALOG.slice(0, 5)) {
      await expect(page.getByRole("heading", { name: slot.title, exact: true })).toHaveCount(0);
    }
  });

  test("partial user: shows some unlocked slots", async ({ page }) => {
    const email = `codex-partial-${Date.now()}@example.com`;
    await signUpAndCreateCharacter(page, email);
    await seedEndingRecords(page, 3);
    await openCodexTab(page);

    const progressHeading = page
      .getByRole("heading", { name: /\d+\s*\/\s*\d+\s*달성/ })
      .first();
    await expect(progressHeading).toBeVisible();
    const progressText = (await progressHeading.textContent()) ?? "";
    const match = progressText.match(/(\d+)\s*\/\s*(\d+)\s*달성/);
    expect(match).not.toBeNull();
    const unlockedCount = Number(match?.[1] ?? 0);
    const totalCount = Number(match?.[2] ?? 0);
    expect(unlockedCount).toBeGreaterThan(0);
    expect(totalCount).toBe(TOTAL_SLOTS);

    await expect(page.getByRole("heading", { name: "???" }).first()).toBeVisible();

    const unlockedCards = codexCards(page).filter({ hasNotText: "???" });
    await expect(unlockedCards.first()).toBeVisible();
    expect(await unlockedCards.count()).toBeGreaterThan(0);

    await unlockedCards.first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("tab switching: records tab is default", async ({ page }) => {
    const email = `codex-tabs-${Date.now()}@example.com`;
    await signUpAndCreateCharacter(page, email);
    await page.goto("/records");

    const recordsTab = page.getByRole("tab", { name: "내 기록" });
    const codexTab = page.getByRole("tab", { name: "도감" });

    await expect(recordsTab).toBeVisible();
    await expect(codexTab).toBeVisible();
    await expect(recordsTab).toHaveAttribute("aria-selected", "true");
    await expect(codexTab).toHaveAttribute("aria-selected", "false");

    await expect(
      page.getByText(/아직 저장된 기록이 없습니다|선택의 결과 기록/).first(),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: /\d+\s*\/\s*\d+\s*달성/ })).toHaveCount(0);

    await codexTab.click();
    await expect(codexTab).toHaveAttribute("aria-selected", "true");
    await expect(recordsTab).toHaveAttribute("aria-selected", "false");
    await expect(
      page.getByRole("heading", { name: /\d+\s*\/\s*\d+\s*달성/ }).first(),
    ).toBeVisible();

    await recordsTab.click();
    await expect(recordsTab).toHaveAttribute("aria-selected", "true");
    await expect(codexTab).toHaveAttribute("aria-selected", "false");
    await expect(
      page.getByText(/아직 저장된 기록이 없습니다|선택의 결과 기록/).first(),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: /\d+\s*\/\s*\d+\s*달성/ })).toHaveCount(0);
  });
});
