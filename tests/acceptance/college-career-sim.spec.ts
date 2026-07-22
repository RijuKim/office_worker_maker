import { expect, test } from "@playwright/test";
import { completeRealOnboarding, openRecords, seedFixture } from "./helpers/real-ui";

test.beforeEach(({ viewport }) => test.skip((viewport?.width ?? 0) < 800, "database integration runs once in the desktop project"));

test("complete onboarding payload persists after a browser reload", async ({ page }) => {
  const { character, requestBody } = await completeRealOnboarding(page, { name: "통합 한서윤", age: "28", residenceLabel: "기숙사", abilities: ["학업", "건강"] });
  expect(requestBody).toEqual({ name: "통합 한서윤", age: 28, residence: "dorm", preferredStats: ["academic", "health"] });
  await page.reload();
  await expect(page.getByText("통합 한서윤", { exact: true }).first()).toBeVisible();
  const restored = await page.request.get(`/api/characters/${character.id}`);
  expect(restored.status()).toBe(200);
  await expect(restored.json()).resolves.toMatchObject({ character: { id: character.id, name: "통합 한서윤", age: 28, hiddenState: { familyState: { residence: "dorm" }, eventFlags: { preferredStats: ["academic", "health"] } } } });
});

test("an AI fallback event remains playable after reload", async ({ page }) => {
  const { character } = await completeRealOnboarding(page);
  await seedFixture(page, "next-event-precursor", character.id);
  const generated = await page.evaluate(async (id) => fetch(`/api/characters/${id}/events/next`, { method: "POST" }).then(async (response) => ({ status: response.status, body: await response.json() })), character.id);
  expect(generated.status).toBe(200);
  expect(generated.body.event.source).toBe("FALLBACK");
  await page.reload();
  await expect(page.locator('[data-event-source="FALLBACK"], .choice-stack')).toBeVisible();
  const choiceResponse = page.waitForResponse((response) => response.url().endsWith(`/api/characters/${character.id}/choices`));
  await page.locator(".choice-stack button").first().click();
  expect((await choiceResponse).status()).toBe(200);
});

test("the current mobile play surface is single-column and does not overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await completeRealOnboarding(page);
  const choice = page.locator(".choice-stack button").first();
  expect((await choice.boundingBox())?.width ?? 391).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("the name step prevents an unnamed protagonist", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "시작하기", exact: true }).click();
  await expect(page.getByRole("button", { name: "다음", exact: true })).toBeDisabled();
});

test("a second guest cannot read another guest's private character", async ({ page, browser }) => {
  const { character } = await completeRealOnboarding(page);
  const other = await browser.newContext();
  const response = await other.request.get(`/api/characters/${character.id}`);
  expect([403, 404]).toContain(response.status());
  await other.close();
});

test("the shared menu opens records and starts a fresh simulation", async ({ page }) => {
  await completeRealOnboarding(page);
  await openRecords(page);
  await page.getByRole("button", { name: "메뉴", exact: true }).click();
  await page.getByRole("button", { name: "새 시뮬레이션", exact: true }).click();
  await expect(page.getByRole("heading", { name: "낯선 아침이 시작됩니다." })).toBeVisible();
});
