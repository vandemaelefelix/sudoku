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
   environment, the OIDC `sub` claim names the branch. The repository uses immutable subject claims, so the
   `sub` is `repo:vandemaelefelix@32290789/sudoku@1412094169:ref:refs/heads/develop`. The trust also
   requires `repository_id` 1412094169. Both roles share both conditions. The claim `job_workflow_ref` tells them apart. The role `sudoku-github-dev`
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
  it. Add `repo:vandemaelefelix@32290789/sudoku@1412094169:environment:production` to the trust of the production
  role. Remove the `ref` subject from it. The split into `plan` and `deploy` already puts
  `sst diff` before the gate.
- A collaborator gets write access. Then the manual run is no longer an approval by the owner.
- `job_workflow_ref` is not accepted by AWS in the trust policy, or the first run shows that a plain
  workflow lacks the claim. Then use a separate branch rule or an environment, or the fallback in
  `infra/README.md`.
- The OIDC subject customization of the repository changes. The trust `sub` must then change with it.

## Amendment 2026-10-22: CI builds the iOS app for the simulator

The decision "No iOS build in CI in v1" changes. An Expo SDK or native-module upgrade can break
the native build, and before this amendment only the developer's Mac showed it (R-08). A new
workflow, `ios-simulator`, builds the app for the iOS Simulator on a macOS runner. A simulator build
needs no code signing, so it needs no paid Apple Developer account.

| Job | Trigger | Steps |
| --- | --- | --- |
| `ios-simulator` | A pull request that changes `mobile/package.json`, `mobile/app.json`, `mobile/app.config.ts` or the workflow. A manual run | Install, stub model, `just ios-simulator` (`expo prebuild`, `pod install`, `xcodebuild`), upload the `.app` |

1. **The runner is `macos-26` with Xcode 26.6.** Expo SDK 57 needs Xcode 26.4 or later. The
   workflow pins Xcode through `DEVELOPER_DIR`, so a new default on the image does not change the build.
2. **The build is the development variant in the Release configuration.** Release bundles the
   JavaScript, so the app runs without Metro. The development variant talks to the development Clerk
   instance and the development sync API, so a test run sends no traffic to production (ADR-022).
   Both variants have the same native modules.
3. **The build uses the stub model, as `ts` does.** The private model never enters CI (SUD-08).
4. **The paths filter keeps the cost low.** The repository is private on the Free plan: 2,000 minutes a
   month, and a macOS minute counts ten times. `pnpm-lock.yaml`, `pnpm-workspace.yaml` and the
   `justfile` are not trigger paths. Each changes in many pull requests that touch no native code.
   An upgrade that changes only the lockfile needs a manual run. `mobile/ios/` is not a trigger path,
   because it is generated and git ignores it (ADR-002).
5. **No weekly run.** Nothing changes the native build between two pull requests. A weekly run
   would cost about 430 of the 2,000 monthly minutes.
6. **The workflow uses no cache.** The measurement below showed that each cache cost more time to
   restore than it saved.
7. **The `.app` is an artifact for the end-to-end tests.** It keeps 7 days, because the Free plan has
   500 MB of artifact storage for a private repository. The zip is 30 MB.

### The measurement

Two runs of the same commit on `macos-26`, on 2026-10-22. The first run had no cache. The second
run restored the caches that the first run saved.

| Step | Without cache | With cache | Cache size |
| --- | --- | --- | --- |
| Restore the pnpm store (`setup-node`) | — | 3 min 41 s | 925 MB |
| `pnpm install` | 29 s | 50 s | |
| Restore `Pods` and `Podfile.lock` | — | 7 s | 360 MB |
| `pod install` | 1 min 17 s | 1 min 30 s | |
| Restore DerivedData | — | 2 min 6 s | 1,353 MB |
| `xcodebuild` | 6 min 44 s | 5 min 55 s | |
| Save the caches | 1 min 16 s | — | |
| **The job** | **10 min 9 s** | **14 min 49 s** | |

- `pod install` spends its time on the CocoaPods CDN and on the ExpoModulesJSI slices, not on the
  downloads that `Pods` holds.
- DerivedData saved 49 s of `xcodebuild`, because a new checkout gives every file a new time stamp.
- The three caches hold 2.6 GB of the 10 GB cache limit of the repository.

### The cost

GitHub rounds each job up to whole minutes. A run without cache takes about 10 minutes and costs
about 100 of the 2,000 monthly minutes. In the month before this amendment, 4 commits changed a trigger
path. At one or two runs for each such pull request, the build costs 400 to 800 minutes a month.

### Reassessment Triggers of the amendment

- The build costs more than a quarter of the monthly minutes. Then run it only on a manual run,
  before an upgrade merges.
- `xcodebuild` takes more than 15 minutes. Then measure `ccache` (`apple.ccacheEnabled`) or a
  DerivedData cache again.
- The account gets more minutes, or the repository becomes public. Then add a weekly run and the
  lockfile as a trigger path.
- A device or TestFlight build becomes necessary. That needs a paid Apple Developer account.
