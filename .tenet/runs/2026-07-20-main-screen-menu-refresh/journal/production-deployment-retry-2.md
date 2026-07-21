# Production deployment retry 2

Status: **BLOCKED BY EXECUTION ENVIRONMENT** (`[verified-2026-07-21]`)

The authorized source was exact commit `cb22dca3dd39c3a60fc6d034098560743dd63692`. A fresh `git archive` of that commit was used with only the existing `.vercel/project.json` link metadata added. No product code was modified and the dirty shared worktree was not deployed.

## Vercel result

- `npx vercel deploy --prod --yes` reached project retrieval, then failed before a deployment was created because DNS resolution for `api.vercel.com` returned `ENOTFOUND`.
- A bounded `npx vercel ls` recheck failed with the same `ENOTFOUND` result.
- No immutable deployment ID or URL exists for this retry, and no production alias change is claimed.
- Ready state and production alias HTTP inspection could not be performed from this sandbox.

## Apps in Toss result

- Exact-archive `npm run toss:build:production`: passed (Vite 7.3.6, 38 modules).
- Exact-archive `npm run ait:build`: passed.
- Artifact: `sano-officeworker.ait`, 7.3 MB.
- Artifact SHA-256: `26e6a9fa6200c24524a4c8e847da4aa44a06b544ff9371880536f10068249f2e`.
- Artifact deployment ID: `019f82fd-7925-799b-a8df-5d1cd0ed1c91`.
- Upload was not attempted because the existing AIT credential store was absent or inaccessible in this execution environment.
- Review, approval, and public release are not started and are not claimed.

## Smoke check

- The production bundle rendered successfully during the Vite production build.
- A local preview server could not bind to `127.0.0.1:4173`; the sandbox returned `listen EPERM`. This is an environment limitation, not a product runtime result.

## Required follow-up

Run the same exact-commit archive deployment in an environment with outbound DNS/network access to `api.vercel.com`, then require Vercel `Ready`, inspect the immutable deployment, and verify the production alias HTTP response. Upload the packaged Toss artifact only from an environment where the existing AIT credential store is accessible; upload still does not constitute public release.
