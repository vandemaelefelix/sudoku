---
status: DRAFT
---

# 5. Building Block View

## 5.1 Repository layout

```
sudoku/
├── apps/
│   └── mobile/                  # Expo / React Native app: game UI, scan UI, local storage
│       ├── src/scanner/         # scanner module, entered only through src/scanner/index.ts
│       └── assets/models/       # promoted model files + manifest.json (committed)
├── packages/
│   └── sudoku-core/             # @sudoku/core: board, rules, generator, solver, hints. Pure TS
├── ml/                          # Python (uv): datasets, training, evaluation, export, promote
│   ├── src/
│   ├── data/                    # images, NOT in git (ADR-009)
│   └── artifacts/               # one folder per training run, gitignored
├── contracts/                   # model contract and data formats shared by ml/ and the app
├── fixtures/scans/              # real photos + true grids, used by ml/ evaluation and app tests
├── docs/architecture/           # this documentation
├── package.json                 # pnpm workspaces + Turborepo
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
| **@sudoku/core** | Board model, rule checks, puzzle generator with difficulty grading, solver, logical next-step hints | nothing | React Native, Expo, any I/O (SUD-04) |
| **Game UI** | Playing: input, notes, undo, timer, mistake highlighting, stats screens | @sudoku/core, local storage | the scanner (SUD-03) |
| **Scan UI** | Camera screen, live outline, lock-on, capture, transition animation, correction screen | scanner module, @sudoku/core (to validate and solve the corrected grid) | scanner internals |
| **scanner module** | Frame → corners (live). Photo + corners → 81 recognised cells (on capture). Loads the promoted model | VisionCamera, fast-opencv, fast-tflite (ADR-002), the promoted model | the game UI, local storage |
| **Local storage** | Puzzles, progress, settings, stats. Behind one repository interface so a sync layer can be added later | — | — |
| **ml/** | Dataset assembly, synthetic data, training, evaluation on fixtures, export, promote | contracts/, fixtures/ | anything in apps/ or packages/ |

## 5.4 The scanner interface

The game and Scan UI see only this. Whether a step runs in fast-opencv or in a Swift plugin is
invisible behind it (ADR-002). The types below are illustrative, not final.

```ts
type Point = { x: number; y: number }
type Quad = [Point, Point, Point, Point] // TL, TR, BR, BL, in frame coordinates

// Live, called from a frame processor for every frame
detectGrid(frame: Frame): { quad: Quad; score: number } | null

// Once, after lock-on and capture
recognise(photo: Photo, quad: Quad): {
  cells: Array<{
    digit: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9  // 0 = empty
    kind: 'none' | 'printed' | 'handwritten' | 'notes'
    confidence: number                           // min of both heads
    crop: Uri                                    // for the correction screen and export
  }>                                             // 81 cells, row-major
  flattened: Uri                                 // for the transition animation
  intersections: Point[]                         // 100 points, used by the animation
  modelVersion: string
}
```

Smoothing the live corners, the lock-on rule and the animation live in the Scan UI, not in the
scanner. See [scan-pipeline](00-concepts/scan-pipeline.md).
