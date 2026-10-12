set shell := ["bash", "-euo", "pipefail", "-c"]

# Show every recipe
default:
    @just --list

# Install all dependencies, TypeScript and Python
setup:
    pnpm install
    uv sync --directory ml

# Start the Expo dev server
app:
    pnpm --filter mobile start

# Run every test
test: test-ts test-ml

# Vitest (core), Jest (app) and the lint plugin test
test-ts:
    pnpm -r test
    node --test 'scripts/oxlint/*.test.mjs'

# pytest (ml)
test-ml:
    uv run --directory ml pytest -q

# Every lint, including the boundary rules
lint: lint-ts boundaries lint-ml

# oxlint and the oxfmt check for all TypeScript
lint-ts: format-check
    pnpm lint

# Format TypeScript, JavaScript and JSON with oxfmt
format:
    pnpm format

# Fail when a file is not formatted
format-check:
    pnpm format:check

# SUD-03, SUD-04 and SUD-05
boundaries:
    pnpm boundaries

# ruff for ml/
lint-ml:
    uv run --directory ml ruff check .
    uv run --directory ml ruff format --check .

# TypeScript typecheck for every package
typecheck:
    pnpm -r typecheck

# Bundle the iOS app with Metro, without Xcode
bundle:
    test -f apps/mobile/assets/models/cell-classifier.tflite || { echo "The model is missing. Run: just install-model <run>" >&2; exit 1; }
    pnpm --filter mobile exec expo export --platform ios --output-dir dist

# Check relative links in the docs
docs-check:
    python3 scripts/check_links.py docs AGENTS.md README.md contracts fixtures ml/README.md

# Regenerate the preprocessing reference fixtures (synthetic only, ADR-013)
preprocess-fixtures:
    uv run --directory ml python -m sudoku_ml.fixtures ../fixtures/preprocess

# Train a model from a config in ml/configs/ (default: the cell classifier)
train config="cell-classifier":
    uv run --directory ml python -m sudoku_ml.train configs/{{config}}.toml

# Export a training run to TFLite and check it against PyTorch and TFLite 2.17
export run:
    uv run --directory ml python -m sudoku_ml.export {{run}}

# Copy an exported run into the app, without the promote gate (M0, ADR-007). The run path is relative to ml/
install-model run version="1.0.0":
    uv run --directory ml python -m sudoku_ml.install {{run}} ../apps/mobile/assets/models {{version}}

# Rewrite ml/datasets/cells.csv from the folders in ml/data/cells/
dataset-manifest:
    uv run --directory ml python -m sudoku_ml.manifest

# Copy a folder of sudoku photos into ml/data/photos/ and find the grid in each. Options: --origin, --licence
import-photos folder *flags:
    uv run --directory ml python -m sudoku_ml.photo_import "$(realpath "{{folder}}")" {{flags}}

# Move cells to the labels in a relabel CSV, then rewrite the manifest
relabel file="data/review/relabels.csv":
    uv run --directory ml python -m sudoku_ml.relabel data/cells {{file}}
    just dataset-manifest

# Rank the likely wrong digit and kind labels into ml/data/work/suspects.csv, for the Review screen
suspects:
    uv run --directory ml python -m sudoku_ml.suspects

# Group the cells of each digit folder for the labelling page. The run path is relative to ml/
group-cells run="":
    uv run --directory ml python -m sudoku_ml.grouping {{run}}

# Pre-label the cells in ml/data/cells/unlabeled/ for the Digits screen. The run path is relative to ml/
prelabel-cells run="":
    uv run --directory ml python -m sudoku_ml.prelabel {{run}}

# Open the labelling page on 127.0.0.1. The manifest is rewritten before the start and at Ctrl-C
label-cells:
    just dataset-manifest
    just prelabel-cells
    uv run --directory ml python -m sudoku_ml.label_server

# Reverse every change of one labelling session
label-rollback session:
    uv run --directory ml python -m sudoku_ml.label_server rollback {{session}}
    just dataset-manifest
