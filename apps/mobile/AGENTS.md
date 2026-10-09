# AGENTS.md: the Expo app

These instructions add to the root `AGENTS.md`. They apply to work in `apps/mobile/`.

## Do not trust remembered Expo APIs

Expo changes its APIs in every SDK release. Before you write code that uses an Expo, EAS or
React Native API:

1. Read the major version of `expo` in `package.json`.
2. Read the docs for that version: `https://docs.expo.dev/versions/v<major>.0.0/`.
3. For other topics, start at `https://docs.expo.dev/llms.txt`. Do not answer from memory.

## Commands

| Task | Command |
| --- | --- |
| Add a dependency | `pnpm exec expo install <package>`. It picks the version that fits the SDK. Do not use `pnpm add` for Expo or React Native packages |
| Start the dev server | `just app` |
| Check the Expo setup | `pnpm dlx expo-doctor` |
| Lint, typecheck, test | `just lint`, `just typecheck`, `just test-ts` from the repository root |

Run lint, typecheck and tests before you say a task is done.

## Rules

- `ios/` and `android/` are generated (Continuous Native Generation, ADR-002). Do not create,
  edit or commit them. Configure native behaviour in `app.json` and config plugins.
- Native modules need a development build, not Expo Go. Build locally with
  `pnpm exec expo run:ios`. Cloud builds (EAS) are not used yet (ADR-010).
- Keep the folders: `src/game/` (game UI), `src/scan/` (scan UI), `src/scanner/` (scanner, entered
  only through `src/scanner/index.ts`). Navigation is not decided yet. Do not add Expo Router
  without an ADR.
