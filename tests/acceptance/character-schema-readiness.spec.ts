import { expect, test } from '@playwright/test';

test('guest character listing responds with a database-backed character collection', async ({ page }) => {
  await page.goto('/');

  const response = await page.request.get('/api/characters');
  expect(response.status()).toBe(200);

  const payload = await response.json() as { characters?: unknown };
  expect(payload.characters).toEqual(expect.any(Array));
});
