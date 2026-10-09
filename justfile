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

# Vitest (core) and Jest (app)
test-ts:
    pnpm -r test

# pytest (ml)
test-ml:
    uv run --directory ml pytest -q

# Every lint, including the boundary rules
lint: lint-ts boundaries lint-ml

# oxlint for all TypeScript
lint-ts:
    pnpm lint

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
    pnpm --filter mobile exec expo export --platform ios --output-dir dist

# Check relative links in the docs
docs-check:
    python3 scripts/check_links.py docs AGENTS.md README.md contracts fixtures ml/README.md
