set shell := ["bash", "-euo", "pipefail", "-c"]
# A git-ignored .env can hold SUDOKU_IMAGES: one image store for all worktrees (ADR-018)
set dotenv-load := true

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
test: test-ts test-api test-ml

# Vitest (core, sync contract, the sync-api unit tests), Jest (app) and the lint plugin test
test-ts:
    pnpm -r test
    node --test 'scripts/oxlint/*.test.mjs'
    node --test 'scripts/icons/*.test.mjs'
    node --test 'infra/*.test.ts'

# The DynamoDB Local image of the sync-api tests (ADR-027). Pin an exact tag
dynamodb_image := "amazon/dynamodb-local:3.3.1"
dynamodb_port := env("DYNAMODB_PORT", "8000")

# Start DynamoDB Local for the sync-api tests. All worktrees share one container
dynamodb-up:
    docker info >/dev/null 2>&1 || { echo "Docker does not run. Start Docker Desktop or Colima." >&2; exit 1; }
    docker start sudoku-dynamodb >/dev/null 2>&1 || docker run -d --name sudoku-dynamodb -p {{dynamodb_port}}:8000 {{dynamodb_image}} -jar DynamoDBLocal.jar -inMemory -sharedDb >/dev/null
    for _ in $(seq 30); do curl -s -o /dev/null http://localhost:{{dynamodb_port}} && exit 0; sleep 0.5; done; echo "DynamoDB Local did not start on port {{dynamodb_port}}." >&2; exit 1

# Stop and remove DynamoDB Local
dynamodb-down:
    docker rm -f sudoku-dynamodb

# Vitest for sync-api against DynamoDB Local
test-api: dynamodb-up
    DYNAMODB_ENDPOINT=http://localhost:{{dynamodb_port}} pnpm --filter @sudoku/sync-api test:db

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

# SUD-03, SUD-04, SUD-05, the sync contract and the account boundary (ADR-028) and the backend boundaries (ADR-027)
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

# Render every app icon and favicon PNG into apps/mobile/assets/icons (ADR-022)
icons:
    node scripts/icons/render.mjs

# Build the development variant and install it on a device (ADR-022). Find the UDID with: xcrun devicectl list devices
ios-dev device:
    cd apps/mobile && APP_VARIANT=development pnpm exec expo prebuild --platform ios --clean
    cd apps/mobile && APP_VARIANT=development pnpm exec expo run:ios --device "{{device}}"

# Build the production variant in Release and install it on a device (ADR-022)
ios-release device:
    cd apps/mobile && APP_VARIANT=production pnpm exec expo prebuild --platform ios --clean
    cd apps/mobile && APP_VARIANT=production pnpm exec expo run:ios --device "{{device}}" --configuration Release

# Check relative links in the docs
docs-check:
    python3 scripts/check_links.py docs AGENTS.md README.md contracts fixtures ml/README.md ml/LABELLING.md ml/DATA_SOURCES.md data/README.md infra services

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

# Rewrite data/cells.csv from the cell folders and the journal. --forget-missing drops the rows of vanished cells
dataset-manifest *flags:
    uv run --directory ml python -m sudoku_ml.manifest {{flags}}

# Copy a folder of sudoku photos into the image store and find the grid in each. Options: --source, --licence
import-photos folder *flags:
    folder="$(realpath "{{folder}}")" && uv run --directory ml python -m sudoku_ml.photo_import "$folder" {{flags}}

# Copy the scans that the player corrected on the phone to a folder on the Mac (#77). Find the device with: xcrun devicectl list devices. For the development variant, pass app=com.vandemaelefelix.sudoku.dev
pull-scans device destination="$HOME/scan-corrections" app="com.vandemaelefelix.sudoku":
    mkdir -p "{{destination}}"
    xcrun devicectl device copy from --device "{{device}}" --domain-type appDataContainer --domain-identifier "{{app}}" --source Documents/scan-corrections --destination "{{destination}}"

# Move cells to the digits in a relabel CSV (header file,new_label), then rewrite data/cells.csv
relabel file:
    file="$(realpath "{{file}}")" && uv run --directory ml python -m sudoku_ml.relabel "$file"
    just dataset-manifest

# Rank the likely wrong digit and kind labels into data/work/suspects.csv, for the Review screen
suspects:
    uv run --directory ml python -m sudoku_ml.suspects

# Group the cells of each digit folder for the labelling page. The run path is relative to ml/
group-cells run="":
    uv run --directory ml python -m sudoku_ml.grouping {{run}}

# Pre-label the cells in cells/unlabeled/ for the Digits screen. The run path is relative to ml/
prelabel-cells run="":
    uv run --directory ml python -m sudoku_ml.prelabel {{run}}

# Open the labelling page on 127.0.0.1. At the start it repairs a stopped session, rewrites data/cells.csv and pre-labels new cells
label-cells:
    uv run --directory ml python -m sudoku_ml.label_server

# Check that the images and the two tables in data/ agree, and print a report. Exit code 1 on a problem
check-data:
    uv run --directory ml python -m sudoku_ml.data_check

# Reverse every change of one unfinished labelling session. A finished session needs git
label-rollback session:
    uv run --directory ml python -m sudoku_ml.label_server rollback {{session}}
    just dataset-manifest

# Copy the old layout (<old_ml_root>/datasets and data/) into data/ and the image store. Dry run without --apply. Flags: --apply, --force, --prefer-log
migrate-layout old_ml_root *flags:
    old="$(realpath "{{old_ml_root}}")" && uv run --directory ml python -m sudoku_ml.migrate_layout "$old" {{flags}}

# SST reads AWS_* variables before its own profile. These recipes remove them, so only the profile sudoku is used (ADR-027)
sudoku_aws := "env -u AWS_ACCESS_KEY_ID -u AWS_SECRET_ACCESS_KEY -u AWS_SESSION_TOKEN AWS_PROFILE=sudoku"

# Sign in to the personal AWS account. The profile sudoku reads this session. A bare aws login writes into the wrong profile
aws-login:
    aws login --profile sudoku-login

# Deploy the backend to a stage: felix, dev or production. Run just aws-login first
deploy-api stage:
    {{sudoku_aws}} node infra/check-account.ts
    {{sudoku_aws}} node infra/kill-switch-check.ts "{{stage}}"
    {{sudoku_aws}} pnpm exec sst deploy --stage "{{stage}}"

# Turn a stage on again after the kill switch stopped it (ADR-027). It shows the cost of the month and asks first. Option: --yes
api-on stage *flags:
    {{sudoku_aws}} node infra/check-account.ts
    {{sudoku_aws}} node infra/api-on.ts "{{stage}}" {{flags}}

# Show what a deploy would change on a stage, without a change
diff-api stage:
    {{sudoku_aws}} node infra/check-account.ts
    {{sudoku_aws}} pnpm exec sst diff --stage "{{stage}}"

# Remove a stage of the backend. SST refuses production (protect)
remove-api stage:
    {{sudoku_aws}} node infra/check-account.ts
    {{sudoku_aws}} pnpm exec sst remove --stage "{{stage}}"

# Smoke-test the sync API on a deployed stage with a real Clerk token. Export CLERK_SECRET_KEY of the development instance first
smoke-api stage user:
    node services/sync-api/scripts/smoke.ts "{{stage}}" "{{user}}"

# Typecheck sst.config.ts and infra/. It downloads the SST providers the first time
typecheck-infra:
    {{sudoku_aws}} pnpm exec sst install --stage felix
    pnpm typecheck:infra
