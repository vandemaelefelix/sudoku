---
status: DRAFT
---

# ADR-030: Scan collection: a disclosed setting that uploads finished scans

| Field   | Value      |
| ------- | ---------- |
| Project | Sudoku     |
| Status  | Proposed   |
| Date    | 2026-10-16 |
| Contact | Felix      |

Amends SUD-02, [ADR-003](adr-003-on-device-inference.md), [ADR-013](adr-013-fixtures-and-data-licensing.md) and
[ADR-027](adr-027-backend-platform.md). The concept is [scan-collection](../00-concepts/scan-collection.md).

## Context

The cell classifier learns from real photos. The developer labels them by hand. This is slow. The app
already shows the model's answer to the player, and the player corrects the mistakes. Those corrections are
labels. They cost the developer no work.

SUD-02 says that a photo leaves the device only after an explicit user action for each export. A tap for each
scan is too much friction. Few scans would arrive. The setting must be honest instead: the player is told, and
the player can turn it off.

ADR-027 gives the app a backend with a JWT authorizer. A signed-out player has no token. The route for scans
must also accept a signed-out player.

## Alternatives Evaluated

| Option | For | Against |
| --- | --- | --- |
| Keep SUD-02: a tap for each export | The strictest privacy rule | Few players tap. Few scans arrive |
| **A disclosed setting, on by default, off at any time** | Many scans arrive. The player knows and can stop | A weaker rule than SUD-02 today. The privacy policy and the App Store labels must change |
| Opt in at onboarding | The player chooses first | A new player has no reason to trust the app yet. Few players opt in |
| Upload only the cell images | Smaller files | The pull step cannot re-cut the cells. Corner errors stay hidden |
| Use the sync route with its JWT authorizer | One route | A signed-out player cannot upload. Abuse of scans starves the sync |

## Decision

1. **SUD-02 changes.** A photo leaves the device only through the setting "Help improve the app". The setting is
   on by default. The player can turn it off at any time. The player sees a notice before the first upload.
   Camera frames and cell images still never leave the device. The old rule "an explicit action for each export"
   ends.
2. **The upload happens when the player leaves the correction screen by any route except Retake.** The app sends a
   cropped JPEG of the grid, the four corners, the model's answers, the final grid and an `edited` flag for each
   cell.
3. **A random device ID, the contributor ID, identifies the device.** A signed-in player also sends the user ID.
   The app shows the contributor ID in the footer of Settings.
4. **The app stores no EXIF, no position and no game outcome.** The app crops the photo to the grid plus a margin and
   encodes it again as JPEG. This removes EXIF.
5. **A failed upload never blocks play or scanning** (SUD-01). The app keeps a local queue and retries with
   backoff.
6. **A public route `POST /v1/scans` has no JWT authorizer.** The handler checks a shared app key header. When an
   `Authorization` header is present, the handler verifies the JWT and stores the user ID. The app key is not a
   secret.
7. **A separate Lambda serves the route.** This amends ADR-027 decision 5, "One Lambda". Abuse of the scans route
   cannot starve the sync. The route has its own tight throttle (SUD-11).
8. **The route returns a presigned S3 URL.** The bucket is private and encrypted. The URL accepts `image/jpeg` up to
   1 MB. One DynamoDB item per scan goes in the existing table. A repeat of the same `scanId` makes no second item.
9. **The data expires after 12 months.** A table TTL removes the item. A bucket lifecycle rule removes the photo.
10. **The player deletes scans by email.** Account delete also removes the scans of a signed-in player. Deletion does
    not undo training that already used the scan.
    A scan that the player uploaded while signed out stays under the contributor ID. Account delete does not remove
    it. Deletion by email covers it.
    A retry after a lost response can leave two rows for one scan.
11. **Training takes `verified` and `app-edited` cells by default.** *(Replaced by the amendment of 2026-10-22: only `verified` cells train.)* `app-unedited` cells need a flag. The label
    provenance is a new column in `cells.csv`. Scan cells never become fixtures. A fixture never enters a training dataset (SUD-10). Scan photos stay out of git
    (SUD-08).
12. **App Store privacy labels (amends ADR-013).** The labels declare photos and the device ID as data linked to the
    player, for app functionality. "Data Not Collected" no longer holds. The exact label values are fixed before the
    first submission.

## Amendment: scanShare and the scan UI (2026-10-21)

- `src/scanShare/` does not import the scan UI (`src/scan/`). Code that both use lives in `src/utils/` or `src/components/`.
- The scan UI builds the final grid of a scan once (`finalGrid`). It hands the `FinalGrid` type of `src/utils/` to scanShare.
  The upload record and the development scan log both read it.
- `just boundaries` checks the rule: `adr-030-scanshare-does-not-use-scan`. The upload record format does not change.

## Amendment: imported images never upload (2026-10-22)

The player can scan an image from the photo library (issue #216). This ADR spoke only of camera photos. An imported image
can be a screenshot of a website or of another app. It can hold content that the player does not own, and other personal
data in the same picture. The notice and the privacy policy speak of the scans of the camera.

| Option | For | Against |
| --- | --- | --- |
| **An imported image never uploads** | The strictest rule. The notice stays true. No content of a third party reaches the bucket | Fewer scans arrive. Digital fonts, which the model reads worse, stay out of the training data |
| Imported images upload like camera scans | More scans, also of digital fonts | A screenshot can hold personal data around the grid. The crop keeps a margin. The notice and the policy need new text |
| A second switch for imported images | The player chooses | One more setting. A screenshot still holds what the player did not mean to send |

Decision:

1. **An imported image never leaves the device.** This holds also when "Help improve the app" is on. The scan UI marks the
   capture result of an import with `imported`. `ScanFlow` never adds an imported scan to the upload queue.
2. **A release build keeps no file of an imported image.** The app deletes the cache copy of the picker when the scan is
   done. Only a development build keeps an upright copy, for the dev menu. It deletes it when the player leaves.
3. **The privacy policy says so.** An image from the photo library is in the list of data that the app does not collect.

Reassessment trigger: the model needs digital fonts for training. Then a new amendment can let the player send one imported
scan with an explicit tap.

## Amendment: a person checks the outline of each scan (2026-10-22)

The pull checks only that the 4 corners form a convex quad. An outline a little off cuts part of each digit. On a page
with several sudokus the app can lock on the wrong grid. Then every cell label of the scan is wrong, and decision 11
trusts `app-edited` cells at once.

| Option | For | Against |
| --- | --- | --- |
| **A person checks each outline, in a gallery sorted by fit** | A wrong cut never trains the model. The gallery is fast for many scans | One more step before training |
| Trust the outline of the app | No work | A bad outline poisons 81 labels at once |
| Check the cells only, never the outline | One step | A reviewer cannot see a cut that is a little off from the cells alone |

Decision:

1. **The pull stores a scan as `unchecked`.** This is a new status of `sudoku-photos.csv`. It has corners, like
   `accepted`. Training leaves out every cell of a scan that is not `accepted`.
2. **The Outlines step of the labelling app checks each outline.** The lowest outline fit comes first. A person
   approves it, drags the corners or rejects the scan.
3. **A corner fix cuts the cells again.** A new cell keeps the digit, the kind and the label provenance of the old cell
   at its place. The old cells move to `discarded/`. A rejected scan moves all of its cells to `discarded/`.
4. **The journal holds each check.** Undo reverses it. Finish writes the status and the corners into
   `sudoku-photos.csv`. A move of the Outlines step never makes a cell `verified`.

Reassessment trigger: the app proves its outlines with a grid check on the device. Then the gallery can show only the
scans that the check doubts.

## Amendment: only verified cells train the model (2026-10-22)

Decision 11 let `app-edited` cells train at once and `app-unedited` cells with a flag. A player can miss a wrong digit.
A player can also make a wrong correction. A wrong label teaches the model the mistake. That model then reads the next
scans wrong.

| Option | For | Against |
| --- | --- | --- |
| **A person verifies every cell. A doubt score sets the order** | No unchecked label trains. The errors come first, so the check is fast | Work for each cell |
| Keep decision 11 | No work | Wrong labels train the model |
| Verify only the cells with a high doubt | Less work | A mistake that no signal sees trains the model |

Decision:

1. **This replaces decision 11.** Training takes only `verified` cells and the legacy cells without a label source.
   `app-edited` and `app-unedited` cells never train until a person verifies them. The `--app-unedited` flag is gone.
2. **The Digits and Kind steps of the labelling app verify the cells.** A confirmed cell gets a digit line or a kind
   line in the journal. Finish writes `verified` for each confirmed cell.
3. **The doubt score only sets the order.** A person still checks every cell. The score of a cell is 0 (sure) to 1
   (doubtful). The server computes it from the model probabilities and the sudoku. It stores no score.
   - **Digits step:** `min(1, (1 − p) + 0.5·differs + 0.3·edited + 0.2·rule break + 0.1·not unique)`. `p` is the
     probability of the label digit. A cell without probabilities has the score 1.
   - **Kind step:** `min(1, (1 − p) + 0.5·differs)`. `p` is the probability of the label kind, renormalised over printed
     and handwritten.
   - Each signal keeps its evidence, so the app can name it.
4. **The sudoku signals need no model.** A rule break is a digit twice in a row, a column or a box of a scan. A scan is
   not unique when its printed givens have more than one solution. A small solution counter in
   `ml/src/sudoku_ml/doubt.py` finds this. SUD-07 forbids an import of the TypeScript solver. The signals only nudge the
   order. They never block a cell, because some photos do not give a solvable grid.
   `ml/dataset/work/doubt-sudoku.json` caches them per scan, keyed by the corners and the labels.
5. **A bulk confirm needs a threshold.** "Confirm the sure cells" takes the cells where the model reads the label with
   at least 98 % (digits) or 95 % (kind). A cell that the player changed, or that breaks a rule, is never sure. A cell
   without probabilities is never sure.
6. **A pixel-identical cell is one cell.** Its verdict counts for every scan that holds it.

Reassessment trigger: the review history shows that a signal never finds an error. Then drop it. The trust per
contributor (issue #254) can add a signal.

## Consequences

- SUD-02 is weaker. The privacy policy and the notice carry the promise instead.
- ADR-003 stays true for inference. Inference still runs on the device. Only the sentence on exports changes.
- The backend has a second Lambda and a public route. SUD-11 bounds the cost with a throttle and the kill switch.
- The developer gets labelled real photos with little hand-labelling.
- The privacy policy gets a new section. The developer must answer deletion requests by email.
- Account delete does not remove scans that the player uploaded while signed out. Only deletion by email removes them.
- A retry after a lost response can leave two rows for one scan.
- A repeat with a token reuses an existing CONTRIB row for the same scan. A scan never has both a CONTRIB row and a USER row.
- A determined sender can send junk. The app key does not stop this. The validator limits the damage.

## Reassessment Triggers

- A sender abuses the route. Then add App Attest. It proves that a request comes from the real app.
- Few players keep the setting on, or players complain. Then move to an opt-in.
- The app goes to the App Store. Then check the privacy labels and the age rating again.
- Deletion requests grow past what an email can handle. Then add a delete button in Settings.
- The upload cost threatens SUD-11.
- The model needs scans of digital fonts. Then reassess the rule for imported images (amendment 2026-10-22).
