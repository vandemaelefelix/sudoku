# Lock-on Diagnostic Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A development build logs the lock-on conditions four times per second, so an iPhone run names the rule that blocks auto lock-on (issue #72).

**Architecture:** `scene.ts` gets a pure worklet `lockReport(scene)` that reads the lock-on rules from the scene, and a plain `formatLockReport(report)` that makes one log line. `EffectCanvas` sends the report to the JS thread every `LOCK_LOG_INTERVAL` seconds in the live phase, in a development build only. The JS thread formats and logs it with `devLog('lock', …)`. `EffectCanvas` also logs when the scene locks on but `frameQuad` is null, because then `onLock` is never called. That gate is outside `scene.ts`.

**Tech Stack:** Expo (React Native), Reanimated `useFrameCallback`, `react-native-worklets` `scheduleOnRN`, Jest.

**Spec:** GitHub issue #72, acceptance criterion 1. The rules come from the lock-on row of `docs/architecture/00-concepts/scan-pipeline.md`.

## Global Constraints

- The log runs only when `__DEV__` is true. A release build sends nothing to the JS thread for it.
- Nothing leaves the device (SUD-02). The log goes to the Metro console only.
- This plan changes no lock-on rule and no constant in `scene.constants.ts`. The fix comes after the device run, in a new plan.
- Imports use `@/` or `./` for a sibling file. No `../`. A constants file imports only constants and types.
- Put a helper above the worklet that uses it (apps/mobile/AGENTS.md, Worklets).
- Comments follow AGENTS.md: the reason, not the action. No TODO. No issue numbers in code comments.
- Do not commit or push. The developer asks for commits.
- Before you say a task is done, run `just lint`, `just typecheck` and `just test-ts` from the repository root. All three must pass.

## Review Focus

1. No grid in view: the report must say `grid no` and a width of 0, not divide by a null quad. Pinned in Task 1.
2. A scene that is not armed (after a Retake): the report must say `armed no`, even when every other rule passes. Pinned in Task 1.
3. The warm-up: in the first `WARMUP` seconds the report says `warm no`, and progress is 0. Pinned in Task 1.
4. The capture phase: no lock log while `capture` is set, so the log does not hide the transition timing. Pinned in Task 2.
5. Lock-on with a null `frameQuad`: the log must say so, because `onLock` then silently does nothing. Pinned in Task 2.

---

### Task 1: `lockReport` and `formatLockReport` in `scene.ts`

**Files:**
- Modify: `apps/mobile/src/scan/effects/scene.ts` (add after `stepScene`, at the end of the file)
- Test: `apps/mobile/src/scan/effects/scene.test.ts` (add a new `describe` block at the end)

**Interfaces:**
- Consumes: `Scene`, `gridWidth(quad)` (already in `scene.ts`, not exported), `WARMUP` from `./scene.constants`.
- Produces:
  ```ts
  export type LockReport = {
    grid: boolean
    armed: boolean
    steady: boolean
    motion: number
    speed: number
    width: number
    big: boolean
    warm: boolean
    progress: number
    locked: boolean
  }
  export function lockReport(scene: Scene): LockReport // worklet
  export function formatLockReport(report: LockReport): string // JS thread
  ```

- [ ] **Step 1: Write the failing tests**

Add `lockReport` and `formatLockReport` to the import from `./scene` at the top of `scene.test.ts`:

```ts
import { createScene, formatLockReport, lockReport, type Scene, stepScene } from './scene'
```

Add this block at the end of `scene.test.ts`. It reuses `VIEW`, `gridAt` and `run`, which the file already has.

```ts
describe('lockReport', () => {
  it('reports no grid and a width of 0 when no grid is in view', () => {
    const report = lockReport(run(createScene(VIEW), null, 0, 2))
    expect(report.grid).toBe(false)
    expect(report.width).toBe(0)
    expect(report.big).toBe(false)
    expect(report.steady).toBe(false)
    expect(report.progress).toBe(0)
  })

  it('reports not warm in the warm-up', () => {
    const report = lockReport(run(createScene(VIEW), gridAt(50, 300), 0, WARMUP / 2))
    expect(report.grid).toBe(true)
    expect(report.warm).toBe(false)
    expect(report.progress).toBe(0)
  })

  it('reports every rule as passed for a steady big grid after the warm-up', () => {
    const report = lockReport(run(createScene(VIEW), gridAt(50, 300), 0, WARMUP + LOCK_DWELL / 2))
    expect(report).toMatchObject({ grid: true, armed: true, steady: true, big: true, warm: true, locked: false })
    expect(report.width).toBeCloseTo(300 / VIEW.width)
    expect(report.motion).toBeLessThan(0.5)
    expect(report.progress).toBeGreaterThan(0)
    expect(report.progress).toBeLessThan(1)
  })

  it('reports not armed for a scene after a Retake', () => {
    const report = lockReport(run(createScene(VIEW, false), gridAt(50, 300), 0, WARMUP + LOCK_DWELL * 2))
    expect(report.armed).toBe(false)
    expect(report.steady).toBe(true)
    expect(report.progress).toBe(0)
  })

  it('reports locked after the dwell', () => {
    const report = lockReport(run(createScene(VIEW), gridAt(50, 300), 0, WARMUP + LOCK_DWELL + 0.1))
    expect(report.locked).toBe(true)
    expect(report.progress).toBe(1)
  })

  it('formats one line with every rule', () => {
    const line = formatLockReport({
      grid: true,
      armed: true,
      steady: false,
      motion: 0.618,
      speed: 18.56,
      width: 0.7462,
      big: true,
      warm: true,
      progress: 0,
      locked: false,
    })
    expect(line).toBe(
      'grid yes, armed yes, steady no (motion 0.62, speed 18.6 pt/s), width 0.75 big yes, warm yes, progress 0.00, locked no',
    )
  })
})
```


- [ ] **Step 2: Run the tests to verify they fail**

Run from `apps/mobile/`: `pnpm exec jest src/scan/effects/scene.test.ts -t lockReport`
Expected: FAIL, because `lockReport` and `formatLockReport` are not exported from `./scene`.

- [ ] **Step 3: Write the implementation**

Append to the end of `scene.ts`:

```ts
/** The lock-on rules of this frame. width: the grid width as a share of the view width, 0 without a grid. motion, progress: 0..1. speed: points per second. */
export type LockReport = {
  grid: boolean
  armed: boolean
  steady: boolean
  motion: number
  speed: number
  width: number
  big: boolean
  warm: boolean
  progress: number
  locked: boolean
}

export function lockReport(scene: Scene): LockReport {
  'worklet'
  return {
    grid: scene.quad != null,
    armed: scene.armed,
    steady: scene.steady,
    motion: scene.motion,
    speed: scene.speed,
    width: scene.quad == null || scene.width <= 0 ? 0 : gridWidth(scene.quad) / scene.width,
    big: scene.bigSince >= 0,
    warm: scene.startedAt >= 0 && scene.t - scene.startedAt >= WARMUP,
    progress: scene.lockProgress,
    locked: scene.lockedAt >= 0,
  }
}

function yesNo(value: boolean): string {
  return value ? 'yes' : 'no'
}

export function formatLockReport(report: LockReport): string {
  return (
    `grid ${yesNo(report.grid)}, armed ${yesNo(report.armed)}, ` +
    `steady ${yesNo(report.steady)} (motion ${report.motion.toFixed(2)}, speed ${report.speed.toFixed(1)} pt/s), ` +
    `width ${report.width.toFixed(2)} big ${yesNo(report.big)}, warm ${yesNo(report.warm)}, ` +
    `progress ${report.progress.toFixed(2)}, locked ${yesNo(report.locked)}`
  )
}
```

`gridWidth` is declared above `stepScene`, so it is above `lockReport` too. `WARMUP` is already imported.

- [ ] **Step 4: Run the tests to verify they pass**

Run from `apps/mobile/`: `pnpm exec jest src/scan/effects/scene.test.ts`
Expected: PASS, the old tests and the six new ones.

- [ ] **Step 5: Run the checks**

Run from the repository root: `just lint`, then `just typecheck`, then `just test-ts`.
Expected: all pass. Do not commit.

---

### Task 2: The throttled lock log in `EffectCanvas`

**Files:**
- Create: `apps/mobile/src/scan/effects/components/EffectCanvas/EffectCanvas.constants.ts`
- Modify: `apps/mobile/src/scan/effects/components/EffectCanvas/EffectCanvas.tsx`
- Test: `apps/mobile/src/scan/effects/components/EffectCanvas/EffectCanvas.test.tsx`

**Interfaces:**
- Consumes: `lockReport(scene: Scene): LockReport` (worklet), `formatLockReport(report: LockReport): string` and `type LockReport`, all from `@/scan/effects/scene` (Task 1). `devLog(tag, message)` from `@/utils/log.utils`.
- Produces: the console lines `[lock] <formatLockReport line>` and `[lock] locked, but frameQuad is null: onLock not called`. Nothing else uses them.

- [ ] **Step 1: Write the failing tests**

Add this block to `EffectCanvas.test.tsx`, right after the `describe('lock-on', …)` block. It uses the helpers `fresh`, `constant`, `grid`, `VIEW`, `frameCallback` and `render` that the file already has.

```ts
describe('the lock log', () => {
  const lockLines = (log: jest.SpyInstance) =>
    log.mock.calls.map((call) => String(call[0])).filter((line) => line.startsWith('[lock] '))

  it('logs the lock-on rules four times per second in the live phase', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    render(
      <EffectCanvas
        outline={fresh(grid)}
        view={constant(VIEW)}
        effect={constant(DEFAULT_INDEX)}
        frameQuad={constant<Quad | null>(null)}
        onLock={jest.fn()}
        armed={false}
      />,
    )
    const callback = frameCallback.mock.calls.at(-1)![0]
    for (let ms = 0; ms < 2000; ms += 1000 / 60) callback({ timestamp: ms } as never)
    await new Promise((resolve) => setImmediate(resolve))
    const lines = lockLines(log)
    expect(lines.length).toBeGreaterThanOrEqual(7)
    expect(lines.length).toBeLessThanOrEqual(9)
    expect(lines.at(-1)).toMatch(/^\[lock\] grid yes, armed no, steady (yes|no) \(motion \d\.\d\d, speed \d+\.\d pt\/s\)/)
    log.mockRestore()
  })

  it('logs that onLock is not called when the scene locks on without a frame quad', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    const onLock = jest.fn()
    render(
      <EffectCanvas
        outline={fresh(grid)}
        view={constant(VIEW)}
        effect={constant(DEFAULT_INDEX)}
        frameQuad={constant<Quad | null>(null)}
        onLock={onLock}
      />,
    )
    const callback = frameCallback.mock.calls.at(-1)![0]
    for (let ms = 0; ms <= 3000; ms += 1000 / 60) callback({ timestamp: ms } as never)
    await new Promise((resolve) => setImmediate(resolve))
    expect(onLock).not.toHaveBeenCalled()
    expect(lockLines(log)).toContain('[lock] locked, but frameQuad is null: onLock not called')
    log.mockRestore()
  })

  it('does not log the lock-on rules in the capture phase', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    const capture = { value: null as CaptureFrame | null, get: () => capture.value }
    render(
      <EffectCanvas
        outline={fresh(grid)}
        view={constant(VIEW)}
        effect={constant(DEFAULT_INDEX)}
        frameQuad={constant<Quad | null>(null)}
        onLock={jest.fn()}
        capture={capture as unknown as SharedValue<CaptureFrame | null>}
      />,
    )
    const callback = frameCallback.mock.calls.at(-1)![0]
    callback({ timestamp: 0 } as never)
    capture.value = { quad: grid, channels: transitionAt(0), crossFade: false } as CaptureFrame
    log.mockClear()
    for (let ms = 1000 / 60; ms < 2000; ms += 1000 / 60) callback({ timestamp: ms } as never)
    await new Promise((resolve) => setImmediate(resolve))
    expect(lockLines(log)).toEqual([])
    log.mockRestore()
  })
})
```

Before you write the third test, read `describe('the capture phase', …)` in the same file. Build the `CaptureFrame` value the same way those tests do. If `transitionAt` has another signature, use the form those tests use.

- [ ] **Step 2: Run the tests to verify they fail**

Run from `apps/mobile/`: `pnpm exec jest src/scan/effects/components/EffectCanvas -t "the lock log"`
Expected: the first two tests FAIL (no `[lock]` lines). The third test may pass already. That is fine: it guards the capture phase.

- [ ] **Step 3: Write the constant**

Create `EffectCanvas.constants.ts`:

```ts
/** Seconds between two lock-on logs in a development build. Four lines per second are enough to read the rules during a device run. */
export const LOCK_LOG_INTERVAL = 0.25
```

- [ ] **Step 4: Write the implementation**

In `EffectCanvas.tsx`:

1. Add the imports:

```ts
import { formatLockReport, type LockReport, lockReport } from '@/scan/effects/scene'
import { LOCK_LOG_INTERVAL } from './EffectCanvas.constants'
```

2. Add two JS-thread helpers next to `logOverlay`, above the component:

```ts
function logLock(report: LockReport) {
  devLog('lock', formatLockReport(report))
}

function logLockWithoutQuad() {
  devLog('lock', 'locked, but frameQuad is null: onLock not called')
}
```

3. Add a shared value next to `timing`:

```ts
  const lockLoggedAt = useSharedValue(-1)
```

4. Replace the lock-on block in the frame callback:

```ts
    // lockedAt equals t only in the frame of lock-on, so the quad crosses to the JS thread once.
    if (captured == null && now.scene.lockedAt === t) {
      const locked = frameQuad.get()
      if (locked != null) scheduleOnRN(onLock, locked)
    }
```

with:

```ts
    // lockedAt equals t only in the frame of lock-on, so the quad crosses to the JS thread once.
    if (captured == null && now.scene.lockedAt === t) {
      const locked = frameQuad.get()
      if (locked != null) scheduleOnRN(onLock, locked)
      else if (__DEV__) scheduleOnRN(logLockWithoutQuad)
    }
    // A new scene starts its clock again, so a time before the last log also logs.
    if (__DEV__ && captured == null) {
      const last = lockLoggedAt.get()
      if (last < 0 || t < last || t - last >= LOCK_LOG_INTERVAL) {
        lockLoggedAt.set(t)
        scheduleOnRN(logLock, lockReport(now.scene))
      }
    }
```

The report is a small plain object, so `scheduleOnRN` copies it to the JS thread. The JS thread formats the string, so the UI thread does no string work.

- [ ] **Step 5: Run the tests to verify they pass**

Run from `apps/mobile/`: `pnpm exec jest src/scan/effects/components/EffectCanvas`
Expected: PASS, the old tests and the three new ones. If an old test counts `console.log` calls, check that it filters by tag. If it does not, filter it by its own tag. Do not change what it asserts.

- [ ] **Step 6: Run the checks**

Run from the repository root: `just lint`, then `just typecheck`, then `just test-ts`.
Expected: all pass. Do not commit.

---

### Task 3: The device run (the developer)

Not a subagent task. Metro on port 8081 may belong to another worktree.

- [ ] **Step 1:** Ask the developer before Metro starts or a build goes to the iPhone.
- [ ] **Step 2:** The developer opens the scanner and holds the phone still over a printed sudoku for 5 s.
- [ ] **Step 3:** Read the `[lock]` lines. Name the rule that stays `no`, or the `frameQuad is null` line, or a progress that never reaches 1.
- [ ] **Step 4:** Record the result in issue #72 and tick acceptance criteria 1 and 2.
- [ ] **Step 5:** Write the fix plan from the evidence: a Jest test that fails first, then the fix (systematic-debugging, Phase 4).
