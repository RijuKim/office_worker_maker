import { expect, test } from "@playwright/test";

import { CODEX_CATALOG } from "@/lib/game/codex-catalog";
import { completeRealOnboarding, openRecords, seedFixture } from "./helpers/real-ui";

test.beforeEach(({ viewport }) => test.skip((viewport?.width ?? 0) < 800, "database integration runs once in the desktop project"));

test("empty ending collection shows 0/N locked slots and hides ending titles", async ({ page }) => {
  await completeRealOnboarding(page);
  await openRecords(page);
  await page.getByRole("tab", { name: "결말 모음" }).click();
  await expect(page.getByRole("heading", { name: `0 / ${CODEX_CATALOG.length} 달성` })).toBeVisible();
  await expect(page.getByRole("heading", { name: "???" })).toHaveCount(CODEX_CATALOG.length);
  await expect(page.getByText(CODEX_CATALOG[0].categoryHint).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: CODEX_CATALOG[0].title, exact: true })).toHaveCount(0);
});

test("production-generated endings persist, group near-duplicates, and restore the collection after reload", async ({ page }, testInfo) => {
  const { character } = await completeRealOnboarding(page);
  await seedFixture(page, "ending-record-precursor", character.id);

  const firstResponse = await page.request.post(`/api/characters/${character.id}/records`);
  const secondResponse = await page.request.post(`/api/characters/${character.id}/records`);
  expect(firstResponse.status()).toBe(201);
  expect(secondResponse.status()).toBe(201);
  const first = (await firstResponse.json()).record;
  const second = (await secondResponse.json()).record;
  expect(first.id).not.toBe(second.id);
  expect(first.destinationName).toBe(second.destinationName);
  expect(first.similarityKey).toBe(second.similarityKey);
  expect(first.majorEvents).toEqual(expect.arrayContaining([
    expect.objectContaining({ eventTitle: "휴학 뒤의 진로 분기" }),
  ]));

  const accountResponse = await page.request.get("/api/records");
  expect(accountResponse.status()).toBe(200);
  const account = await accountResponse.json();
  expect(account.records.map((record: { id: string }) => record.id)).toEqual(expect.arrayContaining([first.id, second.id]));
  expect(account.grouped).toEqual(expect.arrayContaining([
    expect.objectContaining({ key: first.similarityKey, recordIds: expect.arrayContaining([first.id, second.id]) }),
  ]));

  await page.reload();
  await openRecords(page);
  const firstCard = page.locator(`#record-card-${first.id}`);
  const secondCard = page.locator(`#record-card-${second.id}`);
  await expect(page.locator("article.record-card")).toHaveCount(2);
  await expect(page.locator(`article#record-card-${first.id}`)).toHaveCount(1);
  await expect(page.locator(`article#record-card-${second.id}`)).toHaveCount(1);
  await expect(firstCard).toHaveCount(1);
  await expect(secondCard).toHaveCount(1);
  await expect(firstCard.getByRole("heading", { name: first.title, exact: true })).toHaveCount(1);
  await expect(secondCard.getByRole("heading", { name: second.title, exact: true })).toHaveCount(1);
  await expect(firstCard).toContainText(first.title);
  await expect(secondCard).toContainText(second.title);
  await page.getByRole("tab", { name: "결말 모음" }).click();

  const progress = page.getByRole("heading", { name: /\d+\s*\/\s*\d+\s*달성/ });
  const match = ((await progress.textContent()) ?? "").match(/(\d+)\s*\/\s*(\d+)/);
  expect(Number(match?.[1])).toBeGreaterThan(0);
  expect(Number(match?.[2])).toBe(CODEX_CATALOG.length);
  const unlocked = page.locator("button").filter({ has: page.locator("h3:not(:has-text('???'))") });
  await unlocked.first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await testInfo.attach("partial-ending-dialog", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("records are the default tab and tabs switch without navigation", async ({ page }) => {
  await completeRealOnboarding(page);
  await openRecords(page);
  const initialUrl = page.url();
  await expect(page.getByRole("tab", { name: "지난 루트" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "결말 모음" }).click();
  await page.getByRole("tab", { name: "지난 루트" }).click();
  expect(page.url()).toBe(initialUrl);
  await expect(page.getByText("아직 저장된 기록이 없습니다.")).toBeVisible();
});
