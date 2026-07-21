import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/acceptance',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    // Acceptance tests exercise the configured development database. Apply the
    // repository's committed migrations before Next.js can serve a request so
    // the generated Prisma client and runtime schema cannot silently drift.
    command: 'npx prisma migrate deploy && npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'] },
    },
  ],
});
