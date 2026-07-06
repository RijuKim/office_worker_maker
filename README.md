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

## Neon PostgreSQL

Create a Neon project and use the pooled PostgreSQL connection string as `DATABASE_URL`.

Required local/Vercel environment variables:

```bash
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="generate-a-long-random-secret"
NEXTAUTH_URL="https://your-vercel-domain.vercel.app"
OPENROUTER_API_KEY="..."
OPENROUTER_MODEL="openrouter/model-name"
```

For local development, put these values in `.env.local`. Do not commit `.env.local`.

Run migrations against Neon after setting `DATABASE_URL`:

```bash
npm run prisma:deploy
```

Optional seed:

```bash
npm run prisma:seed
```

## Vercel Deployment

1. Import `https://github.com/RijuKim/office_worker_maker` in Vercel.
2. Set the environment variables listed above in Vercel Project Settings.
3. Use the default install command, `npm install`.
4. Use the default build command, `npm run build`.
5. Run `npm run prisma:deploy` once after setting `DATABASE_URL`, or from a trusted local machine before/after deployment.

The build script runs `prisma generate` before `next build`, so Vercel needs `DATABASE_URL` at build time. Runtime API routes also need the same `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and optional OpenRouter settings.
