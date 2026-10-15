---
status: DRAFT
---

# 7. Deployment View

Placeholder. What is known:

| Node | Runs | Notes |
| --- | --- | --- |
| iPhone | The app, with the promoted model bundled | Development builds while building, TestFlight for daily use |
| Developer Mac | `ml/` training and export, app builds | Apple Silicon, MPS for training (TC-4) |
| GitHub | The repository, CI on Linux runners ([ADR-010](adr/adr-010-testing-and-ci.md)). Deploys of the backend with an AWS role through OIDC ([ADR-027](adr/adr-027-backend-platform.md)) | Private until it goes into the portfolio. Check ADR-013 before making it public |
| AWS `eu-west-1` | API Gateway HTTP API, the `sync-api` Lambda, one DynamoDB table, AWS Budgets and the kill switch. One SST stage each: `felix`, `dev` and `production` | `dev` deploys on each merge to `develop`. `production` deploys from a manual run. SUD-11 caps the bill |
| Clerk | A development instance and a production instance | Production on `sudoku.felixvandemaele.be`, DNS records at GoDaddy |

Open: local Xcode builds or EAS Build, and how TestFlight builds are cut. Decided when the app
first runs on the device.
