---
status: DRAFT
---

# ADR-010: Testing in four layers, CI without an iOS build

| Field   | Value      |
| ------- | ---------- |
| Project | Sudoku     |
| Status  | Proposed   |
| Date    | 2026-10-09 |
| Contact | Felix      |

## Context

The code splits into parts that test very differently. `@sudoku/core` is pure TypeScript. The
app's UI logic is React Native. The scanner depends on native modules (VisionCamera, fast-opencv,
fast-tflite) that do not run in Node or Jest. `ml/` is Python. One developer maintains all of it
(OC-1), so CI must be cheap and fast, and must not need a Mac runner for every push.

## Alternatives Evaluated

| Option for the scanner | For | Against |
| --- | --- | --- |
| Mock the native modules in Jest | Runs in CI | Tests the mocks, not the scanner |
| iOS simulator in CI (XCTest or Maestro) | Automated end to end | macOS runners are slow and costly. The simulator has no camera |
| **On-device fixture runner in development builds** | Runs the real native code on the real phone, on fixture photos | Manual. Run deliberately, not on every push |

## Decision

| Layer | What | Tool | Runs |
| --- | --- | --- | --- |
| 1. Game logic | `@sudoku/core`: rules, solver, generator, grader, hints | Vitest, in Node | CI, every push |
| 2. App logic | Screens, state, storage, the Scan UI with the scanner **mocked behind its interface** | Jest + React Native Testing Library | CI, every push |
| 3. Scanner | The real scanner on fixture photos: corners, intersections, cell images, recognition | **Fixture runner**: a screen in development builds only | On the device: before a promote, before and after native-module upgrades (R-08), when the capture stage changes |
| 4. ML | Preprocessing parity against `fixtures/preprocess/`, dataset manifest checks (SUD-10), training smoke test, classifier score on committed cell images | pytest | CI, every push that touches `ml/`, `contracts/` or `fixtures/` |

### The fixture runner

A development-build-only screen. It reads photo files instead of the camera, so it also covers
debugging without paper at hand. Product scanning stays camera-only (TC-5). It:

- runs `detectGrid` and `recognise` on every fixture photo,
- writes the cell images and `scanner.json` used by the promote gate (ADR-007),
- reports corner error, intersections found, and digit grid-exact against `truth.json`,
- creates new fixtures from a scan plus the correction screen's result.

### Linting and boundaries in CI

**oxlint** lints all TypeScript. It replaces ESLint: one small JSON config, no plugin peer
conflicts with Expo's ESLint config, and it runs in well under a second. Warnings fail CI.

**dependency-cruiser** enforces SUD-03, SUD-04 and SUD-05 in CI. Each rule was shown to fail on
every class of violation it claims to cover: a Node builtin, a hoisted npm package, a declared
devDependency and a relative escape out of the package (#1).
The package boundary does not rely on pnpm's isolation alone, because an Expo monorepo may need a
hoisted `node_modules` ([ADR-008](adr-008-package-boundaries.md)).

### CI

GitHub Actions on Linux runners, path-filtered:

| Job | Trigger paths | Steps |
| --- | --- | --- |
| `ts` | `apps/`, `packages/`, root config | install, typecheck, lint (incl. boundaries), Vitest, Jest |
| `ml` | `ml/`, `contracts/`, `fixtures/` | uv sync, ruff, pytest (incl. parity and cell-image scoring) |
| `docs` | `docs/` | link check |

No iOS build in CI in v1. App builds are made locally (07).

## Consequences

- Layer 3 depends on discipline. The promote gate makes it unavoidable in one place: stale cell
  images (an older scanner version in `scanner.json`) block a promote.
- The scanner interface must stay mockable, which also keeps it small.

## Reassessment Triggers

- A scanner regression reaches daily use unnoticed. Add a simulator job that runs the fixture
  runner on photo files.
- TestFlight builds become frequent. Add an EAS or macOS build job.

## Amendment 2026-10-15: CI also deploys the backend

CI no longer only checks. Two new workflows deploy the backend to AWS (ADR-027, decision 8).

| Job | Trigger | Steps |
| --- | --- | --- |
| `deploy-api-dev` | Push to `develop` that changes `infra/`, `services/`, `packages/sync-contract/`, `sst.config.ts` or the root config | Checks, account and kill switch checks, `sst diff`, `sst deploy --stage dev` |
| `deploy-api-production` | Manual run, from `develop` only | Job `plan`: checks, account and kill switch checks, `sst diff`. Job `deploy`: `sst deploy --stage production` |
| `workflows` | `.github/` | actionlint |

1. **The paths filter skips the deploy.** A merge that changes no backend file does not start
   `deploy-api-dev`. A manual run always deploys, because the developer chose it.
2. **The checks run twice.** They run on the pull request, then on the merge commit. A composite
   action, `.github/actions/ts-checks`, holds the shared steps for `ci-ts` and both deploy
   workflows.
3. **Every action is pinned to a commit SHA**, in all workflows. `infra/workflows.test.ts` fails
   on a floating tag.
4. **The approval gate is the manual run.** The repository is private on a GitHub Free account.
   GitHub offers environments in a private repository only on Pro, Team and Enterprise. It offers
   a required reviewer for a private repository only on Enterprise, and for a public repository on
   every plan (GitHub documentation, checked 2026-10-15). The account has the Free plan, so the
   workflow uses no `environment:` key. Only the owner has write access, so starting the run is the approval.
   The deploy job does not wait for a second click.
5. **The trust policy carries the guard that an environment would carry.** Without an
   environment, the OIDC `sub` claim names the branch: `repo:vandemaelefelix/sudoku:ref:refs/heads/develop`.
   Both roles share it. The claim `job_workflow_ref` tells them apart. The role `sudoku-github-dev`
   trusts only `deploy-api-dev.yml@refs/heads/develop`. The role `sudoku-github-production` trusts
   only `deploy-api-production.yml@refs/heads/develop`. A run of the production workflow from
   another branch fails at the role, and the jobs refuse it earlier with `if:`.
6. **GitHub stores no AWS secret.** The two role ARNs are repository variables. The `sst.Secret`
   values live in the SST state in the AWS account, so no GitHub environment holds secrets.

### Consequences of the amendment

- CI holds a role with `AdministratorAccess`, reachable only from one repository, one branch and
  one workflow file per role (ADR-027, amendment "CI deploys").
- A mistake on `develop` can reach `dev` without a human click. `production` needs a manual run.
- A push right can start a `dev` deploy. Only the owner has push rights.

### Reassessment Triggers of the amendment

- The account upgrades to GitHub Pro or Team, or the repository becomes public. Then add the
  `production` environment to the job `deploy`, with a required reviewer where the plan allows
  it. Add `repo:vandemaelefelix/sudoku:environment:production` to the trust of the production
  role. Remove the `ref` subject from it. The split into `plan` and `deploy` already puts
  `sst diff` before the gate.
- A collaborator gets write access. Then the manual run is no longer an approval by the owner.
- `job_workflow_ref` is not accepted by AWS in the trust policy. Then use a separate branch rule
  or an environment.
