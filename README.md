# sudoku

An ad-free iOS sudoku game that can scan a paper sudoku from a newspaper or puzzle book, recognise
the printed and handwritten digits on the device, and load it to play, solve or get a hint.

One monorepo, two parts that share files only:

| Part | Folder | Stack |
| --- | --- | --- |
| App (game + scanner) | `apps/mobile`, `packages/sudoku-core` | React Native (Expo), VisionCamera, Skia, TypeScript |
| ML (cell classifier) | `ml/` | Python (uv), PyTorch, exported to TFLite |

**Status:** scaffold. Start with the architecture docs below.

## Getting started

Prerequisites: Node 24, pnpm 12, uv, just. Xcode is needed from issue #2 on.

    just setup   # install TypeScript and Python dependencies
    just test    # all tests
    just lint    # oxlint, boundary rules, ruff
    just --list  # every command

## Architecture docs


- [Introduction and goals](docs/architecture/01-introduction-and-goals.md)
- [Decisions and constraints](docs/architecture/00-DECISIONS.md)
- [Scan pipeline](docs/architecture/00-concepts/scan-pipeline.md)
- [Model contract](docs/architecture/00-concepts/model-contract.md)
- [Game screen](docs/architecture/00-concepts/game-screen.md)
- [History sync](docs/architecture/00-concepts/history-sync.md)
