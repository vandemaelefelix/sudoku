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
   - The phone never holds this user ID. On the phone, the owner of a history entry is the Clerk
     user ID (ADR-028).
   - When the identity row is a tombstone (decision 10), a sync with that `sub` gets 410
     `account_deleted`. The Lambda creates no new user ID for it.
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
   - The API stage allows 1 request per second, with a burst of 10. A 429 comes only from this
     throttle or from the kill switch.
   - The Lambda accepts at most 100 history entries per request.
   - The Lambda stores at most 200 history entries per player per day. Only a stored history
     entry counts. A no-op write and a refused write do not count.
   - At the cap, the Lambda stores the history entries that fit, in request order. It returns
     those as accepted and still runs the pull. The other history entries stay on the waiting
     list of the phone. The daily count never gives a 429.
   - The Lambda has a reserved concurrency of 2, if the account quota allows it.
   - AWS Budgets sends an email at $3 forecast and at $6 actual.
   - At $9 actual, a `kill-switch` Lambda stops every stage in the account, because the budget
     is for the whole account. For each stage, it sets the stage throttle to 0 and the
     concurrency of `sync-api` to 0. It sends an email.
   - The kill switch sets a flag per stage. The deploy workflow and `just deploy-api` refuse to
     deploy a stage while its flag is on. A deploy would set the throttles again.
   - Only `just api-on <stage>` turns a stage on again. The developer runs it by hand. It clears
     the flag of that stage.
   - Every later feature must fit under the cap.
10. **A player can delete the account in the app.** Apple requires it (guideline 5.1.1(v)).
    `DELETE /v1/account` does these steps in this order:
    1. It deletes the Clerk user. A Clerk user that does not exist counts as deleted.
    2. It replaces the identity row with a tombstone: `deletedAt` and a TTL of 30 days.
    3. It deletes every other row of the player.

    The tombstone outlives every token of that `sub`. A sync with a token of the deleted user
    gets 410 `account_deleted` and never creates a new user ID. A second delete call finds the
    tombstone. It repeats steps 1 and 3 and succeeds, so a lost response is harmless. When Apple
    sign-in exists, the call also revokes the Apple token.

## Consequences

- The game and the scanner do not change. A player who never signs in sees no difference.
- The expected AWS bill is below $0.10 a month. The fixed costs are a domain (about €10 a year)
  and, later, the Apple Developer Program ($99 a year).
- Clerk holds the email addresses. The app needs a privacy policy and App Store privacy labels
  before a release. ADR-013 lists the privacy items.
- A switch of sign-in provider needs a user import and new identity rows. The game data stays.
  The Clerk user ID changes, so the app adopts the local history entries of the old owner once
  (ADR-028).
- Before any TestFlight or App Store submission, the developer checks App Store guideline 4.8
  (Login Services). If it applies, the app adds Sign in with Apple. v1 keeps email and Google.
- The Clerk settings live in the Clerk dashboard. The setup steps are in
  [`infra/README.md`](../../../infra/README.md).
- The Lambda tests run with Vitest against a local DynamoDB in a container. The test table must
  match `infra/storage.ts`.
- A budget alert can come hours late. The throttles bound the cost of those hours.
- The app needs iOS 17.0 or later. The config plugin of `@clerk/expo` raises the iOS
  deployment target from 16.4 to 17.0. The app has no players on iOS 16.
- The app turns off the Sign in with Apple entitlement of the Clerk plugin
  (`appleSignIn: false`). v1 has no Apple sign-in, and a free Apple team cannot sign the
  entitlement.
- The Google client IDs of the development instance are in `app.config.ts` next to the
  publishable key. They are public values. The production variant has no key until the
  production instance exists, so it shows no account section.
- Native Google sign-in uses the free Apple team (Team ID and the `.dev` bundle ID in Clerk). The
  iPhone test checks it. If it fails, the app ships email only and Google waits for the Apple
  Developer Program.

## Reassessment Triggers

- The bill goes above $1 in a month.
- The leaderboard needs a query that one table cannot answer.
- Clerk changes the Hobby plan, or the number of players nears 50,000.
- The developer joins the Apple Developer Program. Then add Apple sign-in.
- A TestFlight or App Store submission comes near. Then check guideline 4.8.
- A check is needed that the JWT authorizer cannot do, such as a blocked player.
- AWS bills throttled requests. Then the kill switch deletes the stage instead.

## Amendment 2026-10-15: the AWS account and the SST setup

The SST setup makes decisions 3, 7, 8 and 9 concrete. The details are in
[`infra/README.md`](../../../infra/README.md).

1. **Two AWS profiles.** `aws login --profile sudoku-login` signs the developer in. Every other
   command uses the profile `sudoku`. It reads the credentials of `sudoku-login` through
   `credential_process`. SST and Pulumi use the AWS SDK for Go v2, which cannot read an
   `aws login` profile. `credential_process` works in every SDK. When SST can read an
   `aws login` profile, merge the two profiles.
2. **No access keys.** No IAM user has an access key. CI takes a role through OIDC (decision 8).
3. **An account guard with three layers.** It stops a deploy to any account other than the
   personal one:
   - The `just` recipes remove the `AWS_*` keys from the shell. They compare the account of the
     profile `sudoku` with `AWS_ACCOUNT_ID` before SST writes its state bucket.
   - `app()` in `sst.config.ts` refuses access keys and every other `AWS_PROFILE` on the laptop.
   - `run()` compares the account of the deploy with `AWS_ACCOUNT_ID` before any resource. This
     layer also works in CI.
4. **The account ID is a committed constant** in `infra/config.ts`. An account ID is not a secret.
   An environment variable can be missing, and then the guard is gone.
5. **Only `production` creates the account-wide resources.** These are the budget, the alert topic
   of the kill switch and the GitHub OIDC provider. AWS allows one OIDC provider per issuer. One
   budget per stage sends three emails per alert. `production` is protected and retained.
6. **The first `production` deploy runs from the laptop**, before the CI deploys exist. It holds
   only the budget, so the budget exists from day one (SUD-11). Every later `production` deploy
   comes from GitHub Actions, as decision 8 says.
7. **The budget.** One `COST` budget `sudoku-monthly-cost` for the whole account: $10 a month,
   in USD. It emails at $3 forecast and at $6 actual. The kill switch adds the alert at $9. The
   budget counts the spend without credits and refunds (`includeCredit` and `includeRefund` are
   false). A credit then cannot hide a cost spike from the alerts or the kill switch. The
   address is the `sst.Secret` `BudgetEmail` on `production`, so it stays out of git.
8. **Only three stage names.** `sst.config.ts` refuses any stage other than `felix`, `dev` and
   `production`. A typo cannot create a fourth copy. `felix` and `dev` use `removal: "remove"`.
9. **Every resource that SST deploys gets the tags** `project: sudoku` and `stage: <stage>`, through the default
   tags of the AWS provider.
10. **`felix` deploys with `just deploy-api felix`**, not only with `sst dev`.

The kill switch and its flag per stage (decision 9) are not part of this setup. Until they exist,
`just deploy-api` does not check a flag.

## Amendment 2026-10-15: the Clerk development instance

The Clerk development instance makes decision 1 concrete. The steps are in the section Clerk of
[`infra/README.md`](../../../infra/README.md).

1. **`felix` and `dev` share the development instance.** Its issuer is `CLERK_ISSUER` in
   `infra/config.ts`. `production` has no issuer until the production instance exists.
2. **Native Google sign-in needs our own Google OAuth clients, also in development.** Clerk's
   shared Google credentials cover only the browser flow. The development instance uses a web
   client for Clerk and an iOS client for the development variant.
3. **Bot protection does not cover the app.** The Clerk SDK needs the Native API. While it is
   on, Clerk does not challenge a sign-up from a native app. The email code, the stage throttle
   and the daily count (decision 9) are the limits for the app. This gap is accepted for v1.
   Reassess it if fake accounts appear.
4. **The publishable key lives in the app config of each variant**, not in `.env`. The
   development variant gets the key of the development instance in `apps/mobile/app.config.ts`.
   The production variant gets no key until the production instance exists. A file that git
   ignores would need a manual copy in every worktree. One `.env` would also give both variants
   the same key.
5. **The Clerk setup steps are in `infra/README.md`**, not in the README of `services/sync-api/`.
   `infra/README.md` is the README of the backend. Consequences says this now.
6. **`ClerkSecretKey` exists only on a stage with a Clerk instance.** `infra/clerk.ts` declares
   the SST secret when the stage has an issuer. A declared secret without a value stops the
   deploy, so `production` keeps deploying until it has its own instance.
7. **The JWT template is made in the dashboard**, not through the Clerk API. The API call needs
   the secret key, and an agent must never see it. `CLERK_AUDIENCE` in `infra/config.ts` holds
   the `aud` of the template.
8. **The Hobby plan stays enough for production.** It is free and allows a production instance
   with a custom domain, up to 50,000 monthly retained users. Its session lifetime is fixed at
   7 days. The Pro plan allows a custom session lifetime. The production release decides the
   plan.
