# College Career Sim

Korean browser text-adventure MVP scaffold using Next.js App Router, Tailwind CSS, Prisma, NextAuth, Vitest, and Playwright.

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill local values. Do not commit secrets.

3. Generate the Prisma client and run migrations once a PostgreSQL `DATABASE_URL` is available:

   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

## Tooling

- `npm run lint` checks the Next.js TypeScript project with ESLint.
- `npm run typecheck` runs TypeScript in strict no-emit mode.
- `npm run test` runs unit and component tests with Vitest.
- `npm run test:acceptance` runs Playwright acceptance tests against the dev server.

## OpenRouter

Automated tests must mock OpenRouter. Live event generation is enabled only when `OPENROUTER_API_KEY` is present on the server. `OPENROUTER_MODEL` is optional and should default in server code when omitted.
