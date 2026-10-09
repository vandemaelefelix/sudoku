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
- EMNIST is derived from NIST data, and the ~21k images from the 2020 repository have no
  recorded source.

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
   used. The 2020 images are **not used** unless their origin is established.
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
