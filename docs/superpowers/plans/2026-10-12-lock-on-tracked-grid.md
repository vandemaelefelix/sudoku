# Lock-on on a Tracked Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The scan locks on when the same grid stays in view for `LOCK_DWELL`, also when a hand holds the phone. Only clear movement, such as a pan over the page, starts the dwell again (issue #72).

**Architecture:** The device test of #72 showed the cause. The lock-on rule needs `steady`, and `steady` reads a speed from one detection step. Corner noise on a hand-held phone gives a median of 28.8 pt/s, so `steady` is true in only 16 % of the frames, and the dwell never completes. The fix keeps `motion` and `steady` for the overlay. Lock-on reads a new **drift** instead: the net corner speed over `DRIFT_WINDOW` = 0.3 s. Noise and tremor go back and forth, so they cancel over the window. A pan goes one way, so it stays. The dwell counts from the latest of the found time, the end of the warm-up, the time the grid became big, and the last time the drift was above `DRIFT_LIMIT`.

**Tech Stack:** TypeScript worklets (Reanimated), Jest.

**Spec:** GitHub issue #72, acceptance criteria 3 to 6. The device result is in the issue comment of 2026-10-12. The developer's rule: "There will always be some movement, and for some people more than for others." The scan must track the same grid across frames and must not need a still phone.

## Global Constraints

- Do not change the intent rules: no lock-on in the `WARMUP`, no lock-on after a Retake until the grid leaves the view (`armed`), no lock-on on a grid smaller than `MIN_GRID_WIDTH`. Their existing tests must pass unchanged.
- Do not change `motion`, `steady`, `STEADY_SPEED` or `STEADY_MOTION` behaviour. The gathering dots read `scene.motion` (`gathering-dots/field.ts`).
- `DRIFT_WINDOW` = 0.3 s. `DRIFT_LIMIT` = 100 pt/s. Both are provisional until the device run.
- The lock-on change needs a new ADR first (AGENTS.md rule 2). The ADR is **ADR-019**: the #74 spike plan may take ADR-018. Do not edit ADR-004. Issue #73 amends ADR-004 at the same time.
- Code comments: the reason, not the action. No TODO. No issue numbers in code. Point to the scan-pipeline concept or ADR-019.
- Prose follows the AGENTS.md writing style (Simplified Technical English, light).
- Do not commit or push. The developer asks for commits.
- Before you say a task is done, run `just lint`, `just typecheck` and `just test-ts` from the repository root. All three must pass.

## Review Focus

1. A hand-held phone over a still page: corner noise of a few points per detection, and a slow sway. It must lock on after `WARMUP` + `LOCK_DWELL`. Pinned in Task 1 (fails today).
2. A pan over the page: it must never lock on while the pan goes on. Pinned in Task 1.
3. A pan that stops: lock-on comes `LOCK_DWELL` after the pan stops, not after the grid was found. Pinned in Task 1.
4. A window that spans the turn of a pan gives a low drift. The dwell must still not complete, because the next window is high again. Pinned by the pan test in Task 1.
5. The overlay must look the same: `motion` and `steady` keep their values. Pinned by the existing `stepScene` tests, which must pass unchanged.

---

### Task 1: Drift in the scene, and the lock-on rule reads it

**Files:**
- Modify: `apps/mobile/src/scan/effects/scene.constants.ts`
- Modify: `apps/mobile/src/scan/effects/scene.ts`
- Test: `apps/mobile/src/scan/effects/scene.test.ts`

**Interfaces:**
- Consumes: the existing `Scene`, `stepScene`, `createScene`, `largestCornerStep`, `lockReport`, `formatLockReport` in `scene.ts`.
- Produces: new `Scene` fields `drift: number`, `driftFrom: Quad | null`, `driftFromAt: number`, `movedAt: number`. New `LockReport` fields `drift: number`, `moving: boolean`. New constants `DRIFT_WINDOW`, `DRIFT_LIMIT`.

- [ ] **Step 1: Write the failing tests**

Add `DRIFT_LIMIT` and `DRIFT_WINDOW` to the import from `./scene.constants` in `scene.test.ts`. Add this block after the `describe('lock-on', …)` block and before `describe('lockReport', …)`:

```ts
/** Detections at 30 fps, frames at 120 fps: each detection lasts 4 frames. at(t) gives the corners of a detection at time t. */
function camera(scene: Scene, at: (t: number, k: number) => Quad, t0: number, t1: number) {
  let quad: Quad | null = null
  let k = 0
  for (let t = t0; t <= t1 + 1e-9; t += 1 / 120, k++) {
    if (k % 4 === 0) quad = at(t, k)
    stepScene(scene, quad, t, false)
  }
  return scene
}

/** A still page in a hand: every corner moves up to 3 pt per detection, and the hand sways 5 pt at 1 Hz. */
function handHeld(t: number, k: number): Quad {
  const sway = 5 * Math.sin(2 * Math.PI * t)
  return gridAt(50, 300).map((p, i) => ({
    x: p.x + sway + 3 * Math.sin(k * 1.3 + i * 2.1),
    y: p.y + 3 * Math.cos(k * 0.7 + i * 1.7),
  })) as Quad
}

/** A pan over the page: the grid sweeps 100 pt left and right at 200 pt/s. */
function panning(t: number): Quad {
  const phase = (t * 2) % 2
  return gridAt(20 + 100 * (phase < 1 ? phase : 2 - phase), 300, 250)
}

describe('lock-on on a tracked grid', () => {
  it('locks on a hand-held grid after the warm-up and the dwell', () => {
    const scene = camera(createScene(VIEW), handHeld, 0, WARMUP + LOCK_DWELL + 0.5)
    expect(scene.lockedAt).toBeGreaterThanOrEqual(WARMUP + LOCK_DWELL)
    expect(scene.lockedAt).toBeLessThanOrEqual(WARMUP + LOCK_DWELL + 0.05)
  })

  it('keeps the drift of a hand-held grid below DRIFT_LIMIT', () => {
    const scene = createScene(VIEW)
    let most = 0
    camera(
      scene,
      (t, k) => {
        most = Math.max(most, scene.drift)
        return handHeld(t, k)
      },
      0,
      WARMUP,
    )
    expect(most).toBeGreaterThan(0)
    expect(most).toBeLessThanOrEqual(DRIFT_LIMIT)
  })

  it('never locks on while the player pans over the page', () => {
    const scene = camera(createScene(VIEW), (t) => panning(t), 0, 5)
    expect(scene.lockedAt).toBe(-1)
    expect(scene.drift).toBeGreaterThan(0)
  })

  it('reports moving during a pan', () => {
    const scene = createScene(VIEW)
    let seen = false
    camera(
      scene,
      (t) => {
        seen = seen || lockReport(scene).moving
        return panning(t)
      },
      0,
      2,
    )
    expect(seen).toBe(true)
  })

  it('locks on LOCK_DWELL after a pan stops', () => {
    const scene = camera(createScene(VIEW), (t) => panning(t), 0, 2)
    const still = scene.quad!
    camera(scene, () => still, 2 + 1 / 120, 4)
    expect(scene.lockedAt).toBeGreaterThanOrEqual(2 + LOCK_DWELL)
    expect(scene.lockedAt).toBeLessThanOrEqual(2 + LOCK_DWELL + 2 * DRIFT_WINDOW + 0.05)
  })
})
```

The at() callbacks read `scene.drift` and `lockReport(scene)` before the frame steps. That is the state of the frame before, which is enough here.

After a pan stops, the drift stays high until the next window ends. The window that holds the stop can still be above `DRIFT_LIMIT`. So lock-on can come up to two windows after the stop, and the bound allows that.

- [ ] **Step 2: Run the tests to verify they fail**

Run from `apps/mobile/`: `pnpm exec jest src/scan/effects/scene.test.ts -t "tracked grid"`
Expected: FAIL. `DRIFT_LIMIT` and `DRIFT_WINDOW` do not exist. After you add only the two constants (Step 3), run it again: "locks on a hand-held grid" must still FAIL with `lockedAt` = -1. That failure is the bug of #72. Write the result in the report.

- [ ] **Step 3: Add the constants**

In `scene.constants.ts`:

1. Change the comment of `STEADY_SPEED` to:

```ts
/** Corners slower than this count as slow. It drives the overlay motion. Lock-on reads the drift (ADR-019). */
```

2. Change the comment of `STEADY_MOTION` to:

```ts
/** The scene is steady while motion is below this value. The overlay shows it. Lock-on reads the drift (ADR-019). */
```

3. Add after `LOCK_DWELL`:

```ts
/** Seconds over which the drift measures the net corner move. Noise and tremor cancel over this time, a pan does not. To tune on the device, see the scan-pipeline concept. */
export const DRIFT_WINDOW = 0.3

/** Points per second. A drift above this value is a clear move, such as a pan, and starts the dwell again. To tune on the device, see the scan-pipeline concept. */
export const DRIFT_LIMIT = 100
```

- [ ] **Step 4: Change the scene**

In `scene.ts`:

1. Add `DRIFT_WINDOW` and `DRIFT_LIMIT` to the import from `./scene.constants`.

2. In the doc comment of `Scene`, replace the line that starts with ` * presence and motion: 0..1.` with:

```ts
 * presence and motion: 0..1. motion and steady drive the overlay. steadyAt: the time the scene last became steady. speed and changedAt belong to stepScene.
 * drift: the largest net corner move over the last DRIFT_WINDOW, in points per second, 0 until a window ends. driftFrom and driftFromAt: the start of the window.
 * movedAt: the last time the drift was above DRIFT_LIMIT, or -1. Lock-on reads the drift, not steady, because a hand never holds a phone still (ADR-019).
```

3. Add the fields to the `Scene` type, after `steadyAt: number`:

```ts
  drift: number
  driftFrom: Quad | null
  driftFromAt: number
  movedAt: number
```

4. Add them to `createScene`, after `steadyAt: -1,`:

```ts
    drift: 0,
    driftFrom: null,
    driftFromAt: -1,
    movedAt: -1,
```

5. In `stepScene`, right after the line `scene.steady = steady`, add:

```ts
  // A new grid starts a new window, so a jump never counts as a move.
  if (grid == null || scene.event === 'found') {
    scene.driftFrom = grid
    scene.driftFromAt = t
    scene.drift = 0
  } else if (scene.driftFrom != null && t - scene.driftFromAt >= DRIFT_WINDOW) {
    scene.drift = largestCornerStep(grid, scene.driftFrom) / (t - scene.driftFromAt)
    scene.driftFrom = grid
    scene.driftFromAt = t
  }
  const moving = scene.drift > DRIFT_LIMIT
  if (moving) scene.movedAt = t
```

6. In the `if (scene.lockedAt < 0)` block, replace the comment, `since` and `ready` lines:

```ts
    // foundAt also moves on a jump, so a switch to another grid starts the dwell again.
    const since = Math.max(scene.steadyAt, scene.foundAt, scene.startedAt + WARMUP, scene.bigSince)
    const ready = scene.armed && steady && scene.bigSince >= 0
```

with:

```ts
    // foundAt also moves on a jump, so a switch to another grid starts the dwell again. movedAt does the same after a pan.
    const since = Math.max(scene.foundAt, scene.movedAt, scene.startedAt + WARMUP, scene.bigSince)
    const ready = scene.armed && !moving && scene.bigSince >= 0
```

7. In `LockReport`, add after `speed: number`:

```ts
  drift: number
  moving: boolean
```

In the doc comment of `LockReport`, change `speed: points per second.` to `speed, drift: points per second.`

8. In `lockReport`, add after `speed: scene.speed,`:

```ts
    drift: scene.drift,
    moving: scene.drift > DRIFT_LIMIT,
```

9. In `formatLockReport`, change the second line of the template to:

```ts
    `steady ${yesNo(report.steady)} (motion ${report.motion.toFixed(2)}, speed ${report.speed.toFixed(1)} pt/s), ` +
    `drift ${report.drift.toFixed(1)} pt/s moving ${yesNo(report.moving)}, ` +
```

- [ ] **Step 5: Update the tests that described the old rule**

These tests in `describe('lock-on', …)` describe the dwell from the steady time. Replace them:

```ts
  it('grows the progress from the time the grid is found', () => {
    const scene = run(warm(), gridAt(50, 300), AFTER, AFTER + 0.5)
    expect(scene.lockProgress).toBeCloseTo((scene.t - AFTER) / LOCK_DWELL, 6)
    expect(scene.lockProgress).toBeGreaterThan(0)
    expect(scene.lockedAt).toBe(-1)
  })

  it('locks on LOCK_DWELL after the grid is found', () => {
    const scene = run(warm(), gridAt(50, 300), AFTER, AFTER + 3)
    expect(scene.lockProgress).toBe(1)
    expect(Math.abs(scene.lockedAt - (AFTER + LOCK_DWELL))).toBeLessThanOrEqual(FRAME)
  })
```

Change the comment above `const AFTER` to: `// The grid comes into view after the warm-up, so the dwell counts from the found time.`

In the `formats one line with every rule` test of `describe('lockReport', …)`, add `drift: 12.34, moving: false,` after `speed: 18.56,`. Change the expected line to:

```ts
      'grid yes, armed yes, steady no (motion 0.62, speed 18.6 pt/s), drift 12.3 pt/s moving no, width 0.75 big yes, warm yes, progress 0.00, locked no',
```

Run the whole file. Another test may assert a time that came from `steadyAt`. A still test grid becomes steady about 0.15 s after it is found. If such a test fails, change only its expected time to the found time. Do not change a test of the warm-up, the size rule, the hysteresis or the armed rule in any other way. List every test you changed in the report, with the reason.

- [ ] **Step 6: Run the tests to verify they pass**

Run from `apps/mobile/`: `pnpm exec jest src/scan/effects`
Expected: PASS. This includes `EffectCanvas.test.tsx`. Its lock log regex reads only the start of the line.

- [ ] **Step 7: Run the checks**

Run from the repository root: `just lint`, then `just typecheck`, then `just test-ts`.
Expected: all pass. Do not commit.

---

### Task 2: ADR-019, the decision index, the concept and the glossary

**Files:**
- Create: `docs/architecture/adr/adr-019-lock-on-tracked-grid.md`
- Modify: `docs/architecture/00-DECISIONS.md`
- Modify: `docs/architecture/09-architecture-decisions.md`
- Modify: `docs/architecture/00-concepts/scan-pipeline.md` (the Lock-on row of the stages table, and the Open questions table)
- Modify: `docs/architecture/12-glossary.md`

**Interfaces:**
- Consumes: the constant names and values of Task 1: `DRIFT_WINDOW` = 0.3 s, `DRIFT_LIMIT` = 100 pt/s, `LOCK_DWELL` = 1.0 s.
- Produces: nothing that code uses.

- [ ] **Step 1: Write ADR-019**

Read `docs/architecture/adr/adr-017-card-motion-sensor.md` for the format. Create `adr-019-lock-on-tracked-grid.md` with this content:

```markdown
---
status: DRAFT
---

# ADR-019: Lock-on on a tracked grid, not on a still phone

| Field   | Value      |
| ------- | ---------- |
| Project | Sudoku     |
| Status  | Proposed   |
| Date    | 2026-10-12 |
| Contact | Felix      |

Supersedes the lock-on condition of ADR-004 ("lock on when steady"). The other points of ADR-004 stay.

## Context

ADR-004 locks on when the grid is steady. Steady reads a speed from one detection step. On the
iPhone, a hand-held phone over a still page gave a median of 28.8 pt/s and a 90th percentile
of 97 pt/s. Steady needs about 15 pt/s. Steady was true in 16 % of the frames, and the scan never
locked on. Each person holds a phone in a different way, and nobody holds it still. The scan
already tracks one grid across frames: only a jump of a quarter of the diagonal is another grid.

## Alternatives Evaluated

| Option | For | Against |
| --- | --- | --- |
| Drift over a window: the net corner move over `DRIFT_WINDOW` | Noise and tremor cancel, a pan stays. One measure for every hand | Two new constants to tune |
| A higher `STEADY_SPEED` | The smallest change | The spikes stay. One spike still starts the dwell again |
| A grace time for short drops of steady | Keeps the measure | The speed stays noisy. One more constant |

## Decision

The scan locks on when the same grid stays in view for `LOCK_DWELL`, and the phone does not
clearly move.

- The **drift** is the largest net corner move over `DRIFT_WINDOW` = 0.3 s, in points per second.
- A drift above `DRIFT_LIMIT` = 100 pt/s is a clear move. It starts the dwell again.
- The intent rules of the scan-pipeline concept stay: armed, the warm-up and the minimum grid size.
- `motion` and steady stay. They drive the overlay only.

## Consequences

- A hand-held phone locks on after the warm-up and the dwell.
- A pan over the page does not lock on until the pan stops.
- The photo can have more motion blur than before. The burst of issue #73 picks the sharpest photo.

## Reassessment Triggers

- Scans after lock-on show motion blur that the burst does not fix.
- The scan locks on during a pan, or before the player means it.
- The device run gives a `DRIFT_LIMIT` far from 100 pt/s.
```

- [ ] **Step 2: `00-DECISIONS.md`**

Add a row for ADR-019 directly below the ADR-017 row, in the same table, with the same columns as that row:

```markdown
| ADR-019 | Lock-on needs the same grid in view for LOCK_DWELL and no clear move (drift over 0.3 s), not a still phone. Supersedes the lock-on condition of ADR-004. | Concept | 2026-10-12 | Felix | [ADR-019](adr/adr-019-lock-on-tracked-grid.md) |
```

Do not change the ADR-004 row. Issue #73 changes it.

- [ ] **Step 3: `09-architecture-decisions.md`**

Add a row directly below the ADR-017 row:

```markdown
| ADR-019 | Lock-on on a tracked grid: the same grid for LOCK_DWELL and a drift below DRIFT_LIMIT, not a still phone. Supersedes the lock-on condition of ADR-004 | Proposed | 2026-10-12 | [ADR-019](./adr/adr-019-lock-on-tracked-grid.md) |
```

If an ADR-018 row exists by then, put the ADR-019 row below it.

- [ ] **Step 4: The scan-pipeline concept**

In `docs/architecture/00-concepts/scan-pipeline.md`, in the Lock-on row of the stages table, replace these two sentences:

`Automatic: the grid stays steady for `LOCK_DWELL` = 1.0 s. Steady means `motion < STEADY_MOTION`, with `STEADY_SPEED` = 30 pt/s.`

with:

`Automatic: the same grid stays in view for `LOCK_DWELL` = 1.0 s, and the phone does not clearly move (ADR-019). A clear move is a drift above `DRIFT_LIMIT` = 100 pt/s. The drift is the largest net corner move over `DRIFT_WINDOW` = 0.3 s. Noise and tremor cancel over the window, a pan does not.`

In the same row, replace `The dwell counts from the latest of the steady time, the found time,` with `The dwell counts from the latest of the found time, the last clear move,`. Replace `Steady values passed the test on the iPhone without tuning (ADR-002). The other values are as built, to tune on the device.` with `The steady values drive the overlay only. A hand-held iPhone gave a median step speed of 28.8 pt/s, so steady failed as a lock-on rule (issue #72). The other values are as built, to tune on the device.`

In the Open questions table, replace the row that starts with `| Lock-on rule: final values of` with:

```markdown
| Lock-on rule: final values of `LOCK_DWELL`, `DRIFT_WINDOW` and `DRIFT_LIMIT` | The developer, on the device. Issue #6 decided steady at 30 pt/s and 0.5, and issue #19 raised `LOCK_DWELL` to 1.0 s. Issue #72 replaced steady with the drift (ADR-019) |
```

- [ ] **Step 5: The glossary**

In `docs/architecture/12-glossary.md`:

1. Change the Lock-on definition to: `The moment the same grid has been in view long enough without a clear move, and the scan captures`
2. Change the Steady state definition to: `The grid corners move slower than the steady threshold. The overlay shows it. Lock-on does not read it (ADR-019)`
3. Change the Lock-on progress definition to: `0 to 1: how long the grid has been in view without a clear move, divided by `LOCK_DWELL`. It resets when the grid is lost, found again, jumps or clearly moves. At 1 the scan locks on. The gathered dots show it`
4. Add a row for **Drift** in alphabetical order, in the same table format: `The largest net move of a grid corner over `DRIFT_WINDOW`, in points per second. Noise and tremor cancel over the window. A drift above `DRIFT_LIMIT` is a clear move, such as a pan`

- [ ] **Step 6: Check the links and the checks**

Check that every relative link you added resolves: `ls docs/architecture/adr/adr-019-lock-on-tracked-grid.md`. Run `just lint`, `just typecheck` and `just test-ts` from the repository root. All pass. Do not commit.

---

### Task 3: The device run (the developer)

Not a subagent task. Ask the developer before Metro restarts or a build goes to the iPhone.

- [ ] **Step 1:** Reload the app. A JS change needs no new native build.
- [ ] **Step 2:** The developer holds the phone over a printed sudoku. The correction screen must open without the shutter.
- [ ] **Step 3:** The developer pans over the page. It must not lock on during the pan.
- [ ] **Step 4:** The developer taps Retake with the same sudoku in view. It must not lock on until the grid leaves the view. The first second after the camera opens must not lock on.
- [ ] **Step 5:** Read the `drift` values in the `[lock]` lines for the hand-held hold and for the pan. If `DRIFT_LIMIT` = 100 does not separate them, propose a new value with the numbers.
- [ ] **Step 6:** Record the result in issue #72. Tick criteria 3 to 6 when the developer agrees. ADR-019 becomes Accepted, in `00-DECISIONS.md` and `09-architecture-decisions.md` too.
