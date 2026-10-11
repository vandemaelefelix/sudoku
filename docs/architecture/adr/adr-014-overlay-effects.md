---
status: DRAFT
---

# ADR-014: Scan overlay effects as plug-in modules, with an effect lab in development builds

| Field   | Value      |
| ------- | ---------- |
| Project | Sudoku     |
| Status  | Proposed   |
| Date    | 2026-10-11 |
| Contact | Felix      |

## Context

The live overlay on the camera screen shows the user that the app sees the grid
([scan pipeline](../00-concepts/scan-pipeline.md)). The prototype "Scan flow studies" has 21 live
overlay effects in four families: path, shader, screen and simulation. A browser shows them, but
the developer must judge them on the real camera, with real corners, real light and the frame
budget of the phone.

Before this decision, the dot field was the only overlay. It computed its own grid facts: found,
lost, jump, presence and motion. A second effect would repeat that code. The
[effect lab design](../../superpowers/specs/2026-10-11-effect-lab-design.md) gives the full
reasoning.

## Alternatives Evaluated

| Option | For | Against |
| --- | --- | --- |
| One React component per effect | Simple to start | Each component repeats the grid facts and the frame callback. A switch mounts a new canvas and loses the grid state |
| One shader with an effect index | One draw call | Fits only the shader family. Path and simulation effects cannot live in one shader. One compile error stops every effect |
| **Effect modules on one engine and one scene** | The grid facts are computed once. An effect is one folder and one line. A switch keeps the scene | A small framework to keep: the effect interface, the draw kit and the registry |

## Decision

1. An effect is a module with three worklets: `create`, `step` and `draw`
   (`src/scan/effects/types.ts`). An effect reads the scene. It never changes the scene.
2. `stepScene` computes the grid facts once per frame on the UI thread: the grid and its
   matrices, the found and lost events, presence, motion and the steady state.
3. One engine, `EffectCanvas`, runs one frame callback and records one Skia picture. The active
   effect is a shared value with an index into `EFFECTS`. Only the JS thread writes it.
4. The engine makes the paints, the star sprite and the compiled runtime shaders once, in a draw
   kit. An effect does not make them per frame.
5. A shader effect is a Skia runtime shader in SkSL. Runtime SkSL has no `fwidth`, so the shader
   calculates the pixel size from the Jacobian of the inverse homography.
6. A development build has an effect lab: a dev pill on the camera screen lists the effects and
   switches at once. The pill saves the effect id as `lab.effect` through `SettingsRepository`
   on the expo-sqlite key-value store (ADR-012).
7. A release build has no pill, reads no setting and runs `DEFAULT_EFFECT` (Gathering dots) only.

## Consequences

- To add an effect, add a folder in `src/scan/effects/` and one line in `effects/index.ts`. To
  remove an effect, delete both.
- The scene and one effect must stay within 4 ms per frame on the UI thread.
- A shader that does not compile draws nothing, and the development log names it. Jest compiles
  every SkSL source with CanvasKit, so most compile errors fail `just test-ts`.
- The saved choice is a key-value pair, not a row. The row rules of ADR-012 (UUID keys,
  timestamps, soft delete) are for data that may sync. A development setting does not sync.
- Lock-on does not exist yet. Each effect shows its lock-on reaction in the steady state.
- The other 17 effects of the prototype can come later without a change to the engine.

## Reassessment Triggers

- The developer picks an effect for players. A player setting needs its own ADR and a settings
  screen.
- One effect needs more than 4 ms per frame, or needs a fact that the scene does not give.
- The lock-on rule exists. Then the scene gives a real lock-on event in place of the steady state.
