# Next.js, Prisma, Auth, Tailwind Research

Confidence: [scanned-not-verified]

## Why
The MVP spec needs concrete stack choices, framework patterns, and version candidates for a greenfield authenticated game with server-owned rules and PostgreSQL persistence.

## Version Candidates Checked
- `next`: 16.2.10
- `react`: 19.2.7
- `react-dom`: 19.2.7
- `typescript`: 6.0.3
- `prisma`: 7.8.0
- `@prisma/client`: 7.8.0
- `next-auth`: 4.24.14
- `tailwindcss`: 4.3.2
- `zod`: 4.4.3

These should be pinned in `package.json` and the generated lockfile during implementation.

## Key Findings
- Next.js 16.2.10 documentation recommends the App Router and lists Node.js 20.9+ as the minimum runtime.
- Next.js App Router supports route handlers and server-side mutations, fitting server-owned game transition APIs.
- Tailwind CSS has official Next.js installation guidance and fits the MVP's responsive text/card UI.
- Prisma supports PostgreSQL and has Next.js-specific troubleshooting guidance.
- NextAuth v4 credentials provider can support arbitrary username/password-style credentials, but its documentation warns that credentials-based auth carries more security responsibility and is intentionally limited.
- NextAuth's credentials provider documentation says credentials-authenticated users are not persisted by that provider and requires JWT sessions, so implementation must own user persistence/password hashing in the application database.
- NextAuth recommends `getServerSession` for server-side session access in route handlers/API/server contexts.

## Recommended Approach
- Use Next.js App Router with route handlers for game APIs.
- Use Prisma and PostgreSQL for all durable game/account state.
- Use NextAuth v4 credentials provider with application-owned user records, hashed passwords, and JWT sessions.
- Use Zod for request, AI output, and game event validation.
- Use Tailwind CSS for responsive UI, with 768px mobile breakpoint behavior matching project doctrine.

## Sources
- https://nextjs.org/docs/app/getting-started/installation
- https://nextjs.org/docs/app/api-reference/file-conventions/route
- https://nextjs.org/docs/app/getting-started/mutating-data
- https://next-auth.js.org/providers/credentials
- https://next-auth.js.org/configuration/nextjs
- https://www.prisma.io/docs/orm/overview/databases/postgresql
- https://www.prisma.io/docs/orm/more/troubleshooting/nextjs
- https://tailwindcss.com/docs/installation/framework-guides/nextjs
