# sync-api

The Lambda of `POST /v1/sync` and `DELETE /v1/account`. It backs up the finished games of a player and returns the games of
the other devices of that player. The decisions are in
[ADR-027](../../docs/architecture/adr/adr-027-backend-platform.md) and
[ADR-028](../../docs/architecture/adr/adr-028-history-sync.md). The concept is
[history-sync](../../docs/architecture/00-concepts/history-sync.md).

## What is here

| File | Holds |
| --- | --- |
| `src/handler.ts` | The Lambda entry. It builds the dependencies and calls `route()`. The only file that imports `sst` |
| `src/route.ts` | The dispatch on the route key. One log line per request. A 500 on an unexpected error |
| `src/sync.ts` | The steps of one sync, in the order of the table below |
| `src/account.ts` | `DELETE /v1/account`: the tombstone, the rows in pages, then the Clerk user |
| `src/clerk.ts` | The Clerk Backend API call that deletes a user. 200, or 404 with `resource_not_found`, means deleted |
| `src/identity.ts` | Find or create the identity row. A tombstone gives `AccountDeleted` |
| `src/push.ts` | The write rule and the daily count: one transaction per history entry |
| `src/pull.ts` | The query on `bySynced` and the next cursor |
| `src/cursor.ts` | Encode and decode the cursor. `nextCursor()`, the end-of-read rule |
| `src/tableDesign.ts` | The key names, the index, the TTL attribute and the key builders. No imports. `backend/infra/storage.ts` reads it |
| `src/items.ts` | A history entry to a game row and back |
| `src/dailyCount.ts` | The day key and the TTL of a daily count row |
| `src/http.ts` | The response bodies of the sync contract |
| `src/log.ts` | The logger with an allow-list of fields |
| `test/unit/` | Tests without DynamoDB |
| `test/db/` | Tests against DynamoDB Local. Each file creates its own table from `tableDesign.ts` |
| `scripts/smoke.ts` | The smoke test of a deployed stage |

## The steps of a sync

A step that refuses stops the call. No refusal writes a row.

| Step | Does | Refusal |
| --- | --- | --- |
| 1 | Read `sub` from the claims of the JWT authorizer. Never from the path or the body | 401 |
| 2 | Decode the body and check it with `syncRequestSchema` | 400 `invalid_request` |
| 3 | Decode the cursor | 400 `invalid_cursor` |
| 4 | Find or create the identity row | 410 `account_deleted` for a tombstone |
| 5 | Check that `after.pk` is the partition of the caller | 400 `invalid_cursor` |
| 6 | Push each history entry, in request order, up to the daily count | — |
| 7 | Pull from `bySynced`, from `since` minus 5 minutes, at most 500 rows | — |

The push runs before the pull, so the response holds the own changes of the caller.

## Delete the account

`DELETE /v1/account` takes no body. The player comes only from the `sub` of the token.

| Answer | When |
| --- | --- |
| 204, no body | The tombstone, the rows and the Clerk user are done. A second call also gives 204 |
| 401 | The token has no `sub` |
| 500 | Clerk failed, or a DynamoDB call failed. A retry of the whole call is safe. After a Clerk failure the player stays tombstoned: a sync answers 410 |

The route needs Clerk on the stage: it reads the secret `ClerkSecretKey`, which `backend/infra/api.ts` links wherever the API exists. Without the secret the call answers 500 with the log name `ClerkError`. It never logs the `sub`, the token or the Clerk answer.

## Logging

The Lambda writes one JSON line per request: the request ID, the route, the status, the error
code, our user ID and the counts. The logger drops every other field.

- Do not log the event, the headers, the body or the claims. They hold the token, the `sub` and
  the email.
- Do not log `error.message`. A DynamoDB message can hold a key, and the identity key holds the
  `sub`.

## Tests

| Command | Runs |
| --- | --- |
| `pnpm --filter @sudoku/sync-api test` | The unit tests. `just test-ts` runs them |
| `just test-api` | The DB tests. It starts DynamoDB Local in Docker first |
| `just test` | Both, and every other test of the repository |
| `just dynamodb-down` | Stops and removes the DynamoDB Local container |

DynamoDB Local runs in one container, `sudoku-dynamodb`, on port 8000. All worktrees share it.
Set `DYNAMODB_PORT` to use another port. The tests refuse an endpoint that is not local, and they
use fixed local credentials. DynamoDB Local does not delete expired rows, so the tests check the
`expiresAt` value only.

## Deploy and smoke test

The deploy needs the Clerk issuer of the stage in `backend/infra/config.ts`. See
[`backend/infra/README.md`](../infra/README.md).

1. Sign in to AWS: `just aws-login`.
2. Deploy: `just deploy-api felix`.
3. In the Clerk dashboard of the development instance, create a smoke user with a verified email.
   Copy its user ID (`user_...`).
4. Export the secret key of the development instance in your own shell:
   `export CLERK_SECRET_KEY=sk_test_...`. Do not paste it in a chat.
5. Run `just smoke-api felix <user id>`. It prints one line per check and never a token.
6. In CloudWatch, open the log group of `SyncApiFunction`. Check that no line holds a token, a
   `sub` or an email.

The smoke test refuses `production` and a live Clerk key. It creates a Clerk session, gets tokens
from the JWT template `sudoku-api`, and revokes the session at the end.

| Check | Expected |
| --- | --- |
| No token | 401 |
| A session token without the template (no `aud`) | 401 |
| An empty sync | 200 |
| One history entry | 200, the id in `acceptedIds`, the entry in `changes` |
| The same history entry with the new cursor | 200, the entry back in `changes` (the overlap) |
| A bad cursor | 400 `invalid_cursor` |
| 15 fast requests | At least one 429 (the throttle) |

## Clerk setup

The Clerk dashboard steps (the instances, the JWT template `sudoku-api`, the issuer) come with
the Clerk setup. Add them here then.
