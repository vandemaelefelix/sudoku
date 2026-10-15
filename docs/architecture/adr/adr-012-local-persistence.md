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

## Amendment: the seed and the best time (2026-10-12)

- Migration 3 adds a nullable `seed INTEGER` column to `game_in_progress` and `game_history`.
  A generated game stores its seed (ADR-011, amendment "the puzzle number"). A scanned game
  and a game saved before migration 3 store null.
- The best time of a level is the shortest time played of a won **generated** game without
  hints. A scanned game never counts, because its level is an estimate (ADR-011).

## Amendment 2026-10-14: the abandoned result and the stats

[ADR-023](adr-023-player-stats.md) amends this ADR. The history gets a third result, `abandoned`
(migration 4). A new `StatsRepository` counts the stats. The other points stay.

## Consequences

- The repository interfaces are where Jest tests (ADR-010 layer 2) swap in an in-memory fake.
- Scan photos and cell images are files on disk, referenced by path from SQLite rows, never
  stored as blobs.

## Reassessment Triggers

- The backend's sync design needs something the row conventions do not support.

## Amendment 2026-10-12: the first tables

The first repositories make these points of the decision concrete:

1. **Snapshots, not moves.** A save writes the whole game as its saved game (JSON) in one row. Undo steps are part of the saved game. A saved game that does not load stays in the table: `current()` gives no game, and only the start of a new game soft-deletes it. A new saved game version needs a migration that converts `saved_game`.
2. **One game in progress.** Starting a game soft-deletes the game in progress before it.
3. **Finish in one transaction.** The last save of a won or lost game soft-deletes the game in progress and writes its history entry in the same transaction. The history entry takes the id of the game.
4. **Numbered migrations.** The migrations are an ordered list in `apps/mobile/src/storage/migrations.ts`. `PRAGMA user_version` holds the last one that ran. An app refuses a database that is newer than itself. Each migration reads the version again inside its transaction, so it never runs twice. A migration that meets another writer fails with "database is locked", writes nothing, and runs at the next call of `openStorage()`.
5. **Saves run in order.** A save waits for the save before it, so the last move always wins. The queue belongs to one storage. `openStorage()` gives the same storage to every call, so the app has one connection and one queue.
6. **Jest runs the real SQL.** The repositories use a small SQL interface. In Jest it runs on the SQLite that Node has built in, so the tests check the SQL, the migrations and the transactions. The Jest adapter does what expo-sqlite 57 does on the phone:
   - The database file uses the write-ahead log (WAL).
   - `withExclusiveTransactionAsync` opens a second connection and runs a plain (deferred) `BEGIN` on it.
   - No connection has a busy timeout. A write while another connection writes fails at once with "database is locked".
   - A read on the main connection during a transaction sees the last commit.

   The in-memory fake passes the same contract tests.
7. **Best time without hints.** The best time of a level counts only won games with zero hints.

The time played is saved with each move. Time after the last move and before the app is killed is lost.

## Amendment 2026-10-15: the owner and the waiting list

[ADR-028](adr-028-history-sync.md) amends this ADR. Migration 5 adds `owner_user_id` and
`pushed_at` to `game_history` and creates `sync_state`. `HistoryRepository` gets `pending`,
`markPushed` and `upsertRemote`. The other points stay.
