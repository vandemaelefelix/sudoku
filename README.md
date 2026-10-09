# sudoku

An ad-free iOS sudoku game that can scan a paper sudoku from a newspaper or puzzle book, recognise
the printed and handwritten digits on the device, and load it to play, solve or get a hint.

One monorepo, two parts that share files only:

| Part | Folder | Stack |
| --- | --- | --- |
| App (game + scanner) | `apps/mobile`, `packages/sudoku-core` | React Native (Expo), VisionCamera, Skia, TypeScript |
| ML (cell classifier) | `ml/` | Python (uv), PyTorch, exported to TFLite |

**Status:** design. No code yet. Start with the architecture docs:

- [Introduction and goals](docs/architecture/01-introduction-and-goals.md)
- [Decisions and constraints](docs/architecture/00-DECISIONS.md)
- [Scan pipeline](docs/architecture/00-concepts/scan-pipeline.md)
- [Model contract](docs/architecture/00-concepts/model-contract.md)
