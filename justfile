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
    node --test 'tools/oxlint/*.test.mjs'
    node --test 'tools/icons/*.test.mjs'
    node --test 'tools/layout/*.test.mjs'
    node --test 'tools/delete-scans/*.test.mjs'
    node --test 'backend/infra/*.test.ts'

# Time nextSteps on the bench set (under 5 ms for one call) and the generation of each level (QR-12)
bench-core:
    pnpm --filter @sudoku/core bench

# Measure how many generated puzzles the techniques of the solver solve. It takes minutes and prints Markdown tables
technique-coverage:
    pnpm --filter @sudoku/core technique-coverage

# Time the puzzle generation of each level on this machine (QR-12). It prints a table for the quality record
bench-generate:
    pnpm --filter @sudoku/core exec vitest bench --run --silent=false bench/generate.bench.ts

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
lint: lint-ts boundaries lint-ml check-layout

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

# SUD-12: the root holds only the folders and files of ADR-029
check-layout:
    node tools/layout/check-layout.mjs

# ruff for ml/
lint-ml:
    uv run --directory ml ruff check .
    uv run --directory ml ruff format --check .

# TypeScript typecheck for every package
typecheck:
    pnpm -r typecheck

# Bundle the iOS app with Metro, without Xcode
bundle:
    test -f mobile/assets/models/cell-classifier.tflite || { echo "The model is missing. Run: just install-model <run>" >&2; exit 1; }
    pnpm --filter mobile exec expo export --platform ios --output-dir dist

# Render every app icon and favicon PNG into mobile/assets/icons (ADR-022)
icons:
    node tools/icons/render.mjs

# Build the development variant and install it on a device (ADR-022). Find the UDID with: xcrun devicectl list devices
ios-dev device:
    cd mobile && APP_VARIANT=development pnpm exec expo prebuild --platform ios --clean
    cd mobile && APP_VARIANT=development pnpm exec expo run:ios --device "{{device}}"

# Build the production variant in Release and install it on a device (ADR-022)
ios-release device:
    cd mobile && APP_VARIANT=production pnpm exec expo prebuild --platform ios --clean
    cd mobile && APP_VARIANT=production pnpm exec expo run:ios --device "{{device}}" --configuration Release

# Build the development variant in Release and install it on a device, to measure the quality scenarios (ADR-022). It needs no Metro
ios-measure device:
    test -f mobile/assets/models/cell-classifier.tflite || { echo "The model is missing. Run: just install-model <run>" >&2; exit 1; }
    cd mobile && APP_VARIANT=development pnpm exec expo prebuild --platform ios --clean
    cd mobile && APP_VARIANT=development pnpm exec expo run:ios --device "{{device}}" --configuration Release

# Build the development variant in Release for the iOS Simulator, without code signing (ADR-010). It needs no Metro
ios-simulator:
    test -f mobile/assets/models/cell-classifier.tflite || { echo "The model is missing. Run: just install-model <run>" >&2; exit 1; }
    cd mobile && APP_VARIANT=development pnpm exec expo prebuild --platform ios --clean
    just ios-simulator-build

# Run xcodebuild on a prebuilt mobile/ios. The app lands in mobile/ios/DerivedData/Build/Products/Release-iphonesimulator/SudokuDev.app
ios-simulator-build:
    cd mobile/ios && xcodebuild -workspace SudokuDev.xcworkspace -scheme SudokuDev -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath DerivedData ARCHS=arm64 CODE_SIGNING_ALLOWED=NO -quiet build

# The simulator of the end-to-end flows. The flows clear the app data, so they never run on a simulator of daily use
e2e_simulator := "Sudoku E2E iOS 26"

# Run the Maestro flows of mobile/e2e on the app of just ios-simulator. Pass one flow file, or flags such as --exclude-tags model
e2e flow="mobile/e2e" *flags:
    #!/usr/bin/env bash
    set -euo pipefail
    app=mobile/ios/DerivedData/Build/Products/Release-iphonesimulator/SudokuDev.app
    test -d "$app" || { echo "The app is missing. Run: just ios-simulator" >&2; exit 1; }
    udid=$(xcrun simctl list devices available | grep -F "{{e2e_simulator}} (" | grep -oE '[0-9A-F-]{36}' | head -1 || true)
    # The flows use iOS 26, like the CI runner: it has Xcode 26.6 and no iOS 27 runtime.
    if [ -z "$udid" ]; then
      runtime=$(xcrun simctl list runtimes available | grep -E '^iOS 26\.' | tail -1 | awk '{print $NF}')
      test -n "$runtime" || { echo "No iOS 26 simulator runtime. Install one in Xcode: Settings > Components" >&2; exit 1; }
      udid=$(xcrun simctl create "{{e2e_simulator}}" "iPhone 17" "$runtime")
    fi
    xcrun simctl bootstatus "$udid" -b >/dev/null
    xcrun simctl install "$udid" "$app"
    xcrun simctl addmedia "$udid" shared/fixtures/imports/screenshot-digital.png
    # Homebrew installs the Java of Maestro keg-only, so java is not on the PATH.
    if [ -z "${JAVA_HOME:-}" ] && command -v brew >/dev/null; then
      jdk="$(brew --prefix openjdk)/libexec/openjdk.jdk/Contents/Home"
      if [ -d "$jdk" ]; then export JAVA_HOME="$jdk"; fi
    fi
    MAESTRO_CLI_NO_ANALYTICS=1 MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true maestro --device "$udid" test {{flow}} {{flags}}

# Lint the GitHub Actions workflows and actions. Needs actionlint: brew install actionlint
lint-workflows:
    actionlint

# Check relative links in the docs
docs-check:
    python3 tools/check_links.py docs AGENTS.md README.md mobile shared backend web tools ml/README.md ml/LABELLING.md ml/DATA_SOURCES.md ml/dataset/README.md

# Regenerate the preprocessing reference fixtures (synthetic only, ADR-013)
preprocess-fixtures:
    uv run --directory ml python -m sudoku_ml.fixtures ../shared/fixtures/preprocess

# Train a model from a config in ml/configs/ (default: the cell classifier). It uses only the cells that a person verified (ADR-030)
train config="cell-classifier":
    uv run --directory ml python -m sudoku_ml.train configs/{{config}}.toml

# Export a training run to TFLite and check it against PyTorch and TFLite 2.17
export run:
    uv run --directory ml python -m sudoku_ml.export {{run}}

# Copy an exported run into the app, without the promote gate (M0, ADR-007). The run path is relative to ml/
install-model run version="1.0.0":
    uv run --directory ml python -m sudoku_ml.install {{run}} ../mobile/assets/models {{version}}

# Rewrite ml/dataset/cells.csv from the cell folders and the journal. --forget-missing drops the rows of vanished cells
dataset-manifest *flags:
    uv run --directory ml python -m sudoku_ml.manifest {{flags}}

# Copy a folder of sudoku photos into the image store and find the grid in each. Options: --source, --licence
import-photos folder *flags:
    folder="$(realpath "{{folder}}")" && uv run --directory ml python -m sudoku_ml.photo_import "$folder" {{flags}}

# Copy the scans that the player corrected on the phone to a folder on the Mac (#77). Find the device with: xcrun devicectl list devices. For the development variant, pass app=com.vandemaelefelix.sudoku.dev
pull-device-scans device destination="$HOME/scan-corrections" app="com.vandemaelefelix.sudoku":
    mkdir -p "{{destination}}"
    xcrun devicectl device copy from --device "{{device}}" --domain-type appDataContainer --domain-identifier "{{app}}" --source Documents/scan-corrections --destination "{{destination}}"

# Download the uploaded scans of a stage into ml/dataset/ (ADR-030). Needs just aws-login. Pass the table and the bucket of the stage. The Fetch step of the labelling app finds them itself
pull-scans table bucket:
    {{sudoku_aws}} uv run --directory ml python -m sudoku_ml.pull_scans --table "{{table}}" --bucket "{{bucket}}"

# Set the uploaded scans with the status accepted back to unchecked, for the Outlines step (ADR-030). Run it once, for the scans of the first pull
reset-scan-outlines:
    uv run --directory ml python -m sudoku_ml.scan_outlines

# Delete the scans of one contributor ID or user ID, photo and row (ADR-030). Needs just aws-login. Pass the table and the bucket of the stage
delete-scans table bucket owner:
    {{sudoku_aws}} node tools/delete-scans/cli.ts "{{table}}" "{{bucket}}" "{{owner}}"

# Move cells to the digits in a relabel CSV (header file,new_label), then rewrite ml/dataset/cells.csv
relabel file:
    file="$(realpath "{{file}}")" && uv run --directory ml python -m sudoku_ml.relabel "$file"
    just dataset-manifest

# Rank the likely wrong digit and kind labels into ml/dataset/work/suspects.csv, for the doubtful labels tool of the start page. The app runs it too
suspects:
    uv run --directory ml python -m sudoku_ml.suspects

# Pre-label the cells of unlabeled/ and the digit folders with the full probabilities. The labelling app does this by itself. The run path is relative to ml/
prelabel-cells run="":
    uv run --directory ml python -m sudoku_ml.prelabel {{run}}

# Open the labelling app on 127.0.0.1 (ADR-034). It builds the app when a source is newer than the build. At the start the server repairs a stopped session, rewrites ml/dataset/cells.csv and pre-labels the open cells. Option: port=8799
label-cells port="8765":
    #!/usr/bin/env bash
    set -euo pipefail
    built=tools/label-app/dist/index.html
    if [ ! -f "$built" ] || [ -n "$(find tools/label-app/src tools/label-app/index.html tools/label-app/package.json tools/label-app/vite.config.ts -newer "$built" -print -quit)" ]; then
      pnpm --filter @sudoku/label-app build
    fi
    uv run --directory ml python -m sudoku_ml.label_server --port "{{port}}"

# Check that the images and the two tables in ml/dataset/ agree, and print a report. Exit code 1 on a problem
check-data:
    uv run --directory ml python -m sudoku_ml.data_check

# Reverse every change of one unfinished labelling session. A finished session needs git
label-rollback session:
    uv run --directory ml python -m sudoku_ml.label_server rollback {{session}}
    just dataset-manifest

# Copy the old layout (<old_ml_root>/datasets and data/) into ml/dataset/ and the image store. Dry run without --apply. Flags: --apply, --force, --prefer-log
migrate-layout old_ml_root *flags:
    old="$(realpath "{{old_ml_root}}")" && uv run --directory ml python -m sudoku_ml.migrate_layout "$old" {{flags}}

# SST reads AWS_* variables before its own profile. These recipes remove them, so only the profile sudoku is used (ADR-027)
sudoku_aws := "env -u AWS_ACCESS_KEY_ID -u AWS_SECRET_ACCESS_KEY -u AWS_SESSION_TOKEN AWS_PROFILE=sudoku"

# Sign in to the personal AWS account. The profile sudoku reads this session. A bare aws login writes into the wrong profile
aws-login:
    aws login --profile sudoku-login

# Deploy the backend to a stage: felix, dev or production. Run just aws-login first
deploy-api stage:
    {{sudoku_aws}} node backend/infra/check-account.ts
    {{sudoku_aws}} node backend/infra/kill-switch-check.ts "{{stage}}"
    {{sudoku_aws}} pnpm exec sst deploy --stage "{{stage}}"

# Turn a stage on again after the kill switch stopped it (ADR-027). It shows the cost of the month and asks first. Option: --yes
api-on stage *flags:
    {{sudoku_aws}} node backend/infra/check-account.ts
    {{sudoku_aws}} node backend/infra/api-on.ts "{{stage}}" {{flags}}

# Show what a deploy would change on a stage, without a change
diff-api stage:
    {{sudoku_aws}} node backend/infra/check-account.ts
    {{sudoku_aws}} pnpm exec sst diff --stage "{{stage}}"

# Remove a stage of the backend. SST refuses production (protect)
remove-api stage:
    {{sudoku_aws}} node backend/infra/check-account.ts
    {{sudoku_aws}} pnpm exec sst remove --stage "{{stage}}"

# Smoke-test the sync API on a deployed stage with a real Clerk token. Export CLERK_SECRET_KEY of the development instance first
smoke-api stage user:
    node backend/api/scripts/smoke.ts "{{stage}}" "{{user}}"

# Typecheck sst.config.ts and backend/infra/. It downloads the SST providers the first time
typecheck-infra:
    {{sudoku_aws}} pnpm exec sst install --stage felix
    pnpm typecheck:infra
