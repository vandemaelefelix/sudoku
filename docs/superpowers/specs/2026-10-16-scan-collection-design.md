# Scan collection design

| Field | Value |
| --- | --- |
| Status | Draft, for review |
| Date | 2026-10-16 |
| Related | [model contract](../../architecture/00-concepts/model-contract.md), [scan pipeline](../../architecture/00-concepts/scan-pipeline.md), [history sync](../../architecture/00-concepts/history-sync.md), SUD-01, SUD-02, SUD-08, SUD-10, SUD-11, ADR-003, ADR-013, ADR-022, ADR-027, ADR-028, F-11 |

## Goal

Collect real scans from the app, so the cell classifier can learn from them. Each scan arrives with
the model's answer and the player's corrections. This cuts the hand-labelling work. The model reads
digits only, so a grid that has a mistake on the paper is still good data.

## Decisions

| Topic | Decision |
| --- | --- |
| Consent | A disclosed setting, on by default, that the player can turn off. It replaces "an explicit action for each export" in SUD-02. A new ADR records this |
| Who uploads | Signed-in and signed-out players. A random device ID (the contributor ID) identifies the device. A signed-in player also has the user ID |
| Notice | "Help improve the app". One short line with a link to the privacy policy. The policy names the photos, the corrections and the ID. New players see the line at onboarding. Other players see it once, before the first upload |
| What uploads | A cropped photo, the corners, the model's answers, the final grid and an `edited` flag per cell |
| When | The player leaves the correction screen by any route except Retake |
| Not stored | The cell images (the pull step cuts them), EXIF, the position, the outcome of the game |
| Delete | The player emails the developer. Account delete also removes the scans of a signed-in player. The footer of Settings shows the contributor ID and the app version. The privacy policy tells the player to send the ID |
| Retention | 12 months, then the row and the photo expire |
| Training use | Training takes `verified` and `app-edited` cells by default. `app-unedited` cells need a flag |

## App flow

1. The player leaves the correction screen. Sharing is on and the notice was shown.
2. The app crops the 1600 px upright photo to the grid plus a margin. It re-encodes it as JPEG,
   which removes EXIF.
3. The app adds one row to a local SQLite upload queue.
4. The uploader runs when the phone is online. It sends `POST /v1/scans`, gets a presigned URL and
   sends the JPEG with `PUT`. It retries with backoff. The `scanId` makes a repeat safe.
5. A failed upload never blocks play or scanning (SUD-01).

Settings holds the switch and the `noticeSeen` flag. The footer shows the ID and the version. A development build uploads to
the `dev` stage only (ADR-022).

## Screens

The mockups follow the Cobalt Light theme. Square corners, framed cards, the square toggle, serif titles
and mono section headings. The build uses the theme tokens, not the mockup values. The mockup has rough
edges, for example in the cell sizes and the spacing. The build must fix them on the device.

| Screen | Content |
| --- | --- |
| Onboarding | One screen, shown once to a new player. Title "Keep your stats and history". Text "Sign in and we save every game you finish. Watch your history and your stats grow." Buttons: Continue with Google, Continue with email, Skip for now. A small, light notice at the bottom: "We use the data from your scans to improve the app. Turn it off anytime in Settings." and the Privacy policy link. The background shows light grid cells like the splash wave: nine columns, pale lines, a scatter of lit cells and faint digits |
| First-upload notice | A sheet over the correction screen, shown once. Title "Help improve the app". The same line and link. A "Got it" button and a small underlined "Turn off" link |
| Settings | A "Scanning" section above Account, with the switch "Help improve the app" and the policy link. The footer shows "Version 1.4.0 (212)" and "ID 7f3a-91c2" in small mono type |

The onboarding screen is a separate issue. This work defines the notice line and the `noticeSeen` flag only.

## Backend

| Part | Rule |
| --- | --- |
| Route | `POST /v1/scans`, no JWT authorizer. The handler checks a shared app key header. If an `Authorization` header is present, the handler verifies the JWT and stores the user ID |
| Lambda | A separate Lambda, so abuse of this route cannot starve sync. This amends ADR-027 decision 5 |
| Validation | 81 cells, probabilities in range, four corners that form a convex quad inside `[0, 1]`. The kill switch applies |
| Throttle | A tight throttle on this route only (SUD-11) |
| Row | One DynamoDB item per scan, in the existing table. It holds the fields above, the user ID, `pending`, and the probabilities as one binary attribute |
| Photo | A private, encrypted S3 bucket. The presigned URL accepts `image/jpeg` up to 1 MB. A lifecycle rule expires objects after 12 months |
| Contract | `shared/scan-contract/` defines the item. The app, the Lambda and the pull tool use it |

An app key in the binary does not stop a determined sender. App Attest would. It is a
reassessment trigger in the ADR, not part of this work.

## Training side

`just pull-scans` downloads the scans with `pending` set. It writes the photos to
`ml/dataset/images/sudoku-photos/`, outside git (SUD-08). It adds rows to `sudoku-photos.csv` with
source `app-scan`, licence `player-contributed` and the corners. It clears `pending` and skips any
scan whose photo is missing.

A new column in `cells.csv` records the label provenance.

| Value | Meaning |
| --- | --- |
| `app-edited` | The player changed the model's answer |
| `app-unedited` | The player left the model's answer |
| `verified` | The developer confirmed the label on the labelling page |

Scan cells never become fixtures (SUD-10). The dev split is by photo, so the cells of one scan stay
on one side.

## Work

Each item is one issue and one pull request. The developer approves the issues first.

| # | Issue | Depends on |
| --- | --- | --- |
| 1 | ADR "Scan collection", the concept page, the decisions index, the glossary and the privacy policy | - |
| 2 | `shared/scan-contract/` with the item type and a validator | 1 |
| 3 | Backend: the bucket, the Lambda, the route, the throttle and the account-delete step | 2 |
| 4 | App: the crop, the upload queue, the uploader and the Settings switch and the footer with the ID and version | 2 |
| 5 | App: the first-upload notice | 4 |
| 6 | `just pull-scans`, the provenance column and the training filter | 2 |
| 7 | `just delete-scans <id>` for the developer | 3 |

Onboarding with an optional sign-in is a separate issue. It will show the notice too.

## Tests

- The contract validator has unit tests for good and bad items.
- The Lambda has handler tests for the key, the JWT, the validation and the throttle path.
- The queue has tests for retry, idempotence and offline.
- `pull-scans` has a test with a fake bucket.
- An iPhone check on the `dev` stage proves the whole path once.

## Open questions

| Question | Decided by |
| --- | --- |
| The exact table keys and the sparse index for `pending` | The plan for issue 3 |
| The crop margin and the JPEG quality | The plan for issue 4, against a real scan |
| The App Store privacy label values for photos and the device ID | Issue 1 |
