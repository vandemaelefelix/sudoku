# Scan collection implementation plan

> **For agentic workers:** use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkboxes.
> This plan is short on purpose. It names files, interfaces and tests, and leaves out the code. Each task is one issue and one pull request.

**Goal:** the app uploads finished scans, with the model's answers and the player's corrections, so the developer can retrain the cell classifier with little hand-labelling.

**Architecture:** the app queues a cropped photo and a record. A public route returns a presigned S3 URL and writes one DynamoDB item per scan. `just pull-scans` brings the scans into `ml/dataset/`.

**Tech stack:** Expo, expo-sqlite, TypeScript, SST (Lambda, API Gateway, S3, DynamoDB), vitest, Python with uv.

**Spec:** [2026-10-16-scan-collection-design.md](../specs/2026-10-16-scan-collection-design.md)

## Global constraints

- SUD-01: a failed upload never blocks play or scanning.
- SUD-02: amended by the new ADR (a disclosed, default-on setting). Task 1 lands first.
- SUD-07: `ml/` and the TypeScript side share files only. The scan record crosses as `shared/scan-contract/` files.
- SUD-08, SUD-10: no scan photo in git. Scan cells never become fixtures.
- SUD-11: the scans route has its own throttle. The shared app key is not a secret.
- Branch `<type>/<issue>-<slug>`, commit `feat(scope): text (#issue)`. Do not commit or push unless the developer asks.
- Repository prose follows the Simplified Technical English rules of AGENTS.md. The UI copy follows the N5 writing style.
- Every issue needs the developer's approval before work starts. A second agent reviews each pull request.

## Review focus

1. A repeated `POST /v1/scans` with the same `scanId` makes no second row. It returns a fresh URL.
2. The JPEG never arrives after the row exists. `pull-scans` skips it and reports it. The TTL removes the row.
3. The phone stays offline for days, or the app closes. The queue survives and drains later.
4. A signed-in player sends an expired token. The route answers 401. The app retries once without the header.
5. The player turns the switch off while scans wait. The queue empties. Nothing uploads later.

## File map

| Area | Files |
| --- | --- |
| Docs | `docs/architecture/adr/adr-030-scan-collection.md`, `docs/architecture/00-concepts/scan-collection.md`, `docs/privacy/privacy-policy.md` |
| Contract | `shared/scan-contract/` (new, like `sync-contract`), `shared/fixtures/scan-records/` |
| Backend | `backend/infra/scans.ts`, `backend/api/src/scans/`, `backend/api/src/tableDesign.ts`, `backend/api/src/account.ts` |
| App | `mobile/src/scanShare/` (new), `mobile/src/settings/`, `mobile/src/scan/screens/CorrectionScreen/` |
| Training | `ml/src/sudoku_ml/pull_scans.py`, `ml/src/sudoku_ml/dataset.py`, `justfile` |
| Tools | `tools/delete-scans/` |

---

### Task 1: ADR, concept and privacy policy

**Files:** create the ADR and the concept page. Modify `00-DECISIONS.md` (SUD-02 row), `09-architecture-decisions.md`, `12-glossary.md`, `01-introduction-and-goals.md` (F-11), ADR-003, ADR-013 and ADR-027 (amendments), the privacy policy.

**Produces:** ADR-030. It amends SUD-02, ADR-003, ADR-013 (privacy labels: photos, device ID) and ADR-027 (public route, separate Lambda). It lists App Attest as a reassessment trigger. The glossary gets: contributor ID, scan record, label provenance.

- [ ] Write the ADR with the five standard sections and the metadata table.
- [ ] Write the concept page: Why, What, a Mermaid diagram, Open questions, Constraints.
- [ ] Update the index, the glossary, F-11 and the three amendments.
- [ ] Add to the privacy policy: grid photos, corrections, the ID, 12 months, the email route for deletion, and the note that deletion does not undo training.
- [ ] Run `just docs-check`. Expected: every relative link resolves.

### Task 2: scan contract

**Files:** create `shared/scan-contract/src/index.ts`, `scanRecord.test.ts`, `scan-record.schema.json`, and `shared/fixtures/scan-records/` with 3 good and 4 bad records.

**Produces:** `ScanRecord`, `ScanCell`, `validateScanRecord(input: unknown): { ok: true; record: ScanRecord } | { ok: false; reason: string }`, `SCAN_SCHEMA_VERSION = 1`, `MAX_JPEG_BYTES = 1_000_000`. `ScanCell` holds `digitProbs` (10), `kindProbs` (4), `finalDigit`, `finalKind` and `edited`. The JSON Schema lets Python check records without importing TypeScript (SUD-07).

- [ ] Write failing tests: 81 cells, probabilities in `[0, 1]` and summing to 1 within 1e-3, a convex quad inside `[0, 1]`, the schema version.
- [ ] Implement the validator. Run `pnpm --filter @sudoku/scan-contract test`. Expected: pass.
- [ ] Add a test that the fixtures also pass or fail the JSON Schema.

### Task 3: backend route

**Files:** create `backend/infra/scans.ts` and `backend/api/src/scans/{handler,store,presign,appKey}.ts` with tests. Modify `tableDesign.ts`, `account.ts`, `backend/infra/kill-switch.ts`.

**Consumes:** `validateScanRecord` and `MAX_JPEG_BYTES` from Task 2.
**Produces:** `POST /v1/scans` returns `{ uploadUrl: string }`. The item is `pk` = `USER#<userId>` for a signed-in player, `CONTRIB#<contributorId>` otherwise. `sk` = `SCAN#<scanId>`. It also holds the fields of the record, `gsiPending = 'PENDING'`, `createdAt` and `expiresAt` (12 months). A sparse global index `byPending` (hash `gsiPending`, range `createdAt`) serves `pull-scans`. The photo key is `scans/<scanId>.jpg`.

- [ ] Write handler tests against DynamoDB local (`just test-api`): a wrong key gives 401, a bad body gives 400, a good body gives an item and a URL, a repeat makes one item, a valid token stores the `USER#` owner, an expired token gives 401.
- [ ] Implement the handler. Use a conditional put for the repeat case. Verify the JWT with the existing Clerk code.
- [ ] Add the private S3 bucket (public access blocked, encrypted, 12-month expiry) and the presign step: `image/jpeg` only, 1 MB maximum.
- [ ] Add `scansFunction` as a separate Lambda, the route with no authorizer, a tight route throttle and the `ScanAppKey` secret. Register the function in the kill switch.
- [ ] Extend `deleteAccount`: for each `SCAN#` row of the player, delete the S3 object, then the row. Add a test.
- [ ] Run `just test-api` and `just typecheck-infra`. Expected: pass.

### Task 4: app queue, uploader and Settings

**Files:** create `mobile/src/scanShare/{buildRecord,cropPhoto,queue,uploader,useScanShare}.ts` with tests. Modify the settings repository, `SettingsScreen.tsx`, `CorrectionScreen`.

**Consumes:** `ScanRecord` from Task 2, the route from Task 3.
**Produces:** settings `shareScans` (default `true`), `noticeSeen` (default `false`) and `contributorId` (UUID, made once). `enqueueScan(photo, result, finalGrid): Promise<void>`. `drainQueue(): Promise<void>`. The Settings "Scanning" section holds the switch and the policy link. The footer shows the version and the ID.

- [ ] Write failing tests: `buildRecord` sets `edited` per cell, `cropPhoto` returns a JPEG of at most 1600 px with a margin, the queue persists in SQLite and removes a row after success.
- [ ] Implement the three units. Test the uploader with a fake `fetch`: retry with backoff, a 401 drops the header once, the same `scanId` after a retry.
- [ ] Enqueue when the player leaves the correction screen by any route except Retake. Do nothing when `shareScans` is off.
- [ ] Turning the switch off clears the queue. Add the test.
- [ ] A development build sends to the `dev` stage only. Add a config test.
- [ ] Run `just test-ts`. Expected: pass.

### Task 5: first-upload notice

**Files:** create `mobile/src/scanShare/components/ScanShareNotice/` and its test. Modify `useScanShare.ts`.

**Consumes:** the settings of Task 4.
**Produces:** a sheet "Help improve the app" with "Got it", an underlined "Turn off" and the policy link. It sets `noticeSeen`.

- [ ] Write failing tests: the uploader sends nothing while `noticeSeen` is false. "Got it" sets the flag. "Turn off" sets `shareScans` to false and the flag to true.
- [ ] Show the sheet once, on the first correction screen exit. Follow the mockup style: square corners, serif title, theme tokens.
- [ ] Check on the iPhone against the `dev` stage. Fix the spacing and layout in the real build.

### Task 6: pull-scans and label provenance

**Files:** create `ml/src/sudoku_ml/pull_scans.py` and its test. Modify `dataset.py`, `justfile`. Add a `label_source` column to `ml/dataset/cells.csv`.

**Consumes:** `scan-record.schema.json` from Task 2.
**Produces:** `just pull-scans` downloads the items with `gsiPending`, writes the JPEG to `ml/dataset/images/sudoku-photos/`, adds a row to `sudoku-photos.csv` (source `app-scan`, licence `player-contributed`, corners) and clears `gsiPending`. Cells arrive with `label_source` = `app-edited` or `app-unedited`. The labelling page sets `verified`. Training takes `verified` and `app-edited` by default. A flag adds `app-unedited`.

- [ ] Write failing tests with a fake bucket and table: one scan makes one photo row and 81 cells, a missing JPEG is skipped and reported, a repeat run pulls nothing.
- [ ] Implement the pull. Use the `sudoku` AWS profile only.
- [ ] Add the column, the default filter and its flag. Add a test that fixture cells never enter the set (SUD-10) and that the dev split is by photo.
- [ ] Run `just test-ml` and `just check-data`. Expected: pass.

### Task 7: delete-scans tool

**Files:** create `tools/delete-scans/` with a test.

**Produces:** `just delete-scans <contributorId|userId>` lists the scans of that owner, asks for confirmation, then deletes each S3 object and its row. It prints the counts.

- [ ] Write failing tests with fake clients: it deletes only the owner's scans, and it stops when the player answers no.
- [ ] Implement the tool. Use the `sudoku` AWS profile only.

---

## Order

1 first. 2 next. Then 3, 4 and 6 in parallel. 5 after 4. 7 after 3. The iPhone check on the `dev` stage closes the work.

## Self-review

- Spec coverage: consent, notice and screens (1, 4, 5), record and storage (2, 3), upload flow (4), route and guards (3), pull and provenance (6), delete by email (7, 3). Onboarding and its background stay a separate issue.
- Names agree across tasks: `ScanRecord`, `validateScanRecord`, `gsiPending`, `byPending`, `shareScans`, `noticeSeen`, `contributorId`, `label_source`.
