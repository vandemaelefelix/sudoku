---
status: DRAFT
---

# 5. Building Block View

## 5.1 Repository layout

```
sudoku/
├── apps/
│   └── mobile/                  # Expo / React Native app: game UI, scan UI, local storage
│       ├── src/scan/            # scan UI: screens/, components/, hooks/, utils/, constants/, effects/
│       ├── src/scanner/         # scanner module, entered only through src/scanner/index.ts
│       ├── src/utils/           # code that more than one feature uses: geometry, homography, logs
│       └── assets/models/       # promoted model files + manifest.json (committed)
├── packages/
│   └── sudoku-core/             # @sudoku/core: board, rules, generator, solver, hints. Pure TS
├── ml/                          # Python (uv): datasets, training, evaluation, export, promote
│   ├── src/
│   ├── data/                    # images, NOT in git (ADR-009)
│   └── artifacts/               # one folder per training run, gitignored
├── contracts/                   # model contract and data formats shared by ml/ and the app
├── fixtures/
│   ├── scans/                   # public-safe photos + true grids + the app's cell images (ADR-007, ADR-013)
│   └── preprocess/              # reference cell images for preprocessing parity (model contract)
├── docs/architecture/           # this documentation
├── package.json                 # pnpm workspaces
└── justfile                     # one command list for both toolchains
```

## 5.2 Level 1

```mermaid
flowchart TB
    subgraph app["apps/mobile [Expo app]"]
        ui["Game UI<br>board, keyboard, timer, stats"]
        scanui["Scan UI<br>camera, outline, transition,<br>correction screen"]
        scanner["scanner module<br>src/scanner/index.ts"]
        store["Local storage<br>puzzles, progress, stats"]
    end
    core["@sudoku/core<br>[TS package]<br>generate, solve, hint, validate"]
    models[("assets/models<br>.tflite + manifest")]
    ml["ml/<br>[Python]<br>train, evaluate, export, promote"]

    ui --> core
    scanui --> scanner
    scanui --> core
    ui --> store
    scanner --> models
    ml -->|just promote-model| models
```

## 5.3 Building blocks

| Block | Responsibility | Depends on | Must not depend on |
| --- | --- | --- | --- |
| **@sudoku/core** | Board model, rule checks, a backtracking solver (uniqueness), a technique solver (grading and hints), the generator ([ADR-011](adr/adr-011-puzzle-generation-and-hints.md)) | nothing | React Native, Expo, any I/O (SUD-04) |
| **Game UI** | Playing: input, notes, undo, timer, mistake highlighting, stats screens | @sudoku/core, local storage | the scanner (SUD-03) |
| **Scan UI** | Camera screen, live outline, lock-on, capture, transition animation, correction screen | scanner module, @sudoku/core (to validate and solve the corrected grid) | scanner internals |
| **scanner module** | Frame → corners (live). Photo + corners → 81 recognised cells (on capture). Loads the promoted model | VisionCamera, fast-opencv, fast-tflite (ADR-002), the promoted model | the game UI, local storage |
| **Shared utils** (`src/utils/`) | Geometry types, the one homography implementation, development logs. Code that more than one feature uses | nothing in the app | React, React Native, any feature folder |
| **Local storage** | Puzzles, progress, puzzle pool, history, settings in expo-sqlite, behind repository interfaces so a sync layer can be added later ([ADR-012](adr/adr-012-local-persistence.md)) | expo-sqlite | — |
| **Fixture runner** | Development builds only. Runs the real scanner on fixture photos, writes cell images, reports scores ([ADR-010](adr/adr-010-testing-and-ci.md)) | scanner module | — |
| **ml/** | Dataset assembly, synthetic data, training, evaluation on fixtures, export, promote | contracts/, fixtures/ | anything in apps/ or packages/ |

## 5.4 The scanner interface

The game and Scan UI see only this. `Point` and `Quad` come from `src/utils/geometry.utils.ts`, because the scanner and
the Scan UI both use them. Whether a step runs in fast-opencv or in a Swift plugin is
invisible behind it (ADR-002). The types below are illustrative, not final.

```ts
type Point = { x: number; y: number }     // normalised: 0..1 of the upright image
type Quad = [Point, Point, Point, Point]  // TL, TR, BR, BL

// Live. The hook gives the frame processor a detector once the frame resizer is ready.
// score: the share of the frame that the quad covers, 0..1.
useGridDetector(): ((frame: Frame) => { quad: Quad; score: number } | null) | undefined

// Once, after lock-on and capture. Runs off the JS thread.
// Maps the quad onto the photo (EXIF orientation applied) and re-detects corners near it.
recognise(photo: Photo, quad: Quad): Promise<{
  cells: Array<{
    digit: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9  // 0 = empty
    kind: 'none' | 'printed' | 'handwritten' | 'notes'
    confidence: number                           // min of both heads
    cell: Uri                                    // 64 × 64 cell image: correction screen, export, fixtures
  }>                                             // 81 cells, row-major
  flattened: Uri                                 // for the transition animation
  intersections: Point[]                         // 100 points, used by the animation
  modelVersion: string
}>
```

Smoothing the live corners, the lock-on rule and the animation live in the Scan UI, not in the
scanner. See [scan-pipeline](00-concepts/scan-pipeline.md).
