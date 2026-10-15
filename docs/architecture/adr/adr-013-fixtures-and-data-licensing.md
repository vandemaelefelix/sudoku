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
