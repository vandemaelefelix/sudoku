---
status: DRAFT
---

# ADR-027: The backend platform: Clerk for sign-in, a serverless API on AWS, built with SST

| Field   | Value      |
| ------- | ---------- |
| Project | Sudoku     |
| Status  | Proposed   |
| Date    | 2026-10-15 |
| Contact | Felix      |

Supersedes TC-3 ("no backend in v1") in part. The game still never needs the backend (SUD-01).
The sync protocol is in [ADR-028](adr-028-history-sync.md). The
[architecture page](https://claude.ai/artifact/H4bYEsdcyTmHtWbwQZrN5F) shows the whole backend
on one page.

## Context

Part 3 of the project is the backend (F-14). The first version has one job: a player signs in,
and the finished games are backed up and shared across the devices of that player. Later
features build on the same backend:

- a leaderboard,
- shared scans and corrections as training data (F-11).

The backend has these limits:

- It is a hobby project. The bill must stay near €0. A misuse must never cost more than €10 in
  a month.
- The developer knows SST in TypeScript and has some AWS experience. The developer does not know
  Terraform.
- A player signs in with email and password, Google or Apple.
- The developer has no Apple Developer Program yet.
- No analytics and no tracking (F-16).

## Alternatives Evaluated

### Sign-in provider

| Option | For | Against |
| --- | --- | --- |
| **Clerk** | Native Apple and Google buttons in `@clerk/expo`. Clerk sends the emails. The Hobby plan is free up to 50,000 monthly retained users | A third vendor. Settings live in a dashboard, not in code. User records are in the US. The Hobby plan has Clerk branding and up to 3 social connections |
| Amazon Cognito | All AWS, defined in SST. Free up to 10,000 monthly active users | Apple and Google open in a browser sheet. A fiddly setup. 50 emails a day without SES |
| SST Auth (OpenAuth) on Lambda | Free. Fully in our code | We own a sign-in server and its security. Browser redirects. Email needs SES |
| Firebase Auth | Native buttons, free | A second cloud. Less to learn about AWS |

### Data store

| Option | For | Against |
| --- | --- | --- |
| **DynamoDB, one table** | 25 GB free forever. No server and no connections. One partition per player fits the history | No SQL. A count needs a pre-counted row |
| Postgres (Neon or Supabase free tier) | Real SQL for stats and ranks | A third vendor. Supabase pauses an idle free project. Neon has a cold start |
| CloudKit | Free, native, no accounts to build | Apple devices only. No shared leaderboard. Nothing to learn about AWS |

### API and token check

| Option | For | Against |
| --- | --- | --- |
| **API Gateway HTTP API with its JWT authorizer** | No code checks the token. A bad token never reaches the Lambda. $1.00 per million requests | Checks only signature, issuer, audience, expiry and scopes. Needs an `aud` claim, so Clerk needs a JWT template |
| REST API with a Lambda authorizer (the November Five template) | Any check is possible. API keys, usage plans and caching | Code and a key file per stage. One more Lambda call per request. $3.50 per million requests |
| Lambda function URL, token checked in code | No API Gateway cost | No throttling in front of the Lambda. The code must check every token |

### The key of a player

| Option | For | Against |
| --- | --- | --- |
| The Clerk user ID | No lookup | A switch of provider rewrites every row |
| **Our own user ID, with an identity row per login** | A switch of provider adds identity rows. The data stays | One extra read per request |

### Deploys

| Option | For | Against |
| --- | --- | --- |
| **GitHub Actions with OIDC** | The CI that exists (ADR-010). No stored AWS keys. Free at this size | GitHub can reach the account, through a role that only this repository can take |
| CodePipeline and CodeBuild (the November Five template) | Deploys run inside the AWS account | A second CI system. More to set up |
| From the laptop only | Simplest | No automatic deploys. A forgotten deploy |

## Decision

1. **Clerk signs players in.**
   - v1 offers email and password, and Google.
   - Apple comes when the developer joins the Apple Developer Program.
   - Clerk has a development instance and a production instance.
   - The production instance uses `sudoku.felixvandemaele.be`. Its records live in the GoDaddy DNS.
   - A JWT template `sudoku-api` adds `"aud": "sudoku-api"`. The app calls
     `getToken({ template: "sudoku-api" })` before every request. The token lives 60 seconds.
   - Bot protection is on. A player verifies the email before the first sync.
   - The Hobby plan has no payment card, so Clerk cannot charge.
   - The app turns off the Clerk SDK telemetry.
2. **Every player has our own user ID**, a UUID.
   - An identity row maps a login to it: `pk = IDENTITY#clerk#<sub>`, `sk = IDENTITY`.
   - The first request of a new player writes the identity row with a condition, so a race
     cannot create two.
   - Every other row uses `USER#<userId>`. No email and no name is stored on our side.
3. **AWS in `eu-west-1`, built with SST.**
   - `sst.config.ts` at the repository root imports one file per area from `infra/`.
   - The Lambda code is in `services/sync-api/`.
   - The request and response schemas are zod schemas in `packages/sync-contract/`. The app and
     the Lambda both import it. It is a pnpm workspace package, as `@sudoku/core` is.
   - The sync contract does not go in `contracts/`. SUD-07 reserves `contracts/` for the files
     that `ml/` and the TypeScript side share. Only TypeScript uses the sync contract, so
     SUD-07 does not apply to it.
   - Pin an exact `sst` version.
   - `$transform` gives every function these defaults, sized for this backend:

     | Setting | Value | Reason |
     | --- | --- | --- |
     | Runtime | Node 24 | The newest Lambda runtime. The same major version as the repository (`engines`) |
     | Architecture | arm64 | About 20 % cheaper than x86 per GB-second. No native module needs x86 |
     | Memory | 512 MB | Lambda gives CPU in proportion to memory. 512 MB keeps the cold start of the AWS SDK short. A sync uses far less. The November Five default of 1024 MB is for heavier work |
     | Timeout | 10 s | A full sync is up to 100 conditional writes and one query, well under 1 s. 10 s ends a stuck call early. It also bounds the cost of a misuse (SUD-11). The November Five default is 30 s |
     | Log retention | 1 month | Enough to debug a problem. It keeps the logs inside the 5 GB free tier. The November Five default is 3 months |

     A function can set its own value when it needs one.
   - The `production` stage is `protected`, has `removal: "retain"`, and its table has
     `deletionProtection`. Every resource carries the tags `project` and `stage`.
4. **An API Gateway HTTP API with the JWT authorizer.**
   - The issuer of each stage is in a committed `infra/config.ts`. It must equal the `iss` of
     the token exactly.
   - Every route starts with `/v1`. Old app builds keep working after a change.
   - The Lambda takes the player only from the `sub` of the token, never from the path or the
     body.
5. **One Lambda, `sync-api`, with the plain AWS SDK.** It uses `DynamoDBDocumentClient` and zod.
   ElectroDB is not used while the table holds few kinds of row.
6. **One on-demand DynamoDB table.** The rows and the indexes are in ADR-028.
7. **Secrets are `sst.Secret` values.** SST keeps them encrypted in its state bucket in the
   account. A CI deploy reads them through its role.
8. **Three stages.**

   | Stage | Deployed by | Clerk instance | Used by |
   | --- | --- | --- | --- |
   | `felix` | `sst dev` on the laptop | Development | Local work |
   | `dev` | GitHub Actions, on each merge to `develop` | Development | The development app variant (ADR-022) |
   | `production` | GitHub Actions, from a manual run | Production | The production app variant |

   GitHub Actions takes an AWS role through OIDC. The pipeline runs the checks, then
   `sst diff`, then `sst deploy`. Every action is pinned to a commit SHA.
9. **The spending cap (SUD-11).** The AWS bill must stay below €10 a month.
   - The API stage allows 1 request per second, with a burst of 10.
   - The Lambda accepts at most 200 game writes per player per day and 100 games per request.
   - The Lambda has a reserved concurrency of 2, if the account quota allows it.
   - AWS Budgets sends an email at $3 forecast and at $6 actual.
   - At $9 actual, a `kill-switch` Lambda sets the stage throttle to 0 and the concurrency of
     `sync-api` to 0. It sends an email.
   - `just api-on <stage>` or a deploy turns the API on again.
   - Every later feature must fit under the cap.
10. **A player can delete the account in the app.** Apple requires it (guideline 5.1.1(v)).
    `DELETE /v1/account` deletes every row of the player, the identity row and the Clerk user.
    When Apple sign-in exists, it also revokes the Apple token.

## Consequences

- The game and the scanner do not change. A player who never signs in sees no difference.
- The expected AWS bill is below $0.10 a month. The fixed costs are a domain (about €10 a year)
  and, later, the Apple Developer Program ($99 a year).
- Clerk holds the email addresses. The app needs a privacy policy and App Store privacy labels
  before a release. ADR-013 lists the privacy items.
- A switch of sign-in provider needs a user import and new identity rows. The game data stays.
- The Clerk settings live in the Clerk dashboard. The setup steps go in the README of
  `services/sync-api/`.
- The Lambda tests run with Vitest against a local DynamoDB in a container. The test table must
  match `infra/storage.ts`.
- A budget alert can come hours late. The throttles bound the cost of those hours.

## Reassessment Triggers

- The bill goes above $1 in a month.
- The leaderboard needs a query that one table cannot answer.
- Clerk changes the Hobby plan, or the number of players nears 50,000.
- The developer joins the Apple Developer Program. Then add Apple sign-in.
- A check is needed that the JWT authorizer cannot do, such as a blocked player.
- AWS bills throttled requests. Then the kill switch deletes the stage instead.
