import type { SkImage } from '@shopify/react-native-skia'
import { useMemo, useState } from 'react'
import type { SharedValue } from 'react-native-reanimated'
import type { Digit, Level } from '@sudoku/core'
import type { Pulse } from '@/hooks/usePulse'
import { scannedLevel } from '@/game/utils/start.utils'
import type { SaveState } from '@/scan/components/DevMenu'
import { REVIEW_CONFIDENCE } from '@/scan/constants/correction.constants'
import type { CaptureSession } from '@/scan/hooks/useCaptureSession'
import { useCorrectionCues } from '@/scan/hooks/useCorrectionCues'
import { useCorrectionEdits, type CorrectionEditActions } from '@/scan/hooks/useCorrectionEdits'
import { useExitReport } from '@/scan/hooks/useExitReport'
import { useSaveState } from '@/scan/hooks/useSaveState'
import { useSolvedPulse } from '@/scan/hooks/useSolvedPulse'
import { useVerify } from '@/scan/hooks/useVerify'
import type { CaptureOk } from '@/scan/utils/captureResult.utils'
import type { CellLook } from '@/scan/utils/correction.utils'
import { isFull, markedCells, panelState, type PanelState } from '@/scan/utils/correctionSession.utils'
import { checkPlay, type PlayBlock, type ScannedStart } from '@/scan/utils/play.utils'
import type { SweepTiming } from '@/scan/utils/transition.utils'
import { useHaptics } from '@/preferences/hooks/useHaptics'
import type { FinalGrid } from '@/utils/finalGrid.utils'

/**
 * What the correction session hands to the rest of the app. Each one is optional except onRetake.
 * onPlay: without it, Play stays off. onSave: development builds. onHome: the solved panel shows a Home button.
 * onExit: gets the final grid when the screen unmounts after the player could edit it, by any route except retake. The scan is final.
 * onChooseImage: the failure panel of an import without a grid offers another image. Like retake, the scan is not final.
 * onScanAnother: a new scan after the player accepted this one. The parent must keep the photo: onExit reads it when the screen
 * unmounts. Without it, Scan another calls onRetake.
 */
export type CorrectionExits = {
  onRetake(): void
  onPlay?: ((start: ScannedStart) => void) | undefined
  onSave?: ((grid: FinalGrid) => Promise<boolean>) | undefined
  onExit?: ((grid: FinalGrid) => void) | undefined
  onHome?: (() => void) | undefined
  onChooseImage?: (() => void) | undefined
  onScanAnother?: (() => void) | undefined
}

/**
 * The intents of the player. The haptic of each intent plays inside it.
 * retake: the player did not accept the scan, so onExit does not run. scanAnother accepts the scan: onExit runs when the screen leaves.
 * play does nothing unless canPlay. save does nothing unless canSave.
 */
export type CorrectionActions = Omit<CorrectionEditActions, 'yes' | 'no' | 'setDigit' | 'clear'> & {
  yes(): void
  no(): void
  setDigit(digit: Digit): void
  clear(): void
  verify(): void
  toggleSolution(): void
  play(): void
  retake(): void
  chooseImage(): void
  scanAnother(): void
  save(): void
}

/**
 * What the play button, the solve button and the panel line of the summary read. block: why Play is off, or null.
 * canPlay: the gate is open and the parent gave onPlay. canSolve: the gate is open. level: the level of the grade, null while the
 * gate blocks the grid, because a grade needs one solution. solution: the solution digits while Solve shows them, until the next
 * edit.
 */
export type CorrectionPlay = {
  level: Level | null
  block: PlayBlock | null
  canPlay: boolean
  canSolve: boolean
  solution: readonly number[] | null
}

/**
 * What only the dev menu reads. scan: the ok result. threshold: the ring threshold, which is not saved. canSave: the parent gave
 * onSave and the scan kept its photo file.
 */
export type CorrectionDev = {
  scan: CaptureOk | null
  threshold: number
  setThreshold(threshold: number): void
  saveState: SaveState
  canSave: boolean
}

/**
 * The view of the correction session: what the screen renders. The session is one state machine over the capture session, the edits
 * of the player and the checks of the grid. The screen sends intents through `actions`.
 *
 * timing: what the cells, the rings and the panel follow. It keeps its identity while the clock, the results time and the flag stay.
 * waiting: the results gate held longer than SPINNER_DELAY. Both are undefined in the review: every layer shows and nothing waits.
 * editable: the player can edit. It is false during the capture transition, and for a failed or missing result.
 * panel: null until the result arrives. openCell: the cell in the panel. picking: its keypad. hint: the second guess of the scanner
 * for that cell.
 * failure: the reason of a failed scan. image: the flattened grid, for the cell crop.
 * conflictCells: the cells to mark, which are the given conflicts and the cells of the verdict. hints: the solution digit of each
 * wrong entry, after Check.
 * fullGrid: set when no cell is empty. phase ready: the player has not tapped Check.
 * celebrated: the solved pulse runs. It starts once the open cell closes, and it stays until the verdict changes.
 */
export type CorrectionSession = {
  timing: SweepTiming
  waiting: SharedValue<boolean> | undefined
  editable: boolean
  panel: PanelState | null
  looks: readonly CellLook[]
  openCell: { cell: number; look: CellLook } | null
  picking: boolean
  failure: string | null
  image: SkImage | undefined
  hint: number | null
  flow: readonly number[]
  toCheck: number
  conflictCount: number
  conflictCells: ReadonlySet<number>
  hints: Readonly<Record<number, number>>
  fullGrid: { phase: 'ready' | 'wrong' | 'clash' | 'solved'; count: number } | null
  solved: boolean
  celebrated: boolean
  pulse: Pulse
  play: CorrectionPlay
  dev: CorrectionDev
  actions: CorrectionActions
}

const NO_HINTS: Readonly<Record<number, number>> = {}

/**
 * The correction session: the edits, the given conflicts, the play gate, the verdict, the celebration, the panel state and the haptic
 * cues of the correction screen (scan-pipeline concept, "The correction session"). It reads the capture session for the phase and the
 * result. The ring threshold of the dev menu is not saved: a new scan starts at REVIEW_CONFIDENCE.
 */
export function useCorrectionSession(
  capture: Pick<CaptureSession, 'phase' | 'result' | 'crossFade' | 'clock' | 'resultsAt' | 'waiting'>,
  exits: CorrectionExits,
): CorrectionSession {
  const { result } = capture
  // The transition clock exists until the review. In the review, every layer shows and nothing waits.
  const transition = capture.phase === 'review' ? null : capture
  const clock = transition?.clock
  const resultsAt = transition?.resultsAt
  const waiting = transition?.waiting
  const crossFade = transition?.crossFade ?? false
  const timing = useMemo<SweepTiming>(() => ({ clock, resultsAt, crossFade }), [clock, resultsAt, crossFade])
  const failed = result != null && !result.ok
  const ok = result?.ok === true ? result : null
  const { play } = useHaptics()

  const [threshold, setThreshold] = useState(REVIEW_CONFIDENCE)
  const {
    looks,
    selected,
    picking,
    conflicts,
    toCheck,
    flow,
    grid,
    actions: edit,
  } = useCorrectionEdits(result, threshold)
  // The player edits only the finished screen. During the transition the cells are not pressable and show no edit marks.
  const editable = clock == null && ok !== null
  const open = editable && selected !== null ? selected : null

  // The solver runs when the panel shows the summary, never per key and never while the transition clock runs.
  const gate = useMemo(
    () => (editable && selected === null ? checkPlay(grid, conflicts) : null),
    [editable, selected, grid, conflicts],
  )
  const start = gate?.ok ? gate.start : null
  const block = gate !== null && !gate.ok ? gate.block : null
  const canPlay = start !== null && exits.onPlay !== undefined
  // The gate makes a new start each time a cell opens or closes. Keyed on the givens, the grade runs once per grid.
  const givensKey = start === null ? null : start.givens.join('')
  const level = useMemo(() => (givensKey === null ? null : scannedLevel(Array.from(givensKey, Number))), [givensKey])

  // The grid is full with or without a conflict. It does not depend on the open cell: the marks stay while the player fixes a wrong
  // cell in the check sheet.
  const full = editable && isFull(grid)
  const { verdict, verify } = useVerify(grid, full)
  const solved = verdict?.status === 'solved'
  const marked = useMemo(() => markedCells(verdict), [verdict])
  const conflictCells = useMemo<ReadonlySet<number>>(() => {
    if (!editable) return marked
    return new Set([...marked, ...conflicts.flatMap((conflict, cell) => (conflict ? [cell] : []))])
  }, [editable, marked, conflicts])
  const hints = verdict?.status === 'wrong' ? verdict.hints : NO_HINTS

  // The celebration (pulse and haptic) starts once the sheet is closed, so the player sees it. It then stays on until the verdict
  // changes: opening and closing a cell of a solved grid must not replay it.
  const [celebrated, setCelebrated] = useState(false)
  const celebrate = solved && (celebrated || open === null)
  if (celebrate !== celebrated) setCelebrated(celebrate)
  const pulse = useSolvedPulse(celebrated)

  useCorrectionCues({
    timing,
    recognised: ok !== null,
    failed,
    editable,
    selected,
    ready: start !== null,
    celebrated,
  })

  // The solution shows until the next edit: it belongs to the looks it was shown for.
  const [solutionFor, setSolutionFor] = useState<readonly CellLook[] | null>(null)
  const solution = start !== null && solutionFor === looks ? start.solution : null

  const { saveState, canSave, save } = useSaveState(ok, looks, exits.onSave)
  const { skip } = useExitReport({ ok, looks, editable, onExit: exits.onExit })

  const actions: CorrectionActions = {
    select: edit.select,
    startCheck: edit.startCheck,
    close: edit.close,
    setKind: edit.setKind,
    // The check answers tick, and a picked digit taps like a number key of the game.
    yes: () => {
      play('tick')
      edit.yes()
    },
    no: () => {
      play('tick')
      edit.no()
    },
    setDigit: (digit) => {
      play('tap')
      edit.setDigit(digit)
    },
    clear: () => {
      play('tap')
      edit.clear()
    },
    verify,
    toggleSolution: () => setSolutionFor(solution === null ? looks : null),
    play: () => {
      if (start === null || exits.onPlay === undefined) return
      play('thud')
      exits.onPlay(start)
    },
    // The mark comes before onRetake: the unmount that follows must not report the scan.
    retake: () => {
      skip()
      exits.onRetake()
    },
    chooseImage: () => {
      if (exits.onChooseImage === undefined) return
      skip()
      exits.onChooseImage()
    },
    // No Retake mark: the player accepted the scan, so the unmount that follows reports it.
    scanAnother: () => (exits.onScanAnother ?? exits.onRetake)(),
    save,
  }

  const openLook = open === null ? undefined : looks[open]
  return {
    timing,
    waiting,
    editable,
    panel: result == null ? null : panelState(failed, open, picking),
    looks,
    openCell: openLook === undefined || open === null ? null : { cell: open, look: openLook },
    picking,
    failure: result != null && !result.ok ? result.reason : null,
    image: ok?.flatImage,
    hint: open === null ? null : (ok?.cells[open]?.second ?? null),
    flow,
    toCheck,
    conflictCount: editable ? conflicts.filter(Boolean).length : 0,
    conflictCells,
    hints,
    fullGrid: full ? { phase: verdict === null ? 'ready' : verdict.status, count: marked.size } : null,
    solved,
    celebrated,
    pulse,
    play: { level, block, canPlay, canSolve: start !== null, solution },
    dev: { scan: ok, threshold, setThreshold, saveState, canSave },
    actions,
  }
}
