# The backend infrastructure

The backend runs on AWS in one personal account. SST v4 describes it in TypeScript. The
decision and its reasons are in [ADR-027](../docs/architecture/adr/adr-027-backend-platform.md).

## What is here

| File | Holds |
| --- | --- |
| `../sst.config.ts` | The app: the stages, the removal policy, the tags and the AWS provider. It imports one file per area |
| `config.ts` | The account ID, the region, the stages and the Clerk issuer of each stage |
| `account.ts` | The account guard checks |
| `check-account.ts` | Layer 1 of the account guard. The `just` recipes and the deploy workflows run it before SST |
| `github-oidc-policy.ts`, `github-oidc.ts` | The GitHub OIDC provider, the two deploy roles and their trust policy. Only the account stage creates them |
| `defaults.ts` | The function defaults: Node 24, arm64, 512 MB, 10 s, 1 month of log retention |
| `budget-alerts.ts`, `budget.ts` | The monthly budget and its email alerts |
| `clerk.ts` | The Clerk secret key of each stage with a Clerk instance. `api.ts` links it to the Lambda for `DELETE /v1/account` |
| `storage.ts` | The DynamoDB table `SyncTable`. Its layout comes from `services/sync-api/src/tableDesign.ts` |
| `api.ts` | The HTTP API `SyncApi` with the routes `POST /v1/sync` and `DELETE /v1/account`, the Clerk JWT authorizer, the throttle and the Lambda `SyncApiFunction` (30 s timeout, linked to the table and `ClerkSecretKey`) |
| `kill-switch.ts` | The SNS topic of the budget, its policy, the `kill-switch` Lambda and the alert email. Only the account stage creates them |
| `kill-switch-settings.ts` | The flag name, the verdict of the deploy check and the arguments of `api-on`. It has no SST globals |
| `kill-switch-check.ts` | Refuses a deploy of a stopped stage. `just deploy-api` runs it. The workflows `deploy-api-dev.yml` and `deploy-api-production.yml` call it |
| `kill-switch-guard.ts` | The same check inside `run()`, for a plain `sst deploy` or `sst dev` |
| `api-on.ts` | Turns a stopped stage on again. `just api-on` runs it |
| `backend-settings.ts` | The throttle, the access log format, the audience and the issuer check of `api.ts`, and the point-in-time recovery of `storage.ts` |

`config.ts`, `account.ts`, `budget-alerts.ts`, `github-oidc-policy.ts` and `backend-settings.ts` have no SST globals. `just test-ts` runs their
tests with `node --test`.

## One-time setup

Do these steps once, in this order. No step costs money.

1. Give the root user MFA. Delete every root access key.
2. Create the IAM user `felix-admin` with `AdministratorAccess` and console access. Do not create
   an access key.
3. Give `felix-admin` MFA. Use `felix-admin` in the browser from now on.
4. As root, turn on **IAM user and role access to Billing information**.
5. As `felix-admin`, open **Cost Explorer** and **Budgets** once. Do not create a budget by hand.
6. Write down the account plan. Accounts made after 15 July 2025 start on the Free plan. It ends
   after 6 months, or when the credits run out. Decide about the upgrade before the production
   release.
7. Check that the AWS CLI is 2.32 or newer: `aws --version`.
8. Back up `~/.aws/config`. Make the profile `sudoku-login`: `just aws-login`. Type the region
   `eu-west-1`. Sign in as `felix-admin`.
9. Make the profile `sudoku`. Replace the path with the output of `which aws`:

   ```sh
   aws configure set credential_process "/usr/local/bin/aws configure export-credentials --profile sudoku-login --format process" --profile sudoku
   aws configure set region eu-west-1 --profile sudoku
   ```

10. Check the profile: `aws sts get-caller-identity --profile sudoku`. The `Arn` must end with
    `user/felix-admin`. The `Account` must equal `AWS_ACCOUNT_ID` in `config.ts`.

SST and Pulumi use the AWS SDK for Go v2, which cannot read an `aws login` profile. That is why
there are two profiles:

- `sudoku-login`: `aws login` fills it. Only `just aws-login` and `aws logout` use it.
- `sudoku`: every other command uses it. It gets the credentials of `sudoku-login` through
  `credential_process`.

## Daily use

| You want to | Command |
| --- | --- |
| Start a session (once every 12 hours) | `just aws-login` |
| See what a deploy would change | `just diff-api felix` |
| Deploy a stage | `just deploy-api felix` |
| Turn a stopped stage on again | `just api-on felix` |
| Remove a stage | `just remove-api felix` |
| Typecheck `sst.config.ts` and `infra/` | `just typecheck-infra` |
| End the session | `aws logout --profile sudoku-login` |

Use `just aws-login`, not a bare `aws login`. With `AWS_PROFILE=sudoku` in the shell, a bare
`aws login` writes into the profile `sudoku` and breaks its `credential_process`.

The recipes set `AWS_PROFILE=sudoku` themselves. They need no shell setup.

For direnv users, the committed `.envrc` sets `AWS_PROFILE=sudoku` inside the repository. It is
only a convenience for a direct `aws` or `sst` command. The app, the tests and the recipes do not
depend on it.

## Stages

| Stage | Deployed by | Removal | Account-wide resources |
| --- | --- | --- | --- |
| `felix` | The laptop | `remove` | No |
| `dev` | GitHub Actions, on each merge to `develop` | `remove` | No |
| `production` | GitHub Actions, from a manual run | `retain`, and `protect` | Yes |

The first `production` deploy runs once from the laptop, before the CI deploys exist.
`CLERK_ISSUER.production` is set, so it deploys the whole app. Without an issuer, it would create only the account-wide resources: the budget, the
kill switch, the OIDC provider and the deploy roles. It skips the table, the function and the API, and
prints a note. A stage with an issuer deploys everything. `deployPlan()` in `config.ts` decides
this. Every later `production` deploy comes from GitHub Actions (ADR-027).
The deploy roles come from this first deploy too, so no second laptop deploy is needed.

`sst.config.ts` refuses any other stage name. A typo cannot create a fourth copy.

An account-wide resource exists once per account: the budget, the alert topic and the
GitHub OIDC provider. Only `production` creates them. One budget per stage would send three emails
per alert.

Every resource that SST deploys gets the tags `project: sudoku` and `stage: <stage>`.

## Deploys from GitHub Actions

GitHub stores no AWS key. A workflow takes a role through OIDC (ADR-027, ADR-010).

| Workflow | Starts | Stage | Role variable |
| --- | --- | --- | --- |
| `deploy-api-dev.yml` | A push to `develop` that changes a backend file | `dev` | `AWS_ROLE_ARN_DEV` |
| `deploy-api-production.yml` | A manual run, from `develop` | `production` | `AWS_ROLE_ARN_PRODUCTION` |

Each deploy runs these steps in this order:

1. The TypeScript checks (`.github/actions/ts-checks`).
2. The role, the account check and the kill-switch check (`.github/actions/aws-guard`).
3. `sst diff`. The output is in the summary of the run.
4. `sst deploy`.

Read a failed run from the top:

- "Could not assume role": the variable is missing or wrong, or the workflow file or the branch
  does not match the trust policy in `github-oidc-policy.ts`.
- "The AWS credentials belong to account ...": the role is in another account. Fix the variable.
- "stopped by the kill switch": run `just api-on <stage>` on the laptop.
- "Unexpected error occurred": the workflow passes `--print-logs`. Read the lines above it.

The trust policy of each role needs these claims (`github-oidc-policy.ts`):

| Claim | Value |
| --- | --- |
| `aud` | `sts.amazonaws.com` |
| `sub` | `repo:vandemaelefelix@32290789/sudoku@1412094169:ref:refs/heads/develop` |
| `repository_id` | `1412094169` |
| `job_workflow_ref` | `vandemaelefelix/sudoku/.github/workflows/<file>@refs/heads/develop` |

The repository uses immutable subject claims, so the `sub` holds the owner ID and the repository ID. The IDs
are in `config.ts`. Read the setting with `gh api repos/vandemaelefelix/sudoku/actions/oidc/customization/sub`.

GitHub documents `job_workflow_ref` for reusable workflows. It is believed to be present in a plain workflow too, but this is
not verified. Check it on the first run of `deploy-api-dev.yml`. If "Could not assume role" appears and the IDs are right,
the claim may be missing. Then take this fallback. It is a human-only repository setting. Do not let an agent run it.

1. Call `PUT /repos/vandemaelefelix/sudoku/actions/oidc/customization/sub` with `include_claim_keys` that includes `job_workflow_ref`.
2. Match on `sub` in the trust policy, and drop the `job_workflow_ref` condition.

The repository is private on the Free plan, so the production workflow has no environment and no
required reviewer. Starting the run is the approval. See ADR-010, amendment "CI also deploys the
backend".

An SST deploy that stops half way can leave a lock in the state. Remove it on the laptop with
`AWS_PROFILE=sudoku pnpm exec sst unlock --stage <stage>`.

## The account guard

The guard stops a deploy to any account other than the personal one. It has three layers.

| Layer | Where | Stops |
| --- | --- | --- |
| 1 | The `just` recipes: `env -u ...` and `check-account.ts` | `AWS_*` variables in the shell. A profile `sudoku` that points at the wrong account. It runs before SST writes its state bucket |
| 2 | `app()` in `sst.config.ts` | A direct `sst` command with a different `AWS_PROFILE` or with access keys in the shell. It runs before the SST bootstrap |
| 3 | `run()` in `sst.config.ts`: `assertPersonalAccount()` | Every other path, also CI. It runs before any resource |

In CI, `check-account.ts` is layer 1. It reads the account of the role credentials. The action
`aws-guard` runs it.

SST shows a layer 2 failure only as "Unexpected error occurred". Add `--print-logs` to see the
message.

## The budget

`budget.ts` creates the budget `sudoku-monthly-cost` on the `production` stage. It covers the
whole account.

| Setting | Value |
| --- | --- |
| Limit | $10 a month (SUD-11) |
| Alert | Forecast above $3 |
| Alert | Actual above $6 |

AWS needs some weeks of cost history before it sends a forecast alert. The actual alert works
from the first day.

The email address is the SST secret `BudgetEmail`. It stays out of git. Set it once, before the
first `production` deploy:

```sh
AWS_PROFILE=sudoku pnpm exec sst secret set BudgetEmail <your address> --stage production
```

See the budget in the console: **Billing and Cost Management**, then **Budgets**, then
`sudoku-monthly-cost`.

## Clerk

Clerk signs the players in (ADR-027, decision 1). Each stage trusts the tokens of one Clerk
instance.

| Stage | Clerk instance | Issuer |
| --- | --- | --- |
| `felix` | Development | `https://free-leopard-5298.clerk.accounts.dev` |
| `dev` | Development | `https://free-leopard-5298.clerk.accounts.dev` |
| `production` | Production, on the domain `sudoku.felixvandemaele.be` | `https://clerk.sudoku.felixvandemaele.be` |

The issuer of each stage is `CLERK_ISSUER` in `config.ts`. The JWT authorizer needs an exact
match with the `iss` of the token. The publishable key of the development instance is in
`apps/mobile/app.config.ts`, in the development variant. The production variant gets the key of the
production instance, the two Google client IDs and the reversed iOS URL scheme from
`PRODUCTION_BACKEND` in the same file. All of them are public values. The production sync URL is
the URL that `just deploy-api production` printed. The production app syncs and deletes the account in the app.

### Cost

The Clerk Hobby plan is free and needs no payment card. It allows a production instance with a
custom domain, up to 50,000 monthly retained users. The session lifetime on Hobby is fixed at
7 days. The Pro plan ($25 a month) allows a custom session lifetime. Decide the plan before the
production release.

### The dashboard steps

Do these steps once per instance, in the [Clerk dashboard](https://dashboard.clerk.com). The
dashboard renames menu items from time to time. If a name differs, use the link.

1. Create the application `Sudoku`. Turn on **Email** and **Google**. Turn off every other
   sign-in option. Do not add a payment card.
2. In [User & authentication](https://dashboard.clerk.com/~/user-authentication/user-and-authentication):
   - Turn on sign-up with email, **Require email address** and **Verify at sign-up** with an
     **Email verification code**. Do not use the email link. The app has no web page for it.
   - Turn on sign-up with password. Keep the default password rules.
   - Turn off every **Phone** and **Username** toggle.
   - Leave **Allow users to delete their accounts** off. The app deletes an account through
     `DELETE /v1/account` (ADR-027, decision 10).
3. In [Native applications](https://dashboard.clerk.com/~/native-applications), turn on
   **Native API**. Add the iOS app: the Team ID `575384CG4F` and the bundle ID of the variant.
   The development instance uses `com.vandemaelefelix.sudoku.dev`.
4. In [Protections](https://dashboard.clerk.com/~/protect/rules), check that **Challenge
   suspicious sign-ups** (bot protection) is on.
5. In [SSO connections](https://dashboard.clerk.com/~/user-authentication/sso-connections), turn
   on **Google** with **Use custom credentials**. The native Google sign-in needs our own Google
   OAuth clients, also in development: a web client for Clerk and an iOS client for the app.
   Follow the [Clerk Expo Google guide](https://clerk.com/docs/expo/guides/configure/auth-strategies/sign-in-with-google).
   Keep the Google app in **Testing** until the release.
6. Leave **Apple** off. It needs the Apple Developer Program (ADR-027).
7. In [JWT templates](https://dashboard.clerk.com/~/jwt-templates), make the blank template
   `sudoku-api`. Set the token lifetime to 60 seconds. Set the claims to exactly
   `{ "aud": "sudoku-api" }`. Do not add the email. `CLERK_AUDIENCE` in `config.ts` holds the
   same value.
8. In [API keys](https://dashboard.clerk.com/~/api-keys), copy the publishable key and the
   **Frontend API URL**. The Frontend API URL is the issuer.

Bot protection does not cover the app. While the Native API is on, Clerk does not challenge a
sign-up from a native app. For the app, the email code, the stage throttle and the daily count
are the limits (ADR-027, decision 9).

### Check the issuer and the publishable key

A wrong issuer gives a 401 on every sync call. Run both checks before you commit a new value.

1. The issuer must print itself, with no `/` at the end:

   ```sh
   curl -s https://free-leopard-5298.clerk.accounts.dev/.well-known/openid-configuration | jq -r .issuer
   ```

2. The publishable key must decode to the host of the issuer, with a `$` at the end. Remove
   `pk_test_` (or `pk_live_`) first:

   ```sh
   printf %s 'ZnJlZS1sZW9wYXJkLTUyOTguY2xlcmsuYWNjb3VudHMuZGV2JA' | base64 -d
   ```

### The secret key

Do not paste the Clerk secret key in a chat, in `.env` or in a file in the repository. It starts
with `sk_test_` or `sk_live_`.

`clerk.ts` declares the SST secret `ClerkSecretKey` on each stage that has an issuer in
`config.ts`. A declared secret without a value stops the deploy. So set the key before the first
deploy of the stage:

1. Run `just aws-login` if the session is older than 12 hours.
2. In the [API keys](https://dashboard.clerk.com/~/api-keys) page, copy the secret key.
3. Run this command. It reads the key from the clipboard, so the key stays out of the shell
   history:

   ```sh
   pbpaste | env -u AWS_ACCESS_KEY_ID -u AWS_SECRET_ACCESS_KEY -u AWS_SESSION_TOKEN AWS_PROFILE=sudoku pnpm exec sst secret set ClerkSecretKey --stage felix
   ```

4. Run the same command with `--stage dev`. The `dev` stage uses the same instance.
5. Clear the clipboard: `pbcopy < /dev/null`.

Do not run `sst secret list` in a session with an agent. It prints the values in plain text.
## The sync API

`storage.ts` and `api.ts` deploy the sync API on every stage. The Lambda code is in
[`services/sync-api/`](../services/sync-api/README.md).

- A stage needs its Clerk issuer in `CLERK_ISSUER` of `config.ts`. Without it, the deploy fails
  before it creates the API.
- The deploy prints the output `apiUrl`. SST also writes it to `.sst/outputs.json`.
- The throttle is 1 request per second with a burst of 10, on each route. Check it after a
  deploy. Find the API ID in the `apiUrl`:

  ```sh
  AWS_PROFILE=sudoku aws apigatewayv2 get-stage --api-id <api id> --stage-name '$default'
  ```

  `DefaultRouteSettings` must show `ThrottlingRateLimit: 1` and `ThrottlingBurstLimit: 10`.

- The access log keeps the request, the route, the status and the latency. It leaves out the IP
  and the user agent (ADR-027, amendment "the sync API").

## The kill switch

At $9 actual, the kill switch stops every stage in the account (ADR-027, SUD-11, amendment "the
kill switch"). Only `production` creates it, so it exists after the first `production` deploy.

```text
Budget at $9 --> SNS KillSwitchTopic --> Lambda kill-switch --> for each stage:
                      |                    1. SSM flag /sudoku/kill-switch/<stage>
                      '--> email           2. route throttle 0 on the API
                                           3. reserved concurrency 0 on sync-api
                                           4. summary email (KillSwitchAlertTopic)
```

- `just deploy-api` runs `infra/kill-switch-check.ts`. It refuses while the flag exists. It also
  refuses when it cannot read the flag. `run()` in `sst.config.ts` does the same check. The check
  skips `sst remove` and `sst diff`, so `just remove-api` works for a stopped stage.
- The workflows `deploy-api-dev.yml` and `deploy-api-production.yml` call `node infra/kill-switch-check.ts <stage>` before `sst deploy`. Its
  role needs `ssm:GetParameter` and `ssm:GetParametersByPath` on
  `arn:aws:ssm:eu-west-1:<account>:parameter/sudoku/kill-switch/*`.
- The Lambda also holds the `logs:` log delivery actions on `*`. The stage has access logging, and API
  Gateway checks these actions on every `UpdateStage`. Without them the throttle call fails with
  `Insufficient permissions to enable logging`. `api-on` runs as the admin user and needs no change.
- `just api-on <stage>` shows the cost of the month, asks for `y` (skip with `--yes`), restores
  the throttle, deletes the reserved concurrency and clears the flag last. AWS Budgets alerts
  when the cost crosses a threshold. After `api-on`, the $9 alert does not fire again while the
  month stays above $9. Watch the bill by hand for the rest of the month.
- The account allows 10 concurrent executions. `sync-api` has no reserved concurrency of 2,
  because AWS needs 100 unreserved. Reserve 2 when the account limit is 102 or more.
- After the first `production` deploy, confirm the email subscription. AWS sends the mail
  "AWS Notification - Subscription Confirmation" to the address of `BudgetEmail`. Click
  "Confirm subscription".

### Test the kill switch on `felix` (developer only)

Do these steps once, after the first `production` deploy. They change the real account.

1. Run `just aws-login`. Run `just deploy-api production`. This creates the budget, the topic and
   the Lambda.
2. Confirm the email subscription (see above). Check that no subscription is pending:

   ```sh
   AWS_PROFILE=sudoku aws sns list-subscriptions-by-topic --region eu-west-1 --topic-arn <KillSwitchAlertTopic arn>
   ```

3. Run `just deploy-api felix`. Check the quota: `AWS_PROFILE=sudoku aws lambda get-account-settings --region eu-west-1`.
   Expect `ConcurrentExecutions: 10`.
4. Check that the API answers: `curl -i -X POST "<apiUrl>/v1/sync"` returns 401.
5. Start the kill switch by hand, as the budget would:

   ```sh
   AWS_PROFILE=sudoku aws lambda invoke --region eu-west-1 --function-name <kill-switch function name> --payload '{}' /dev/null
   ```

   Find the name with `aws lambda list-functions --query "Functions[?contains(FunctionName,'KillSwitch')].FunctionName"`.
   Or publish to the topic: `aws sns publish --topic-arn <KillSwitchTopic arn> --message '{"test":true}'`.
6. Read the summary email. `felix` must show "stopped". `dev` and `production` show the flag only.
7. Check the stop:
   - `aws apigatewayv2 get-stage --api-id <apiId> --stage-name '$default'` shows
     `ThrottlingRateLimit` 0 and `ThrottlingBurstLimit` 0. A `curl` without a token still returns
     401, because the JWT authorizer answers before the throttle. Only a request with a valid
     Clerk token shows 429.
   - `aws ssm get-parameter --name /sudoku/kill-switch/felix` shows the flag.
   - `aws lambda get-function-concurrency --function-name <SyncApiFunction name>` shows 0.
   - `just deploy-api felix` refuses and prints the kill-switch message.
8. Run `just api-on felix`. Check that `get-stage` shows the throttle 1 and 10 again, that the function concurrency is gone and that the flag is gone.
9. In the app (development variant, signed in on `felix`), finish a game while the stage is
   stopped. No error shows, and the waiting list keeps the entry.
10. Billing check, to answer whether AWS bills a throttled request: stop `felix` again (step 5).
    Send 3000 requests with a valid Clerk token, because a request without a token gets 401 before
    the throttle (`for i in $(seq 3000); do curl -s -o /dev/null -X POST -H "Authorization: Bearer $TOKEN" "<apiUrl>/v1/sync"; done`).
    After 1 to 2 days, read the usage of `Amazon API Gateway` in Cost Explorer, grouped by usage
    type. Compare the HTTP API request quantity with the number of requests that reached the API
    before. Run `just api-on felix`. Write the result in ADR-027.

## Rules

- Do not create access keys for the root user or for `felix-admin`.
- Do not paste a password, an MFA code, a key or a file from `~/.aws/login/cache/` in a chat.
- Do not run `aws configure`, `aws login` or `aws sso` without `--profile`. Without it, the
  command writes to the `default` profile, which belongs to another account.
- Do not put AWS keys in `.env` or in the repository.

## The production release

The release needs these steps, in this order. Only the developer can do them.

1. Set the secret `BudgetEmail`. Run `just deploy-api production`. This creates the budget, the
   kill switch and the roles. It needs no Clerk instance.
2. Make the Clerk production instance on `sudoku.felixvandemaele.be`. The DNS of the domain is at
   Vercel. Add the five CNAME records there. Check the issuer with `curl`. Hobby is the recommended plan (ADR-027).
3. Make the production Google OAuth clients. Publish the consent screen.
4. Set the secret `ClerkSecretKey` for `production`. The issuer is in `config.ts`. The publishable
   key and the Google client IDs are in `app.config.ts`.
5. Run `just deploy-api production` again. It creates the table, the function and the API.
   The `apiUrl` that this command prints is in `PRODUCTION_BACKEND.syncApiUrl` in `app.config.ts`.
6. Host the home page and the privacy policy. Vercel serves the folder [`site/`](../site/README.md) at
   `https://sudoku.felixvandemaele.be`. The build renders
   [`docs/privacy/privacy-policy.md`](../docs/privacy/privacy-policy.md) as `/privacy`. Follow the steps in
   `site/README.md`. Enter both URLs in the Google Branding page. Step 3 needs them. Check the policy again before the
   App Store submission.
7. Run the smoke test: sign up, finish a game, see it in DynamoDB, delete the account.

Production sync and in-app account deletion work. Step 5 set the production sync URL.
Other blockers stay open: the Apple Developer Program, guideline 4.8 and the App Store privacy labels.
