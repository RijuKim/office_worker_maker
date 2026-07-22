import { expect, test } from '@playwright/test';

test('the managed Next server renders the shared home experience', async ({ page }) => {
  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: /일어나보니\s*대한민국 취준생/ })).toBeVisible();
});

test('a missing public share returns a stable non-sensitive response', async ({ request }) => {
  const response = await request.get('/api/share/not-a-real-id');

  expect(response.status()).toBe(404);
  await expect(response.json()).resolves.toEqual({
    error: '기록을 찾을 수 없습니다',
  });
});
