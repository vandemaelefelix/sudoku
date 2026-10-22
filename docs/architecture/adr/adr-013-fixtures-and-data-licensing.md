---
status: DRAFT
---

# ADR-013: Public-safe fixtures in git, real-world scans private, every data source licensed

| Field   | Value      |
| ------- | ---------- |
| Project | Sudoku     |
| Status  | Proposed   |
| Date    | 2026-10-09 |
| Contact | Felix      |

## Context

The repository is private now and goes public for the portfolio later (07). Three kinds of data
are involved, and not all of them may be published:

- Photos of newspaper and puzzle-book pages are copyrighted puzzles and layouts.
- Synthetic training data is rendered with fonts, and each font has its own licence.
- EMNIST is derived from NIST data. The real cells and photos in `ml/data/` include images
  downloaded from the web, with no licence.

The promote gate needs fixtures (ADR-007), and QR-01 / QR-02 talk about newspapers and books
specifically.

## Decision

1. **Two fixture sets with the same layout** (`<split>/<id>/photo.jpg`, `truth.json`, `cells/`):
   - **Public** in `fixtures/scans/`, committed. Only puzzles this project generated (ADR-011),
     printed in several fonts and on several papers, some filled in by hand, some photographed
     inside a book to curve them. The puzzles are ours, so the photos can be published.
   - **Private** in `ml/data/fixtures-private/`, not committed (SUD-08), backed up with the rest
     of `ml/data/`. Real newspaper and puzzle-book pages. This is where QR-01 and QR-02 are
     measured.
2. `just promote-model` scores **both** sets when the private one is present, and records both in
   the manifest. CI scores only the public set.
3. **Fonts** for synthetic data come only from licences that allow this use (SIL Open Font
   Licence or similar). `ml/fonts/` holds the files together with each licence.
4. **Every dataset source has a provenance line** in `ml/DATA_SOURCES.md`: origin, licence, and
   whether derived models may be published. EMNIST's terms are checked and recorded before it is
   used. Data that may not be published may train models that stay private. It never goes into
   `fixtures/`, and a model trained on it is not published.
5. **App Store, if it ever ships:** a camera usage text that says scans stay on the phone, and the
   privacy label "Data Not Collected". Both follow from SUD-01 and SUD-02.

## Consequences

- The public fixture set can be built before any newspaper is photographed, from the game's own
  puzzles.
- Public-set scores can be optimistic, because own prints are cleaner than newsprint. Only the
  private set decides QR-01 and QR-02.

## Reassessment Triggers

- The repository goes public. Re-check every file under `fixtures/` and `ml/fonts/` before the
  switch.

## Amendment 2026-10-15: the privacy labels with an account

ADR-027 adds an optional account. The label "Data Not Collected" is now true only for a player without an account.
It no longer describes the app as a whole. Decision 5 stays valid for the camera text.

1. **The App Store privacy labels declare the data of a signed-in player.** All data is linked to the player. None is
   used for tracking.

   | Data type | Purpose |
   | --- | --- |
   | Contact info: email address | App functionality (sign-in) |
   | Identifiers: user ID | App functionality |
   | Gaming: gameplay content (the finished game history) | App functionality (backup and sync) |
   | Name, if Clerk stores the name from Google | App functionality |

2. **These data types stay undeclared:** photos and videos, camera frames, location, advertising ID, diagnostics and
   usage data (SUD-02).
3. **A privacy policy page is required.** The source is [`docs/privacy/privacy-policy.md`](../../privacy/privacy-policy.md).
   The App Store form and the Google consent screen link to the public page.
   Vercel hosts the page at `https://sudoku.felixvandemaele.be/privacy`. `site/build.mjs` renders it from the source.

## Amendment 2026-10-16: the privacy labels with scan collection

[ADR-030](adr-030-scan-collection.md) uploads scan photos and a device ID. This amends decision 5 and the first
amendment.

1. **The App Store privacy labels also declare these data types.** All data is linked to the player. None is used for
   tracking.

   | Data type | Purpose |
   | --- | --- |
   | Photos or videos: photos (the scan photo) | App functionality (improve the cell classifier) |
   | Identifiers: device ID (the contributor ID) | App functionality |

2. **"Data Not Collected" is no longer true** for any player. The exact label values are fixed before the first
   submission.
3. **Photos and videos leave the list of undeclared data types** in the first amendment. Camera frames, location,
   advertising ID, diagnostics and usage data stay undeclared.
4. **The camera text** says that the scan runs on the phone and that the app can upload the photo of a finished scan.
   The player can turn this off in Settings.
5. **Scan photos stay out of git** (SUD-08). Scan cells never become fixtures (SUD-10).

## Amendment 2026-10-22: the camera text only asks for the camera

Point 4 of the amendment of 2026-10-16 put the upload in the camera text. This amendment replaces that point, and the
camera text of decision 5.

1. **The camera text only asks for the camera:** "Sudoku uses the camera to scan a paper sudoku." The Dutch text says
   the same.
2. **The camera text makes no claim about uploads.** "Help improve the app" has its own first-upload notice
   ([ADR-030](adr-030-scan-collection.md)). The old text "The photos never leave your iPhone" was not true with that
   setting on.
3. **The privacy labels do not change.** The amendment of 2026-10-16 still holds for them.
