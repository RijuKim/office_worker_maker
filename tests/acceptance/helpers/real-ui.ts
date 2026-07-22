import { expect, type Page } from "@playwright/test";

export type CreatedRun = { id: string; name: string };

export async function completeRealOnboarding(
  page: Page,
  input: { name?: string; age?: string; residenceLabel?: "본가" | "자취방" | "기숙사"; abilities?: [string, string] } = {},
) {
  const name = input.name ?? `한서윤-${Date.now()}`;
  const age = input.age ?? "21";
  const residenceLabel = input.residenceLabel ?? "자취방";
  const abilities = input.abilities ?? ["실무", "멘탈"];
  const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/characters") && response.request().method() === "POST");

  await page.goto("/");
  await page.getByRole("button", { name: "시작하기", exact: true }).click();
  await page.getByLabel("당신의 이름은 무엇인가요?").fill(name);
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByLabel("당신의 나이는 몇 살인가요?").selectOption(age);
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(`^${residenceLabel}`) }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("button", { name: abilities[0], exact: true }).click();
  await page.getByRole("button", { name: abilities[1], exact: true }).click();
  await page.getByRole("button", { name: "눈을 뜬다", exact: true }).click();

  const response = await responsePromise;
  expect(response.status()).toBe(201);
  const requestBody = response.request().postDataJSON();
  const responseBody = await response.json() as { character: CreatedRun };
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  return { character: responseBody.character, requestBody };
}

export async function seedFixture(page: Page, action: string, characterId: string) {
  let response = await page.request.post("/api/test/integration-fixture", { data: { action, characterId } });
  // Neon can briefly reject the first connection after an idle period. Retry
  // setup connectivity only; production route assertions are never retried.
  for (let attempt = 1; response.status() >= 500 && attempt < 3; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, attempt * 250));
    response = await page.request.post("/api/test/integration-fixture", { data: { action, characterId } });
  }
  expect(response.status()).toBeLessThan(300);
  return response;
}

export async function openRecords(page: Page) {
  await page.getByRole("button", { name: "메뉴", exact: true }).click();
  await page.locator(".app-menu-popover").getByRole("button", { name: "기록", exact: true }).click();
  await expect(page.getByRole("heading", { name: "선택의 결과 기록" })).toBeVisible();
}
