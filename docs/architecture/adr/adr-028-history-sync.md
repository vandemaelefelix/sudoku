---
status: DRAFT
---

# ADR-028: The history sync: one push-and-pull call, an owner per history entry, stats on the device

| Field   | Value      |
| ------- | ---------- |
| Project | Sudoku     |
| Status  | Proposed   |
| Date    | 2026-10-15 |
| Contact | Felix      |

Amends [ADR-012](adr-012-local-persistence.md) (migration 5) and
[ADR-023](adr-023-player-stats.md) (the owner in `StatsFilter`). Makes decision 6 of ADR-023
concrete. The platform is in [ADR-027](adr-027-backend-platform.md). The concept is
[history-sync](../00-concepts/history-sync.md).

## Context

ADR-023 says that a sync layer wraps the local repositories and does not replace them. The
history is append-only and every entry has a UUID (ADR-012). A player can now sign in (ADR-027).

The sync must:

- back up every finished game,
- show the same history and stats on every device of the player,
- never block play or the stats (SUD-01),
- keep the games of two accounts on one phone apart.

## Alternatives Evaluated

### What syncs

| Option | For | Against |
| --- | --- | --- |
| **The history only** | Entries never change after the finish, so a merge never conflicts | A game in progress stays on one device |
| The history and the settings | The look follows the player | The first last-write-wins conflicts |
| The history, the settings and the game in progress | Continue on another device | Two devices can play the same game. Real conflicts |

### Where the stats are counted

| Option | For | Against |
| --- | --- | --- |
| **On each device, from the full history** | The SQL of ADR-023 stays. Works offline. One set of rules | Each device downloads the full history once |
| In the cloud | One source of numbers. No download | DynamoDB cannot count. The stats screen needs a network |

The leaderboard compares players, so the cloud counts it. It is a later feature.

### The sync protocol

| Option | For | Against |
| --- | --- | --- |
| **One `POST /v1/sync`: push, then pull, with a server cursor** | One round trip. The phone clock never decides what is new | A cursor to keep |
| Separate push and pull routes | Simple routes | Two round trips. The same cursor problem |
| A sync engine (PowerSync, ElectricSQL) | Sync is solved | Heavy for append-only rows. A new vendor |

### Two accounts on one phone

| Option | For | Against |
| --- | --- | --- |
| **An owner on every history entry** | Accounts stay apart. Sign-out keeps the games | One column. Every query filters on it |
| Delete the local history on sign-out | Simple | A sign-out loses the games that did not upload |
| One database per account | Full separation | Many files. The game in progress needs a home |

## Decision

1. **Only finished games sync.** Won, lost and abandoned history entries travel. The game in
   progress and the settings stay on the device.
2. **Every history entry has an owner.**
   - Migration 5 adds `owner_user_id TEXT` and `pushed_at TEXT` to `game_history`. Null means no
     owner.
   - It creates `sync_state (key TEXT PRIMARY KEY, value TEXT)` for the cursor and the user.
   - A game finished while signed out gets no owner.
   - A game finished while signed in gets the owner.
   - `StatsFilter` gets `owner: string | null`. Every stat counts only the entries of that owner.
3. **Accounts on one phone.**

   | Event | What the app does |
   | --- | --- |
   | The first sign-in | It asks "Add the games on this phone to your account?". On yes, the entries without an owner get the owner |
   | Sign out | The sync stops. The entries of the account stay but are hidden |
   | Another account signs in | The app clears the cursor and downloads the games of that account |
   | Delete account | The server deletes the rows. The app deletes the local entries of that owner |

4. **The waiting list.** The waiting list is the entries of the signed-in owner where `pushed_at`
   is null or older than `updated_at`.
   - A soft delete sets `updated_at`, so the entry goes back on the waiting list.
   - The app marks as sent only the ids that the server accepted.
   - Downloaded entries are written with `pushed_at` set, through `HistoryRepository.upsertRemote`.
5. **One call, `POST /v1/sync`.**
   - The request holds up to 100 entries and the last cursor.
   - The response holds the accepted ids, up to 500 changes, the next cursor and `more`.
   - The response includes the caller's own changes. The app upserts them and nothing changes.
   - A null cursor returns everything, for recovery and for a new device.
6. **The server rules.**
   - It stores an entry only when it is new or its `updatedAt` is newer. A retry changes
     nothing.
   - It stamps `syncedAt` on every accepted write. The device clock never decides what is new.
   - It reads the changes from the local index `bySynced` in ascending `syncedAt` order.
   - Every item carries `schemaVersion`.
   - **The cursor** holds the watermark and the page key:

     | Part | Meaning |
     | --- | --- |
     | `v` | The cursor format version, `1` |
     | `since` | The watermark: the highest `syncedAt` that the device has pulled. Null for a full pull |
     | `after` | The `LastEvaluatedKey` of DynamoDB when a pull stops at a page edge, else null |

   - The server sends the cursor as base64url of this JSON. The app stores the string and never
     reads it.
   - The server reads the rows where `syncedAt` is at or after `since` minus 5 minutes. The
     overlap catches a slow write from another device. A null `since` reads every row.
   - The server reads at most 500 rows per call. It uses `after` as the `ExclusiveStartKey`.
   - When DynamoDB returns a `LastEvaluatedKey`, the response has `more: true`. The next cursor
     keeps the same `since` and puts the key in `after`. The query stays identical, so no row is
     lost at a page edge.
   - When the read ends, the response has `more: false`. The next cursor has `after` null. Its
     `since` is the `syncedAt` of the last row read. If the read gave no rows, `since` stays.
   - The overlap sends some rows again. `upsertRemote` makes a second copy change nothing.
   - The server refuses with 400 a cursor that it cannot decode, or an `after` whose `pk` is not
     the partition of the caller. The app then clears the cursor and makes a full pull.
   - Only the server clock sets `since`. The phone clock never decides what is new.
7. **The triggers.** The app syncs when a game ends, when the app comes to the foreground, when the
   network comes back while the app is open, and after sign-in. iOS does not run these in the
   background.
8. **A failure is silent.** A failed sync keeps the waiting list and tries again at the next
   trigger. A 429 from the spending cap counts as offline.
9. **The rows in DynamoDB.**

   | Row | pk | sk | Fields |
   | --- | --- | --- | --- |
   | Identity | `IDENTITY#clerk#<sub>` | `IDENTITY` | userId, createdAt |
   | Game | `USER#<userId>` | `GAME#<uuid>` | schemaVersion, level, source, result, seed, playedMs, mistakes, hintsUsed, finishedAt, createdAt, updatedAt, deletedAt, syncedAt |
   | Daily count | `USER#<userId>` | `COUNT#<yyyy-mm-dd>` | writes, a TTL of 2 days |

   The local index `bySynced` has the sort key `syncedAt`. It exists from the first deploy,
   because DynamoDB cannot add a local index later.
10. **The stats stay on the device.** The SQL of ADR-023 counts from the merged history. The
    contract test of ADR-023 also covers the owner filter.

## Consequences

- `HistoryRepository` gets `pending(owner, limit)`, `markPushed(ids, at)` and
  `upsertRemote(entries, owner)`. The in-memory fake and the SQLite version pass the same contract.
- `PuzzleRepository.start` and the finish write the owner of the signed-in player.
- The game and the stats never import `src/account/` or `src/sync/`. A dependency-cruiser rule
  enforces it, as for SUD-03 to SUD-05.
- A new device downloads the full history once. Ten years of daily play is about 7 MB.
- A daily count row costs one write per sync. It limits a misuse (SUD-11).

## Reassessment Triggers

- The player wants to continue a game on another device.
- The settings should follow the player.
- One player's history nears the 10 GB limit of a partition with a local index.
