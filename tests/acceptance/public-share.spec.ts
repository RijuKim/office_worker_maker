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

test('a valid public share returns only the allowlisted ending DTO', async ({ request }) => {
  const setup = await request.post('/api/test/public-share-fixture');
  expect(setup.status()).toBe(201);
  const { recordId, cleanupId } = await setup.json() as { recordId: string; cleanupId: string };

  try {
    const response = await request.get(`/api/share/${recordId}`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      id: recordId,
      title: '공개된 첫 기록',
      summary: '공개 요약',
      longNarrative: '공개 장문 서사',
      careerPath: '기획',
      jobRole: '서비스 기획자',
      destinationName: null,
      salaryBand: '4,500만원',
      workplaceTone: ['차분함'],
      satisfaction: 84,
      growthPotential: 91,
      workLifeBalance: 73,
      healthState: '양호',
      relationshipState: '안정',
      tags: ['첫 도전'],
      statSnapshot: { academic: 8 },
      keyRelationships: [{ name: '민준', role: '동기', trust: 80 }],
      majorEvents: [{ summary: '첫 입사' }],
    });
    expect(body).not.toHaveProperty('userId');
    expect(body).not.toHaveProperty('characterRunId');
    expect(body).not.toHaveProperty('similarityKey');
    expect(body).not.toHaveProperty('createdAt');
  } finally {
    expect((await request.delete(`/api/test/public-share-fixture?cleanupId=${encodeURIComponent(cleanupId)}`)).status()).toBe(204);
  }
});
