# The backend infrastructure

The backend runs on AWS in one personal account. SST v4 describes it in TypeScript. The
decision and its reasons are in [ADR-027](../docs/architecture/adr/adr-027-backend-platform.md).

## What is here

| File | Holds |
| --- | --- |
| `../sst.config.ts` | The app: the stages, the removal policy, the tags and the AWS provider. It imports one file per area |
| `config.ts` | The account ID, the region, the stages and the Clerk issuer of each stage |
| `account.ts` | The account guard checks |
| `check-account.ts` | Layer 1 of the account guard. The `just` recipes run it before SST |
| `defaults.ts` | The function defaults: Node 24, arm64, 512 MB, 10 s, 1 month of log retention |
| `budget-alerts.ts`, `budget.ts` | The monthly budget and its email alerts |

`config.ts`, `account.ts` and `budget-alerts.ts` have no SST globals. `just test-ts` runs their
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

The first `production` deploy runs once from the laptop, before the CI deploys exist. It holds
only the budget. Every later `production` deploy comes from GitHub Actions (ADR-027).

`sst.config.ts` refuses any other stage name. A typo cannot create a fourth copy.

An account-wide resource exists once per account: the budget, and later the alert topic and the
GitHub OIDC provider. Only `production` creates them. One budget per stage would send three emails
per alert.

Every resource gets the tags `project: sudoku` and `stage: <stage>`.

## The account guard

The guard stops a deploy to any account other than the personal one. It has three layers.

| Layer | Where | Stops |
| --- | --- | --- |
| 1 | The `just` recipes: `env -u ...` and `check-account.ts` | `AWS_*` variables in the shell. A profile `sudoku` that points at the wrong account. It runs before SST writes its state bucket |
| 2 | `app()` in `sst.config.ts` | A direct `sst` command with a different `AWS_PROFILE` or with access keys in the shell. It runs before the SST bootstrap |
| 3 | `run()` in `sst.config.ts`: `assertPersonalAccount()` | Every other path, also CI. It runs before any resource |

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

## The kill switch

At $9 actual, the kill switch stops every stage in the account (ADR-027, SUD-11). It sets a flag
per stage. `just deploy-api` and the deploy workflow then refuse that stage. Only
`just api-on <stage>` clears the flag.

The kill switch, the $9 alert and the flag check in `just deploy-api` arrive with #108. Until
then, `just deploy-api` checks only the account.

## Rules

- Do not create access keys for the root user or for `felix-admin`.
- Do not paste a password, an MFA code, a key or a file from `~/.aws/login/cache/` in a chat.
- Do not run `aws configure`, `aws login` or `aws sso` without `--profile`. Without it, the
  command writes to the `default` profile, which belongs to another account.
- Do not put AWS keys in `.env` or in the repository.
