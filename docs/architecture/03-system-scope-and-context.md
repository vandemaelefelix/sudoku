---
status: DRAFT
---

# 3. System Scope and Context

## 3.1 Business Context

```mermaid
flowchart LR
    player["Player<br>[Person]<br>Plays daily, scans paper puzzles"]
    paper["Paper sudoku<br>[Physical]<br>Newspaper or puzzle book page"]
    app["Sudoku app<br>[iOS, React Native]<br>Game + scanner, fully offline"]
    ml["ML workstation<br>[Python, on the Mac]<br>Trains and exports models"]
    tf["TestFlight / App Store<br>[Apple]<br>Distribution"]
    be["Backend<br>[Future, maybe AWS]<br>Accounts, history, leaderboard"]

    player -->|plays, corrects scans| app
    paper -.->|seen through the camera| app
    ml -->|promoted model file,<br>committed to the repo| app
    app -->|corrected scans,<br>exported by hand| ml
    tf -->|installs| app
    app -.->|later| be

    style be stroke-dasharray: 5 5
```

| Neighbour | Exchanges with the system | Channel |
| --- | --- | --- |
| Player | Plays puzzles, scans paper puzzles, corrects recognised digits | Touch UI, camera |
| Paper sudoku | Is seen. The photo, flattened grid and cell images stay on the phone | Camera frames |
| ML workstation | Delivers model files to the app. Receives corrected scans as training data | The repository (promote step), the iOS share sheet |
| TestFlight / App Store | Distributes builds | Xcode / EAS build |
| Backend (future) | Not designed. The app must be able to add sync later without restructuring | — |

## 3.2 Technical Context

The repository holds two separate toolchains that never import each other. They share files only.

```mermaid
flowchart LR
    subgraph js["JS/TS world (pnpm)"]
        mobile["apps/mobile"]
        core["packages/sudoku-core"]
    end
    subgraph py["Python world (uv)"]
        ml["ml/"]
    end
    contracts[("contracts/<br>model contract")]
    fixtures[("fixtures/scans<br>photos + true grids")]
    models[("apps/mobile/assets/models<br>promoted model + manifest")]

    mobile --> core
    ml -->|promote| models
    mobile -->|loads| models
    ml -.->|implements| contracts
    mobile -.->|implements| contracts
    ml -->|scores cell images| fixtures
    mobile -->|fixture runner writes cells| fixtures
```

| Interface | Producer | Consumer | Format |
| --- | --- | --- | --- |
| Model contract | written by hand | `ml/` and the app's scanner module | Markdown spec, see [model-contract](00-concepts/model-contract.md) |
| Promoted model | `ml/` via `just promote-model` | the app's scanner module | `.tflite` + `manifest.json` |
| Fixture scans | taken by hand, labelled once, cell images written by the fixture runner | promote gate (cell images), fixture runner (photos) | photo + `truth.json` + 81 cell images, see [ADR-007](adr/adr-007-model-promotion.md) |
| Training-data export | the app's correction screen | `ml/` dataset | cell images + labels, see the model contract. Only on an explicit user action (SUD-02) |
