---
status: DRAFT
---

# ADR-012: SQLite for local data, behind repository interfaces, ready for sync

| Field   | Value      |
| ------- | ---------- |
| Project | Sudoku     |
| Status  | Proposed   |
| Date    | 2026-10-09 |
| Contact | Felix      |

## Context

The app stores puzzles in progress (F-03, QR-11), finished puzzles with times and history for
stats (F-09), the puzzle pool (ADR-011) and settings. Stats need queries such as "best time per
difficulty" and "current streak". A backend for accounts and sync may come later (TC-3), and
should not force a storage rewrite.

## Alternatives Evaluated

| Option | For | Against |
| --- | --- | --- |
| AsyncStorage | Simplest | Key-value strings only. Stats mean loading everything into memory. Slow as history grows |
| MMKV | Very fast key-value | Same lack of queries. Good for settings, weak for history |
| **expo-sqlite** | Real queries and indexes for stats. Transactions for safe saves. Rows map naturally to a later sync API | Schema and migrations to maintain |
| WatermelonDB or similar sync-first database | Sync built in | Picks the sync design before the backend exists |

## Decision

1. **expo-sqlite** for all app data: puzzles, moves or snapshots, history, pool, settings.
2. Access goes through **repository interfaces** (`PuzzleRepository`, `HistoryRepository`,
   `SettingsRepository`). Screens never write SQL. A sync layer can later wrap these.
3. **Sync-ready rows, no sync logic:** UUID primary keys, `created_at` and `updated_at` on every
   row, soft delete with `deleted_at`.
4. **Progress is saved on every move**, in a transaction, so a killed app resumes at the last move
   with its timer (QR-11).
5. Schema migrations are numbered SQL files run at startup. Whether to add a query builder
   (such as Drizzle) is decided when the schema has more than a handful of tables.

## Consequences

- The repository interfaces are where Jest tests (ADR-010 layer 2) swap in an in-memory fake.
- Scan photos and cell images are files on disk, referenced by path from SQLite rows, never
  stored as blobs.

## Reassessment Triggers

- The backend's sync design needs something the row conventions do not support.
