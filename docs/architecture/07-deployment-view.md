---
status: DRAFT
---

# 7. Deployment View

Placeholder. What is known:

| Node | Runs | Notes |
| --- | --- | --- |
| iPhone | The app, with the promoted model bundled | Development builds while building, TestFlight for daily use |
| Developer Mac | `ml/` training and export, app builds | Apple Silicon, MPS for training (TC-4) |
| GitHub | The repository, CI on Linux runners, and an iOS Simulator build on a macOS runner ([ADR-010](adr/adr-010-testing-and-ci.md)). Deploys of the backend with an AWS role through OIDC ([ADR-027](adr/adr-027-backend-platform.md)) | Private until it goes into the portfolio. Check ADR-013 before making it public |
| AWS `eu-west-1` | API Gateway HTTP API, the `sync-api` Lambda, one DynamoDB table, AWS Budgets and the kill switch. One SST stage each: `felix`, `dev` and `production` | `dev` deploys on each merge to `develop`. `production` deploys from a manual run. SUD-11 caps the bill |
| Clerk | A development instance and a production instance | Production on `sudoku.felixvandemaele.be`. The DNS of the domain is at Vercel |

## AWS account

The backend has one personal AWS account, in `eu-west-1`. No other project uses it. The setup is
in [`backend/infra/README.md`](../../backend/infra/README.md). The [operations runbook](../operations/runbook.md) lists every provider and its fixes.

| Topic | Rule |
| --- | --- |
| Access on the laptop | The profile `sudoku`. It reads the `aws login` session of `sudoku-login`. No IAM user has an access key |
| Access in CI | An AWS role through OIDC, only for this repository (ADR-027 decision 8) |
| Account guard | Three layers stop a deploy to any other account: the `just` recipes, `app()` and `run()` in `sst.config.ts` |
| Stages | `felix` and `dev` use `removal: "remove"`. `production` uses `removal: "retain"` and `protect` |
| Account-wide resources | Only `production` creates them: the budget, the alert topic and the GitHub OIDC provider |
| Tags | Every resource that SST deploys has `project: sudoku` and `stage: <stage>` |
| Cost | The budget `sudoku-monthly-cost` emails at $3 forecast and at $6 actual. At $9 it publishes to an SNS topic, and the kill switch stops every stage (SUD-11) |
| Kill switch | The Lambda `kill-switch` exists once, in `production`. It sets the SSM flag `/sudoku/kill-switch/<stage>`, the route throttle 0 and the concurrency 0. `just deploy-api` and `run()` refuse a flagged stage, but `sst remove` and `sst diff` pass. `just api-on <stage>` clears it (ADR-027) |

The SST state lives in the account, in the buckets `sst-state-*` and `sst-asset-*`. SST creates
them on the first deploy.

## The sync API per stage

Every stage has its own copy of these resources. `backend/infra/storage.ts` and `backend/infra/api.ts` create them.

| Resource | Settings |
| --- | --- |
| DynamoDB table `SyncTable` | On demand. `pk` and `sk`, the local index `bySynced` on `syncedAt`, the TTL attribute `expiresAt`. Point-in-time recovery and deletion protection only in `production` |
| Lambda `SyncApiFunction` | One function for every route. Node 24, arm64, 512 MB, 10 s. Linked to the table |
| HTTP API `SyncApi` | `POST /v1/sync` behind the Clerk JWT authorizer (audience `sudoku-api`). 1 request per second with a burst of 10 on each route. No CORS. The access log has no IP and no user agent |

A stage without a Clerk issuer in `backend/infra/config.ts` fails the deploy.

Open: local Xcode builds or EAS Build, and how TestFlight builds are cut. Decided when the app
first runs on the device.
