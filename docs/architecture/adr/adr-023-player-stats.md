---
status: DRAFT
---

# ADR-023: Player stats from the game history, with the abandoned result and a StatsRepository

| Field   | Value      |
| ------- | ---------- |
| Project | Sudoku     |
| Status  | Accepted   |
| Date    | 2026-10-14 |
| Contact | Felix      |

Amends [ADR-012](adr-012-local-persistence.md). ADR-012 gives the history table and
`HistoryRepository`. This ADR adds a third result, a `StatsRepository` and the rules of the stats.
The other points of ADR-012 stay.

## Context

Requirement F-09 asks for statistics and history. The history already holds one entry for each
won or lost game: the level, the source, the seed, the time played, the mistakes, the hints and
the finish time. `HistoryRepository.bestTimes()` already gives the best time of each level.

Three things are missing:

- A game that the player leaves is not in the history. Starting a new game soft-deletes the game
  in progress and keeps no trace of it.
- No repository gives the stats. A screen would have to read every entry and count them.
- No rule says how a stat is counted. Examples are the win rate, the average time and a streak.

A backend may come later (ADR-012, TC-3). A leaderboard may come after it. The stats are for the
player first. SUD-01 says the game works without a network, so the device keeps its own history
after a backend exists.

## Alternatives Evaluated

### Where to count the stats

| Option | For | Against |
| --- | --- | --- |
| Pure function in `@sudoku/core` over all entries | One set of rules. A Lambda can reuse it. SUD-04 allows it. Jest needs no database | Loads the whole history into memory. A second implementation of the rules is still needed for a remote source |
| **SQL aggregates in a `StatsRepository`** | The database does the work. Memory stays small as the history grows. The repository is the one seam to swap | Every implementation repeats the rules. A streak needs a harder query |
| Both, with SQL added later | Starts simple | Two code paths. The decision comes back when the history is large |

### What an abandoned game counts as

| Option | For | Against |
| --- | --- | --- |
| **Its own result, `abandoned`, outside the win rate** | Quitting does not hurt the stats. The game is still on record | A third value in the history |
| Counts as lost | Stricter. Closer to a leaderboard | A player who closes a game by accident loses a win rate point |
| Not recorded | Simplest | The player cannot see how many games they start and drop |

### A move log for a later leaderboard

| Option | For | Against |
| --- | --- | --- |
| **No move log** | Small entries. No work for a board that may never come | A server cannot replay a game. A board must trust the client |
| A move log with every finished game | A server can check time and mistakes | A bigger save. Work for a feature that is not planned |
| A move log for seeded puzzles only | A verified board is possible only there | A second code path |

## Decision

1. **The history has three results: `won`, `lost` and `abandoned`.** Migration 4 adds
   `abandoned`.
   - `result` has a CHECK constraint. SQLite cannot change a CHECK in place.
   - Migration 4 creates the new table, copies the rows, drops the old table and renames the new
     one. It creates the index `game_history_best_time` again.
   - `GameResult` gets the third value.
2. **A game becomes `abandoned` when a new game replaces it.**
   - `PuzzleRepository.start` writes the history entry in the same transaction that soft-deletes
     the old game.
   - A game with no move writes no entry. Opening a puzzle and leaving it does not count.
   - A game has moves when `hasMoves` in `@sudoku/core` says so. It has an undo step, a mistake or a hint. Selecting a cell is not a move.
   - The entry holds the time played, the mistakes and the hints up to that point.
3. **A `StatsRepository` gives the stats.** It sits next to `HistoryRepository`. Every method takes `StatsFilter`, which is `{ includeScanned: boolean }`.
   - `summary(level, filter)` takes a level, or `null` for all levels. It returns the counts, the win rate, the best and average time, the flawless wins and the average mistakes and hints.
   - `byLevel(filter)` returns the summary of each of the four levels.
   - `recentTimes(level, count, filter)` returns the times of the last won games, oldest first.
   - `streak(timeZone, filter)` returns the current and the longest day streak and the last 14 days.
   - The SQLite version counts the first three with aggregate queries. A screen never writes SQL (ADR-012).
   - The streak is the exception. SQLite has no time zones, so `computeStreak` in `@sudoku/core` groups the won times by day. Every implementation uses the same function.
4. **The rules of the stats are fixed here.**

   | Stat | Rule |
   | --- | --- |
   | Played | Won and lost games. Abandoned games are a separate count |
   | Win rate | Won divided by played. An abandoned game is not in the sum |
   | Best time | The shortest time of a won generated game without hints (ADR-012, amendment) |
   | Average time | The mean time of the same games as the best time: won generated games without hints. A level has an average only when it has a best time |
   | Flawless win | A won game with zero mistakes and zero hints |
   | Day streak | The number of days in a row with at least one won game, in the time zone that the caller gives. A streak stays alive until the end of the next day |
   | Scanned games | Off by default (`includeScanned`). A scanned level is an estimate (ADR-011). When on, scanned games count in every stat except the best and the average time |

   The streak counts back from today. A streak stays alive until the end of the next day.
5. **One contract test fixes the rules for every implementation.**
   - It extends `repositories.contract.ts`.
   - The SQLite repository and the in-memory fake must pass it. A future remote or sync
     implementation must pass it too.
   - The contract test is the one place that states the numbers for a given history.
6. **A sync layer wraps the local repositories. It does not replace them.**
   - Rows are append-only and have UUIDs (ADR-012), so a merge of two devices adds entries.
   - The device keeps its own stats after a backend exists (SUD-01).
   - A leaderboard is a separate remote service. It does not go through `StatsRepository`.
7. **The entry gets no move log.** A verified leaderboard needs a new ADR.

## Amendment 2026-10-14: reset in the development variant

`HistoryRepository.clear()` soft-deletes every history entry (ADR-012), so the list, the best times and the stats start
again. The game in progress stays. The stats screen shows a "Reset stats" button, after a question, only when
`isDevelopmentVariant()` is true (ADR-022). The production app has no way to delete the history.

## Consequences

- Migration 4 rebuilds `game_history`. It must run inside its transaction and keep every row.
- Starting a game writes one more row when the old game has moves.
- Every new implementation of `StatsRepository` repeats the rules. The contract test catches a
  difference.
- The streak is the one stat that SQL does not count. `computeStreak` reads every won time. This costs little until the history has tens of thousands of games.
- A game finished before a move log exists can never be on a verified board.
- The glossary gets the terms abandoned game, flawless win and day streak.

## Reassessment Triggers

- The history grows so large that an aggregate query is slow.
- The backend design needs a stat that the row conventions cannot give.
- The developer wants a verified leaderboard. Then write an ADR for the move log.

## Amendment 2026-10-15: the owner in the filter

[ADR-028](adr-028-history-sync.md) makes decision 6 concrete. `StatsFilter` gets
`owner: string | null`, a Clerk user ID. Every stat counts only the history entries of that owner. The contract test covers
the filter. The rules of decision 4 stay.

## Amendment 2026-10-21: one counted-game rule and one clock format

- `@sudoku/core` owns the rule for the best time and the average time: `countsForBestTime`. A counted game is a
  won generated game without hints. The in-memory fakes and the finish card call it.
- The SQL keeps its own copy of the rule (decision 3). The contract test builds the expected best time and
  average time from `list()` and `countsForBestTime`, and compares them with the SQL result.
- `formatClock` in `@sudoku/core` is the one time format. It rounds **down** to whole seconds. The timer on the
  game screen already rounded down. A time never shows a second that has not passed. The finish card
  and the stats screen both use it. The stats screen rounded to the nearest second before, so 59 999 ms read
  `01:00` there and `00:59` on the finish card. It now reads `00:59` in both places.
- The decisions above stay.
