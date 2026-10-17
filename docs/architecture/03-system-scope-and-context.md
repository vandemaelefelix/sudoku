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
    clerk["Clerk<br>[SaaS]<br>Accounts and sign-in"]
    be["Backend<br>[AWS, SST]<br>Sync API, a copy of the history"]

    player -->|plays, corrects scans| app
    paper -.->|seen through the camera| app
    ml -->|promoted model file,<br>committed to the repo| app
    app -->|corrected scans,<br>exported by hand| ml
    tf -->|installs| app
    app -->|signs in| clerk
    app -->|finished games,<br>after sign-in| be
    be -.->|checks tokens| clerk
```

| Neighbour | Exchanges with the system | Channel |
| --- | --- | --- |
| Player | Plays puzzles, scans paper puzzles, corrects recognised digits | Touch UI, camera |
| Paper sudoku | Is seen. The photo, flattened grid and cell images stay on the phone | Camera frames |
| ML workstation | Delivers model files to the app. Receives corrected scans as training data | The repository (promote step), the iOS share sheet |
| TestFlight / App Store | Distributes builds | Xcode / EAS build |
| Clerk | Holds the accounts, sends the verification emails and signs the tokens ([ADR-027](adr/adr-027-backend-platform.md)) | `@clerk/expo`, HTTPS |
| Backend | Keeps a copy of every finished game of a signed-in player. Never camera frames, photos or cell images (SUD-02) | HTTPS, `POST /v1/sync` ([ADR-028](adr/adr-028-history-sync.md)) |

## 3.2 Technical Context

The repository holds two separate toolchains that never import each other. They share files only.

```mermaid
flowchart LR
    subgraph js["JS/TS world (pnpm)"]
        mobile["mobile"]
        core["shared/core"]
    end
    subgraph py["Python world (uv)"]
        ml["ml/"]
    end
    contracts[("shared/model-contract/<br>model contract")]
    fixtures[("shared/fixtures/scans<br>photos + true grids")]
    models[("mobile/assets/models<br>promoted model + manifest")]

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
| Promoted model | `ml/` via `just promote-model` | the app's scanner module | `.tflite` + `manifest.json` + `reference-outputs.json` |
| Fixture scans | taken by hand, labelled once, cell images written by the fixture runner | promote gate (cell images), fixture runner (photos) | photo + `truth.json` + 81 cell images, see [ADR-007](adr/adr-007-model-promotion.md) |
| Training-data export | the app's correction screen | `ml/` dataset | cell images + labels, see the model contract. Only through the setting "Help improve the app" (SUD-02) |
