# Project Architecture

## Stack

The first implementation is a Next.js web application with TypeScript, Tailwind CSS, PostgreSQL, Prisma, and Auth.js/NextAuth-style email/password authentication. Package versions are pinned by the generated lockfile.

OpenRouter API is the AI provider. `OPENROUTER_API_KEY` must be server-only and never committed. `OPENROUTER_MODEL` configures the selected model, with a low-cost general-purpose model as the default.

Local development may use Docker PostgreSQL or a local PostgreSQL instance. Deployment should be compatible with Vercel plus an external managed PostgreSQL provider.

## Server-Owned Game Logic

Game state, event selection, event validation, stat changes, relationship changes, flag changes, and ending judgment live behind server APIs. The web client handles rendering and player input. This keeps the core backend reusable for future Unity, mobile, animation-heavy, or illustration-heavy clients.

AI generates narrative proposals, not authority. The server validates AI output against schemas, safety rules, stat bounds, required fields, and progression constraints before committing any state.

## Persistence

The database stores users, character runs, user-entered character names, starting grade/year, age, major/department, current academic/life status, public stats, hidden state, relationships, event history, active event context, career destinations, career applications/employment outcomes, AI usage counters, and `커리어와 엔딩 기록`.

Each account can have multiple character runs. The collection is account-scoped. Saved records include career/path metadata and narrative details so they remain readable even if future destination data changes.

## Progression

A playthrough generally reaches a recordable outcome after 25-40 major events. A `커리어와 엔딩 기록` can be generated when the character reaches a branch point such as graduation, dropout, extended leave, employment, entrepreneurship, exam success, licensed-profession entry, public-sector entry, or comparable path, and has at least 15 core events.

This is not a single win/fail game. The system should produce varied career-and-ending outcomes with mixed results based on stats, relationships, health, network, wealth, and path history.

## AI Limits And Failure Handling

Limit OpenRouter generation to 30 calls per account per day. Timeout after 10 seconds. If OpenRouter fails, returns invalid JSON, violates safety rules, or rate-limits, continue gameplay through static fallback events or retryable non-blocking UI.

Auth failures, save conflicts, invalid character state, AI failures, and invalid AI output should produce concise user-facing guidance and provide retry or fallback paths.

## MVP Scale

The MVP should support 20 concurrent users, 1,000 accounts, 5,000 character runs, and 10,000 saved records without special infrastructure beyond the app server and PostgreSQL.
