---
status: DRAFT
---

# 7. Deployment View

Placeholder. What is known:

| Node | Runs | Notes |
| --- | --- | --- |
| iPhone | The app, with the promoted model bundled | Development builds while building, TestFlight for daily use |
| Developer Mac | `ml/` training and export, app builds | Apple Silicon, MPS for training (TC-4) |
| GitHub | The repository, CI on Linux runners ([ADR-010](adr/adr-010-testing-and-ci.md)) | Private until it goes into the portfolio. Check ADR-013 before making it public |
| Backend | — | Part 3, not designed |

Open: local Xcode builds or EAS Build, and how TestFlight builds are cut. Decided when the app
first runs on the device.
