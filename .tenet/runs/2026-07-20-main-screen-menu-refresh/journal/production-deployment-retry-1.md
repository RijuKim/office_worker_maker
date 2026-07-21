# Production deployment retry 1

Status: **BLOCKED** (`[verified-2026-07-21]`)

The replacement predeployment checkpoint authorized production deployment of exact commit `93d05f0807a65488ff8ef46c81dd57daf888fefd`. The shared worktree contained unrelated dirty and untracked files, so the Vercel upload was made from an isolated `git archive` of that exact commit with only the existing `.vercel/project.json` link metadata added.

## Vercel result

- Attempted deployment ID: `dpl_4eQbvNcz87CL8XjpzLSdhkgAV2wV`
- Immutable URL: `https://sano-officeworker-lzeuyryu4-rijukims-projects.vercel.app`
- Target: production
- Final status: **Error**
- Failure: Vercel's TypeScript gate could not resolve `./toss-auth` imported by `apps/toss-miniapp/src/App.tsx`. The required `apps/toss-miniapp/src/toss-auth.ts` exists only as an untracked workspace file and is absent from commit `93d05f0`.
- No retry was made from the dirty workspace because that would deploy files outside the authorized SHA.
- The healthy public alias was not replaced. `https://sano-officeworker.vercel.app` still resolves to prior Ready deployment `dpl_8NBUQqj5vAMYQcn5fuo4xWm77Bv9` (`https://sano-officeworker-pvti8qf47-rijukims-projects.vercel.app`) and returned HTTP 200.

## Apps in Toss result

- `npm run toss:build:production`: passed.
- `npm run ait:build`: passed and created `sano-officeworker.ait`.
- Artifact deployment ID embedded/reported by the build: `019f82f4-1bfe-7fd8-b9f5-f95bad2824f9`.
- Upload: **not completed**. The existing `ait deploy` workflow could not read its credential store because the sandbox denied creation/access of `/Users/guremini/.ait` (`EPERM`). No credential value was read or printed.
- Review, approval, and public release: **not started / not claimed**.

## Required follow-up

Commit the required `apps/toss-miniapp/src/toss-auth.ts` (and any other intended untracked production dependencies), rerun the complete predeployment checkpoint against that new clean commit, then authorize deployment of the new SHA. Run the Apps in Toss upload from an environment where the existing AIT credential store is accessible; upload still does not constitute public release.
