# Lock-on After Retake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a Retake, the scan locks on like a fresh scan. `DRIFT_LIMIT` goes from 100 to 150 pt/s (issue #72, second device run).

**Architecture:** The second device run showed that every failure came after a Retake. The scene was not armed for 4 to 11 s with the grid in view. A smooth move to another puzzle is never a jump, and the grid never leaves the view, so the scene never armed. The developer decided to drop the Retake block. With no Retake block, nothing makes a scene that is not armed, so the `armed` machinery goes: the `armed` prop chain (ScanFlow → CameraScreen → EffectCanvas → engine → createScene), the scene fields `armed` and `lostSince`, the re-arm logic and `REARM_LOST`. ScanFlow still mounts a new CameraScreen on Retake, so the scene, the warm-up and the transition start new. The run also gave a hand-held drift of p90 125 pt/s and p95 171 pt/s, and pans of 200 to 370 pt/s, so `DRIFT_LIMIT` becomes 150.

**Tech Stack:** TypeScript, React Native, Reanimated worklets, Jest.

**Spec:** Issue #72 and the developer's decisions of 2026-10-12: "Normal after Retake" and "`DRIFT_LIMIT` 150 pt/s". Acceptance criterion 5 changes to: "The intent rules still hold: no lock-on in the warm-up, and no lock-on on a grid smaller than `MIN_GRID_WIDTH`. After a Retake, the scan works like a fresh scan."

## Global Constraints

- After a Retake, a new scene starts. It has the warm-up (`WARMUP` = 1.0 s) and the dwell (`LOCK_DWELL` = 1.0 s), like the first scene.
- `DRIFT_LIMIT` = 150 pt/s. `DRIFT_WINDOW` stays 0.3 s.
- Keep the warm-up, the minimum grid size, the hysteresis, the jump and the drift rules, and their tests.
- Delete code that only served the Retake block. Do not leave a parameter that only tests use.
- Code comments: the reason, not the action. No TODO. No issue numbers in code.
- Prose follows the AGENTS.md writing style. ADR-019 is still Proposed, so this change edits it in place.
- Do not commit or push.
- Before you say a task is done, run `just lint`, `just typecheck` and `just test-ts` from the repository root. All three must pass.

## Review Focus

1. Retake with the same puzzle in view: a new scene locks on after the warm-up and the dwell. Pinned by the existing dwell tests in `scene.test.ts`, because every scene now starts the same way, and by the ScanFlow remount test.
2. A pan at 200 pt/s, faster than the new limit of 150: it must still never lock on. A window over the turn of a pan gives a low drift, so this is the input most likely to break. Pinned by the existing pan test.
3. The overlay tests that move a grid slowly must not lock on, or they test a frozen quad. Pinned in Task 1, Step 5.
4. The lock log line loses `armed`. The EffectCanvas regex must follow. Pinned in Task 1.
5. No `armed` prop may remain in a component's props. Pinned by `just typecheck` after the prop goes.

---

### Task 1: Remove the Retake block, and raise DRIFT_LIMIT

**Files:**
- Modify: `apps/mobile/src/scan/effects/scene.constants.ts`
- Modify: `apps/mobile/src/scan/effects/scene.ts`
- Modify: `apps/mobile/src/scan/effects/engine.ts`
- Modify: `apps/mobile/src/scan/effects/components/EffectCanvas/EffectCanvas.tsx`
- Modify: `apps/mobile/src/scan/screens/CameraScreen/CameraScreen.tsx`
- Modify: `apps/mobile/src/scan/screens/ScanFlow/ScanFlow.tsx`
- Test: `scene.test.ts`, `engine.test.ts`, `gathering-dots/field.test.ts`, `EffectCanvas.test.tsx`, `CameraScreen.test.tsx`, `ScanFlow.test.tsx` (each next to its source)

**Interfaces:**
- Produces: `createScene(view: ViewSize): Scene`. `advance(engine, effect, view, quad, t, reduceMotion): Engine`. `EffectCanvas` and `CameraScreen` have no `armed` prop. `LockReport` has no `armed` field. The lock line starts `grid yes, steady …`.

- [ ] **Step 1: Change the tests first**

1. `scene.test.ts`:
   - Delete the whole `describe('a scene that starts not armed', …)` block.
   - Remove `REARM_LOST` from the import.
   - In `describe('lock-on', …)`, change `function warm(armed = true) { return run(createScene(VIEW, armed), null, 0, AFTER - FRAME) }` to `function warm() { return run(createScene(VIEW), null, 0, AFTER - FRAME) }`.
   - In `describe('lockReport', …)`: delete the test `reports not armed for a scene after a Retake`. Remove `armed: true` from the `toMatchObject` in `reports every rule as passed…`. Remove `armed: true,` from the `formatLockReport` input. Change the expected line to `'grid yes, steady no (motion 0.62, speed 18.6 pt/s), drift 12.3 pt/s moving no, width 0.75 big yes, warm yes, progress 0.00, locked no'`.
   - Add this test inside `describe('lock-on', …)`, after `locks on LOCK_DWELL after the grid is found`:

```ts
  it('locks on a grid that is in view from the first frame, after the warm-up and the dwell', () => {
    const scene = run(createScene(VIEW), gridAt(50, 300), 0, WARMUP + LOCK_DWELL + 0.5)
    expect(Math.abs(scene.lockedAt - (WARMUP + LOCK_DWELL))).toBeLessThanOrEqual(FRAME)
  })
```

   This is the Retake case: the puzzle is in view when the new camera screen opens.

2. `engine.test.ts`: delete the tests `creates an armed scene by default, and a scene that is not armed on request` and `keeps the scene armed state on later frames`.

3. `EffectCanvas.test.tsx`:
   - Delete the test `never calls onLock while the scene is not armed and the grid stays in view`.
   - In `logs the lock-on rules four times per second in the live phase`, remove the `armed={false}` prop. Change the regex to `/^\[lock\] grid yes, steady (yes|no) \(motion \d\.\d\d, speed \d+\.\d pt\/s\), drift \d+\.\d pt\/s moving (yes|no)/`.

4. `CameraScreen.test.tsx`: delete the test `arms the effect canvas by default, and passes armed on`.

5. `ScanFlow.test.tsx`:
   - Delete the test `arms the first camera screen`.
   - In `goes back live with a new scene on Retake from the review` and in `mounts a new camera screen and a new effect canvas on Retake from the transition`, delete the two lines that read `.armed`.

6. `gathering-dots/field.test.ts`: change `world` to:

```ts
/** lockOn: false keeps the scene in its warm-up forever, so it never locks on and follows every move of the grid. */
function world(lockOn = true): World {
  const scene = createScene(VIEW)
  if (!lockOn) scene.startedAt = Number.POSITIVE_INFINITY
  return { scene, field: createField(VIEW) }
}
```

   In `pan()` and in `keeps 15 % of the wobble while the grid moves`, `world(false)` stays. In `pan()`, change the comment to `// The scene never locks on, so it follows the whole pan. The grid creeps at 35 pt/s while the dots gather.`

- [ ] **Step 2: Run the tests to verify they fail**

Run from `apps/mobile/`: `pnpm exec jest src/scan`
Expected: FAIL. The format test fails (the line still has `armed`). The new "in view from the first frame" test passes already, because `createScene` is armed by default. Write which tests fail in the report.

- [ ] **Step 3: Change the code**

1. `scene.constants.ts`: delete `REARM_LOST` and its comment. Change `DRIFT_LIMIT` to `150`. Keep its comment.

2. `scene.ts`:
   - Remove `REARM_LOST` from the import.
   - In the `Scene` doc comment, delete the two lines that start with ` * armed:` and ` * That time without a grid counts`. In the line that starts with ` * startedAt:`, delete the sentence about `lostSince`, so the line reads ` * startedAt: the time of the first frame, or -1.`
   - Delete the fields `armed: boolean` and `lostSince: number` from `Scene`.
   - Change `createScene`: delete its doc comment line `/** armed: false after a scan or a Retake, … */`. Change the signature to `export function createScene(view: ViewSize): Scene`. Delete `armed,` and `lostSince: -1,` from the returned object.
   - In `stepScene`: in the `if (grid == null) { … } else { … }` block, delete `if (scene.lostSince < 0) scene.lostSince = t` and `scene.lostSince = -1`. Keep the `bigSince` lines. Delete the comment that starts `// Camera start-up frames have no grid`, the `const absent = …` line and the `if (!scene.armed && (jumped || absent)) scene.armed = true` line. Change `const ready = scene.armed && !moving && scene.bigSince >= 0` to `const ready = !moving && scene.bigSince >= 0`.
   - In `LockReport`, delete `armed: boolean`. In `lockReport`, delete `armed: scene.armed,`.
   - In `formatLockReport`, change the first template line to `` `grid ${yesNo(report.grid)}, ` + ``.

3. `engine.ts`: delete the doc line ` * armed: applies only to a new scene, see createScene.`. Delete the `armed = true,` parameter. Change `createScene(view, armed)` to `createScene(view)`.

4. `EffectCanvas.tsx`: delete the doc line that starts ` * armed: false after a scan or a Retake`. Delete `armed = true,` from the destructured props and `armed?: boolean` from the props type. Change `advance(current, active, size, quad, t, reduceMotion, armed)` to `advance(current, active, size, quad, t, reduceMotion)`.

5. `CameraScreen.tsx`: delete the doc line that starts ` * armed: false for a CameraScreen after a Retake`. Delete `armed = true,`, `armed?: boolean` and the `armed={armed}` prop of `EffectCanvas`.

6. `ScanFlow.tsx`: change the last return to `return <CameraScreen key={scene} layout={layout} onDone={done} onRetake={retake} />`. Delete the comment `// Only the first scene arms at once. After a Retake the same puzzle is often still in view.` Change the comment above `const [scene, setScene]` to `// A new key mounts a new CameraScreen: the effect scene, its warm-up and the flattened grid start new.`

- [ ] **Step 4: Search for leftovers**

Run from the repository root: `grep -rnE "armed|REARM_LOST|lostSince" apps/mobile/src`
Expected: no line. If one remains, remove it, or say in the report why it stays.

- [ ] **Step 5: Run the tests to verify they pass**

Run from `apps/mobile/`: `pnpm exec jest src/scan`
Expected: PASS. If the pan test (`never locks on while the player pans over the page`) fails with the new limit, do not change the pan speed or the limit. Stop and report the `lockedAt` value and the drift values near it.

- [ ] **Step 6: Run the checks**

Run from the repository root: `just lint`, then `just typecheck`, then `just test-ts`. All pass. Do not commit.

---

### Task 2: ADR-019, the concept and the glossary

**Files:**
- Modify: `docs/architecture/adr/adr-019-lock-on-tracked-grid.md`
- Modify: `docs/architecture/00-concepts/scan-pipeline.md`
- Modify: `docs/architecture/12-glossary.md`
- Modify: `docs/architecture/00-DECISIONS.md`, `docs/architecture/09-architecture-decisions.md` (the ADR-019 rows)

- [ ] **Step 1: ADR-019**

1. In Context, add this paragraph at the end of the section:

```markdown
A second device run found a second block. After a Retake, the scene was not armed for 4 to 11 s
with the grid in view. It armed only on a jump or a loss. A smooth move to another puzzle is
neither, so the scan did not lock on. The hand-held drift was p90 125 pt/s and p95 171 pt/s.
A pan was 200 to 370 pt/s.
```

2. In Decision, change `A drift above `DRIFT_LIMIT` = 100 pt/s is a clear move.` to `A drift above `DRIFT_LIMIT` = 150 pt/s is a clear move.` Replace the bullet `- The intent rules of the scan-pipeline concept stay: armed, the warm-up and the minimum grid size.` with these two bullets:

```markdown
- The intent rules of the scan-pipeline concept stay: the warm-up and the minimum grid size.
- A Retake starts a fresh scan. The Retake block of issue #19 (a scene that is not armed) is removed.
```

3. In Consequences, add: `- After a Retake, the scan locks on after the warm-up and the dwell, also on the same puzzle. The burst of issue #73 makes a second capture of the same view useful.`

4. In Reassessment Triggers, change `far from 100 pt/s` to `far from 150 pt/s`. Add: `- Players get an unwanted second capture right after a Retake.`

- [ ] **Step 2: The scan-pipeline concept**

1. In the Lock-on row, change `DRIFT_LIMIT` = 100 pt/s to `DRIFT_LIMIT` = 150 pt/s.
2. In the same row, replace the text from `(1) The scene is armed.` up to and including `(2) The scene is older than `WARMUP` = 1.0 s. (3)` with `(1) The scene is older than `WARMUP` = 1.0 s. A Retake starts a new scene, so the warm-up runs again. (2)`.
3. Below the transition text, change `The overlay gets a new scene, so the lock-on latch is fresh.` to `The overlay gets a new scene, so the lock-on latch and the warm-up start new.`
4. In Open questions, change the row `Lock-on intent: final values of `REARM_LOST`, `WARMUP` and `MIN_GRID_WIDTH`` to `Lock-on intent: final values of `WARMUP` and `MIN_GRID_WIDTH``.

- [ ] **Step 3: The glossary**

Delete the row `Armed (lock-on)`. Search the glossary for other uses of "armed" and remove them.

- [ ] **Step 4: The index rows**

In the ADR-019 rows of `00-DECISIONS.md` and `09-architecture-decisions.md`, add at the end of the text: ` A Retake starts a fresh scan.` (keep the row format and the final period style of each table).

- [ ] **Step 5: Checks**

Run `grep -rn -i "armed\|REARM" docs/architecture`. Expected: only lines in other ADRs that describe history, if any. Run `just lint`, `just typecheck`, `just test-ts`. Do not commit.

---

### Task 3: The issue and the device run

- [ ] **Step 1 (controller):** Edit acceptance criterion 5 of issue #72 to the text in the Spec line above. Post a comment with the second device run: the Retake cause and the drift values.
- [ ] **Step 2 (developer):** Reload the app. Scan. Tap Retake. Scan the same puzzle, then another puzzle on the page. Each must lock on after about 2 s. Pan over the page: no lock-on during the pan.
- [ ] **Step 3:** Read the `[lock]` lines. Tick criteria 3 to 6 when the developer agrees. Set ADR-019 to Accepted in the ADR, `00-DECISIONS.md` and `09-architecture-decisions.md`.
