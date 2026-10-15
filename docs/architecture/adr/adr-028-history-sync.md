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
history is append-only and every history entry has a UUID (ADR-012). A player can now sign in (ADR-027).

The sync must:

- back up every finished game,
- show the same history and stats on every device of the player,
- never block play or the stats (SUD-01),
- keep the games of two accounts on one phone apart.

## Alternatives Evaluated

### What syncs

| Option | For | Against |
| --- | --- | --- |
| **The history only** | History entries never change after the finish, so a merge never conflicts | A game in progress stays on one device |
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

### The owner on the phone

| Option | For | Against |
| --- | --- | --- |
| **The Clerk user ID** | The app knows it at sign-in, also offline. No call to the server | A switch of sign-in provider changes it. The app must adopt the old history entries once |
| Our own user ID | It never changes | The app knows it only after a first sync. A game finished offline before that has no known owner |

## Decision

1. **Only finished games sync.** Won, lost and abandoned history entries travel. The game in
   progress and the settings stay on the device.
2. **Every history entry has an owner.** The owner is the Clerk user ID: the `sub` of the Clerk
   token. The app knows it at sign-in, also offline. The phone never holds our own user ID.
   - Migration 5 adds `owner_id TEXT` and `pushed_at TEXT` to `game_history`. A null `owner_id`
     means no owner.
   - It creates `sync_state (key TEXT PRIMARY KEY, value TEXT)` for the cursor and the owner of
     that cursor.
   - The app keeps the last signed-in Clerk user ID in the Keychain (`expo-secure-store`). At
     start, the owner is this cached ID until Clerk has loaded. A game started offline, or
     before Clerk loads, keeps the owner of the player who signed in.
   - The app reads the Keychain once at start and renders after that read. The read is local and
     fast, and a failed read gives no cached ID. The app never waits for Clerk (SUD-01).
   - When Clerk loads signed in, the owner is its user ID and the app stores it. When Clerk loads
     signed out, or the player signs out, the app clears the cache and the owner is null.
   - A game finished while signed out gets no owner.
   - A game finished while signed in gets the owner.
   - `StatsFilter` gets `owner: string | null`. Every stat counts only the history entries of that
     owner.
   - The server maps the Clerk user ID to our own user ID through the identity row (ADR-027).
3. **Accounts on one phone.**

   | Event | What the app does |
   | --- | --- |
   | The first sign-in | It asks "Add the games on this phone to your account?". On yes, the history entries without an owner get the owner |
   | Sign out | The sync stops. The history entries of the account stay but are hidden |
   | Another account signs in | The app clears the cursor and downloads the games of that account |
   | Delete account | The server deletes the rows. The app deletes the local history entries of that owner |
   | The server answers 410 `account_deleted` | The app signs out. It deletes the local history entries of that owner and clears the cursor. It keeps nothing of that account |
   | The player signs in with a new sign-in provider | The Clerk user ID changes. The app adopts the local history entries of the old owner once |

4. **The waiting list.** The waiting list is the history entries of the signed-in owner where
   `pushed_at` is null or differs from `updated_at`.
   - `pushed_at` never holds a clock time. It holds the `updatedAt` value that the server
     accepted, or the `updatedAt` of a downloaded history entry.
   - The app compares `pushed_at` and `updated_at` for inequality only, never for older or newer.
   - A soft delete sets `updated_at`, so the history entry goes back on the waiting list.
   - `markPushed` takes the pushed pairs (id, updatedAt) of the accepted ids. It sets
     `pushed_at = updatedAt` only where the `updated_at` of the row still equals that value. A
     soft delete during the call keeps the history entry on the waiting list.
   - `HistoryRepository.upsertRemote` writes a downloaded history entry with
     `pushed_at = updated_at`. It writes only a new history entry or a newer `updatedAt`. When the
     downloaded `updatedAt` equals the local `updated_at`, it sets only `pushed_at`.
5. **One call, `POST /v1/sync`.**
   - The request holds up to 100 history entries and the last cursor.
   - The response holds the accepted ids, up to 500 changes, the next cursor and `more`.
   - The server accepts an id when it stored the history entry, or when it already holds an equal
     or newer `updatedAt` for that id. So a lost response is harmless: the retry gets the same
     accepted ids.
   - The response includes the caller's own changes. The app upserts them and nothing changes.
   - A null cursor returns everything, for recovery and for a new device.
6. **The server rules.**
   - It stores a history entry only when it is new or its `updatedAt` is newer. A retry changes
     nothing.
   - It stamps `syncedAt` on every stored history entry. The device clock never decides what is
     new.
   - It reads the changes from the local index `bySynced` in ascending `syncedAt` order.
   - Every item carries `schemaVersion`.
   - **The cursor format.**

     | Part | Meaning |
     | --- | --- |
     | `v` | The cursor format version, `1` |
     | `since` | The watermark: the highest `syncedAt` that the device has pulled. Null for a full pull |
     | `after` | The `LastEvaluatedKey` of DynamoDB when a pull stops at a page edge, else null |

     - The server sends the cursor as base64url of this JSON.
     - The app stores the string and never reads it.
   - **The read.**
     - The server reads the rows where `syncedAt` is at or after `since` minus 5 minutes.
     - The overlap catches a slow write from another device.
     - A null `since` reads every row. This is a full pull.
     - Only the server clock sets `since`. The phone clock never decides what is new.
   - **The paging.**
     - The server reads at most 500 rows per call. It uses `after` as the `ExclusiveStartKey`.
     - When DynamoDB returns a `LastEvaluatedKey`, the response has `more: true`.
     - The next cursor keeps the same `since` and puts the key in `after`.
     - The query stays identical, so no row is lost at a page edge.
   - **The end of the read.** When DynamoDB returns no `LastEvaluatedKey`, the response has
     `more: false`. The next cursor has `after` null. Its `since` is the first value that exists
     in this list:
     1. the `syncedAt` of the last row that this call read,
     2. the `syncedAt` in the `after` of the request, when this call read no rows after a page edge,
     3. the old `since`.
   - **Repeated rows.** The overlap sends some rows again. `upsertRemote` makes a second copy
     change nothing.
   - **The errors.**
     - The server refuses with 400 `invalid_cursor` a cursor that it cannot decode.
     - It refuses with 400 `invalid_cursor` an `after` whose `pk` is not the partition of the
       caller.
     - The app then clears the cursor and makes a full pull.
7. **The triggers.** The app syncs when a game ends, when the app comes to the foreground, when the
   network comes back while the app is open, and after sign-in. iOS does not run these in the
   background.
8. **A failure is silent.** A failed sync keeps the waiting list and tries again at the next
   trigger. The responses that are not a success:

   | Status | Code | Cause | What the app does |
   | --- | --- | --- | --- |
   | 400 | `invalid_request` | The body does not match the sync contract | Keeps the waiting list. Tries again at the next trigger |
   | 400 | `invalid_cursor` | The server cannot use the cursor | Clears the cursor. Makes a full pull |
   | 401 | — | The JWT authorizer refuses the token | Gets a fresh token at the next trigger |
   | 410 | `account_deleted` | The identity row of the `sub` is a tombstone (ADR-027) | Signs out. Keeps nothing of that account (decision 3) |
   | 429 | — | The API throttle or the kill switch (ADR-027) | Counts it as offline |

   The daily count never gives a 429. At the cap the server stores what fits (ADR-027, decision
   9). The other history entries stay on the waiting list.
9. **The rows in DynamoDB.**

   | Row | pk | sk | Fields |
   | --- | --- | --- | --- |
   | Identity | `IDENTITY#clerk#<sub>` | `IDENTITY` | userId, createdAt. A tombstone also has deletedAt and a TTL of 30 days |
   | Game | `USER#<userId>` | `GAME#<uuid>` | schemaVersion, level, source, result, seed, playedMs, mistakes, hintsUsed, finishedAt, createdAt, updatedAt, deletedAt, syncedAt |
   | Daily count | `USER#<userId>` | `COUNT#<yyyy-mm-dd>` | writes, a TTL of 2 days |

   The local index `bySynced` has the sort key `syncedAt`. It exists from the first deploy,
   because DynamoDB cannot add a local index later.
10. **The stats stay on the device.** The SQL of ADR-023 counts from the merged history. The
    contract test of ADR-023 also covers the owner filter.

## Consequences

- `HistoryRepository` gets `pending(owner, limit)`, `markPushed(pushed)` and
  `upsertRemote(entries, owner)`. `pushed` is a list of (id, updatedAt) pairs. The in-memory fake
  and the SQLite version pass the same contract.
- `PuzzleRepository.start` and the finish write the owner of the signed-in player.
- The game and the stats never import `src/account/` or `src/sync/`. A dependency-cruiser rule
  enforces it, as for SUD-03 to SUD-05.
- A new device downloads the full history once. Ten years of daily play is about 7 MB.
- A daily count row costs one write per sync that stores a history entry. It limits a misuse
  (SUD-11).
- The adoption of the history entries of an old owner after a switch of sign-in provider is deferred. The app never
  moves the entries of another owner. It adopts only the entries without an owner.

## Amendment 2026-10-15: the sync in the app

The app code in `src/sync/` follows these rules. They do not change decisions 1 to 10.

| Topic | Rule |
| --- | --- |
| The service | `SyncService` runs one sync at a time. A trigger during a run asks for one more run. A burst makes one extra run |
| Triggers | A game end, the foreground, the network back and the sign-in. The storage tells the service about a game end through `GameStorage.subscribe`, so `game/` and `stats/` import nothing from `sync/` |
| A start | The sync starts only when Clerk has loaded signed in. A cached owner has no token |
| The run | It pushes batches of 100 and pulls every page. It saves the cursor after each stored page. It stops after 20 requests with the result `partial`, which is not a failure and has no backoff. The service then starts at most 5 follow-up runs at once. After that, the next trigger continues |
| A 401 | The run retries once at once with a token that skips the Clerk cache. A second 401 in a row is a failure with the normal backoff |
| A session change | A sign-out or an account switch aborts the request that is in flight. A run of an old session never changes the status or the backoff of the new one |
| Accepted ids | The run marks only the accepted entries that it sent. An entry that the server leaves out stays on the waiting list. The run stops when the server accepts none |
| A bad entry | An entry that breaks the contract, or a CHECK of the database, is dropped and logged. It never blocks the cursor |
| The backoff | After a failure the wait before the next trigger is 30 seconds, doubled for each failure, at most 15 minutes. `Retry-After` of a 429 counts when it is longer. The network and the sign-in trigger skip the wait. No timer retries |
| `sync_state` | The keys are `cursor`, `cursorOwner`, `syncedAt:<owner>` and `adoptAsked:<owner>`. The cursor of another owner reads as null |
| The adopt prompt | At sign-in the app counts the live entries without an owner. If there are some, it asks once for each account. A "Not now" is remembered and the entries stay without an owner |
| 410 | The app deletes every local entry of the owner with `HistoryRepository.deleteOwner`, clears the state of the owner and signs out. It shows one alert. The service stays stopped for that owner until the app starts again. `deleteOwner` is the only hard delete of the history |
| The line | The stats screen shows "Synced 5 min ago" only when signed in and after a first sync |
| The network | `expo-network` tells the app when the network comes back. The app reads the state once at the start, so the first reconnect after an offline start triggers. It is a native module, so it needs a new development build |
| The API URL | `extra.syncApiUrl` in `app.config.ts`. The development variant has the `felix` stage. `SYNC_API_URL` overrides it. The production variant has none, so it does not sync until the production stage exists |

The run reads up to 1000 rows of the waiting list to find one batch of valid entries. An entry that
breaks the contract stays on the list, and the app never deletes it. More than 900 such entries at the
head of the list block the valid entries behind them. This limit is accepted for version 1.

## Reassessment Triggers

- The player wants to continue a game on another device.
- The settings should follow the player.
- One player's history nears the 10 GB limit of a partition with a local index.

## Amendment 2026-10-15: the sync API

The build of `POST /v1/sync` makes decisions 5, 6 and 9 concrete. The code is in
[`services/sync-api/`](../../../services/sync-api/README.md).

1. **The TTL attribute is `expiresAt`, a number in epoch seconds.** A table has one TTL
   attribute, so the tombstone and the daily count share it. The daily count expires at the start
   of its UTC day plus 2 days.
2. **One transaction per history entry.** It puts the game row with the `updatedAt` condition and
   adds 1 to the daily count with the cap condition. The count stays exact under parallel
   requests. The entries go in request order. After the cap the loop goes on, so a later no-op is
   still accepted. A transaction conflict gets 2 retries. After that, the history entry stays on
   the waiting list.
3. **The game row has no `id` attribute.** The id lives in `sk`.
4. **Every 200 response has a cursor string,** also for an empty full pull. The contract still
   allows a null cursor in the request.
5. **The pull is a consistent read.** A local index allows it, so the push of the same request
   shows in the pull.
6. **The empty last page.** DynamoDB returns a `LastEvaluatedKey` when a page stops at exactly
   500 rows, also when no row follows. The next call reads no rows and takes `since` from the
   `after` of its request (rule 2 of "the end of the read").


## Amendment 2026-10-15: delete the account

The build of `DELETE /v1/account` makes decisions 3 and 9 concrete. The details are in the
amendment "delete the account" of
[ADR-027](adr-027-backend-platform.md).

1. **The tombstone keeps `userId` and `createdAt`.** It adds `deletedAt` and `expiresAt`. The
   delete needs the `userId` to remove the rows.
2. **The server deletes the rows of both kinds.** The game rows and the daily count rows share
   the partition `USER#<userId>`. The tombstone comes first and the Clerk user last, so no row
   stays after a failed step and a retry. A push refuses to write after the tombstone: it answers
   410 `account_deleted`.
3. **The app flow is: the API call first, then the local cleanup, then the sign-out.** The app
   half follows in a later change.

## Amendment: delete the account in the app

1. **The server goes first.** The app takes one fresh `sudoku-api` token and calls `DELETE /v1/account`. After the
   Clerk user is deleted, Clerk cannot give a new token. For this reason a retry after a network error or a 5xx
   keeps the same token. The app retries 2 times, 1 second apart.
2. **Only a 2xx changes the phone.** The app stops the sync service and waits for the run that goes on. Then it
   deletes the history entries of the owner, clears the sync state and signs out. The Keychain owner cache is
   cleared when the sign-out fails.
3. **Offline or a failure changes nothing.** The app shows a message. The player can try again.
