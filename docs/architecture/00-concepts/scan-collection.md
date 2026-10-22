---
status: DRAFT
concept: scan-collection
---

# Scan collection

## Why

The cell classifier learns from real photos. Hand-labelling is slow. The player already corrects the model on the
correction screen. Each correction is a label. The app can send the scan with its corrections, so the developer
retrains with little hand-labelling. The decision is in [ADR-030](../adr/adr-030-scan-collection.md).

## What

A **scan record** holds one finished scan. The app builds it when the player leaves the correction screen by any
route except Retake. The setting "Help improve the app" must be on. A scan of an imported image never makes a record
(ADR-030, amendment 2026-10-22).

| Part | Content |
| --- | --- |
| Photo | A JPEG of the grid plus a margin, cropped from the 1600 px upright photo. It has no EXIF |
| Corners | Four corner points in the photo |
| Model answers | The digit and its probabilities for each of the 81 cells |
| Final grid | The 81 digits after the correction |
| `edited` | One flag for each cell. It is true when the player changed the model's answer |
| IDs | The `scanId`, the contributor ID and, for a signed-in player, the user ID |

The flow has five steps.

1. The app adds the record to a local SQLite queue.
2. The uploader runs when the phone is online. It sends `POST /v1/scans` and receives a presigned URL.
3. The uploader sends the JPEG to S3 with `PUT`. It retries with backoff. The `scanId` makes a repeat safe.
4. `just pull-scans` downloads the scans with `pending` set. It writes the photos to `ml/dataset/images/sudoku-photos/`.
5. The developer checks the outline of each scan on the **Outlines screen** of the labelling page. Then the developer
   checks each cell on the **Check cells** screen.

The **label provenance** of a cell has three values.

| Value | Meaning |
| --- | --- |
| `app-edited` | The player changed the model's answer |
| `app-unedited` | The player left the model's answer |
| `verified` | The developer confirmed the label on the labelling page |

### The outline check

`just pull-scans` stores each scan with the status `unchecked`. A wrong outline cuts part of each digit, or the wrong
grid on a page with several sudokus. Then every cell label of the scan is wrong. So a person checks the outline of each
scan first. Training leaves out every cell of a scan whose outline is not `accepted`.

The Outlines screen shows a gallery of the unchecked scans, with the outline drawn. The **outline fit** sets the
order: the lowest fit comes first. It is the share of the 20 grid lines found inside the outline, less for a line that
is off its 9 × 9 place. `ml/dataset/work/outline-scores.json` caches it per corners.

| Action | Result |
| --- | --- |
| Enter in the gallery | Every scan without a mark is approved. The marked scans open large |
| Drag the corners, then Enter | The cells are cut again. A new cell keeps the digit, the kind and the label provenance of the old cell at its place. The old cells move to `discarded/` |
| R | The scan is a **rejected scan**. All of its cells move to `discarded/` |
| Z | The last action is undone, files included. The scan shows again |

Each action is one action in the journal. The journal holds the outline as an `outline` line. Finish writes the status
and the corners into `sudoku-photos.csv`. A move of the Outlines screen never makes a cell `verified`: no person looked
at the cells.

A cell with the same pixels as a cell of another scan is stored once, with the source of the first scan. It needs one
label and one check. The **scan view** shows the photo and the 81 cells of one scan. It marks such a cell as shared,
with the label it has.

### The cell review

No cell of a scan trains the model before a person checks it. A player can miss a misread digit, make a wrong
correction, or not see a mistake the model never flagged. A wrong label teaches the model a mistake.

After the outline check, the **Check cells** screen shows the open app cells of one digit (`empty`, 1 to 9) at a time.
An **open app cell** has the label source `app-edited` or `app-unedited`, no person has labelled it, and its scan has an
approved outline. The **doubt score** sets the order: the highest first, so the errors sit at the top. Every cell still
gets a human check.

| Signal | When it fires | Weight |
| --- | --- | --- |
| `edited` | The player changed the label | 1.0 |
| `model-digit` | The current model reads another digit | 1.0 |
| `low-confidence` | The model gives the label digit less than 90 % | 1 − p |
| `model-kind` | The model reads the other of printed and handwritten | 0.5 |
| `rule-break` | The digit is twice in a row, a column or a box of a scan that holds the cell | 1.0 |
| `not-unique` | The printed digits of a scan have more than one solution. It marks the empty cells: a digit can be missed | 0.5 |
| `no-solution` | The printed digits of a scan have no solution. It marks the digit cells | 0.5 |

`ml/dataset/work/doubt.json` holds the score and each signal of each open cell, with the model run. The label server
scores the open cells at its start when the model run changed or an open cell has no score. `just doubt-cells` and the
**Score cells** button do the same. A pixel-identical cell is one cell, so it appears once, and its verdict counts for
every scan that holds it.

Enter verifies every cell on the screen, with the fixes, as one action in the journal. Finish writes `verified`.

Training takes only the `verified` cells and the legacy cells without a label source. The dev split is by photo, so
the cells of one scan stay on one side.

```mermaid
flowchart LR
  subgraph Phone
    correct["Correction screen"] --> queue[("Upload queue")]
    queue --> uploader["Uploader"]
  end
  subgraph AWS["AWS eu-west-1"]
    route["POST /v1/scans, scans Lambda"] --> db[("DynamoDB item, pending")]
    s3[("S3 bucket, private")]
  end
  subgraph Laptop
    pull["just pull-scans"] --> dataset[("ml/dataset/")]
    dataset --> review["Check outlines, Check cells, then Finish"]
    review -- "accepted or rejected" --> dataset
  end
  uploader -- "1 record" --> route
  route -- "presigned URL" --> uploader
  uploader -- "2 JPEG" --> s3
  pull --> db
  pull --> s3
```

## Open questions

| Question | Decided by |
| --- | --- |
| The table keys and the sparse index for `pending` | The plan for the backend issue |
| The crop margin and the JPEG quality | The plan for the app issue, against a real scan |
| The App Store privacy label values for photos and the device ID | Before the first App Store submission |
| App Attest, to stop junk uploads | A new ADR, when abuse appears |

## Constraints

| ID | Constraint |
| --- | --- |
| SUD-01 | A failed upload MUST NOT block play or scanning. |
| SUD-02 | A photo MUST leave the device only through the setting "Help improve the app". Camera frames and cell images MUST NOT leave the device. An imported image MUST NOT leave the device. |
| SUD-08 | Scan photos MUST NOT be committed. |
| SUD-10 | Fixture cells MUST NOT appear in any training dataset. Scan cells never become fixtures. |
| SUD-11 | The AWS bill MUST stay below €10 a month. The scans route has its own throttle. The shared app key is not a secret. |
| Idempotence | A repeated `POST /v1/scans` with the same `scanId` MUST make no second item. |
