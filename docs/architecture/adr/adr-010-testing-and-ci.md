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
