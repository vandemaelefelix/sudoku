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
11. **Training takes `verified` and `app-edited` cells by default.** `app-unedited` cells need a flag. The label
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
