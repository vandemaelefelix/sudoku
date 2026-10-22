---
status: ACCEPTED
---

# ADR-029: Repository layout: one folder per area

| Field   | Value      |
| ------- | ---------- |
| Project | Sudoku     |
| Status  | Accepted   |
| Date    | 2026-10-16 |
| Contact | Felix      |

Supersedes the folder layout in [ADR-001](adr-001-polyglot-monorepo.md),
[ADR-008](adr-008-package-boundaries.md) and
[ADR-018](adr-018-one-data-folder-two-tables.md). Their other decisions stay.

## Context

The repository grew to 11 top-level folders: `apps`, `packages`, `services`, `infra`, `site`,
`contracts`, `fixtures`, `data`, `scripts`, `ml` and `docs`. The goal was one folder for the
app, one for the machine learning and one for the backend. A new reader cannot see the three
parts. The backend sits in two folders. The dataset sits next to the code that owns it.

## Alternatives Evaluated

| Option | For | Against |
| --- | --- | --- |
| Keep `apps/`, `packages/`, `services/` | The usual pnpm and Turborepo names. No move | The product parts are not visible. The backend stays in two folders |
| **One folder per area, plus `shared/`** | The top level shows the parts. Python and TypeScript sit side by side without a fake package | Every path changes once. The names differ from the common convention |
| Add Turborepo or Nx | Task cache and a task graph | `ml/` stays outside it. The repository has few packages. No gain now |

## Decision

1. The root holds these folders: `mobile/`, `ml/`, `backend/`, `web/`, `shared/`, `tools/`, `docs/` and `.github/`.
2. `mobile/` is the Expo app. `web/` is the static site on Vercel. `ml/` is the Python project, with its dataset in `ml/dataset/`.
3. `backend/api/` and `backend/kill-switch/` are the Lambda packages. `backend/infra/` holds the SST code.
4. `sst.config.ts` and its generated `.sst/` folder stay at the root. SST documents the root as the place for them. A move would change handler paths, CI and the state folder, for no gain.
5. `shared/core` (`@sudoku/core`) and `shared/sync-contract` are pnpm packages. `shared/model-contract` and `shared/fixtures` are plain files that Python and TypeScript both read. They are not packages and not in the workspace.
6. `tools/` holds the developer scripts: the oxlint plugin, the icon renderer, the link check and the layout check.
7. The workspace globs are explicit: `mobile`, `web`, `backend/api`, `backend/kill-switch`, `shared/core`, `shared/sync-contract`.
8. SUD-12: the root holds only the entries of decision 1 and the known root files. `just lint` runs `tools/layout/check-layout.mjs` to check it.

## Consequences

- Every path in configs, workflows, docs and tests changes. Package names do not change, except `@sudoku/site`, which becomes `@sudoku/web`.
- The Vercel Root Directory changes from `site` to `web` by hand.
- The SST resource names and the AWS trust policy do not contain a folder path, so a deploy changes only the code of the Lambdas.
- A new top-level folder needs a new ADR, because SUD-12 fails the lint.

## Reassessment Triggers

- A second deployable web or mobile app appears. Then `apps/` may fit again.
- CI time grows past 15 minutes. Then add a task cache.
- SST changes where it expects `sst.config.ts`.
