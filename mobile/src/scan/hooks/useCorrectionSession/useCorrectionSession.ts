import { useEffect, useMemo, useRef, useState } from 'react'
import { useAnimatedReaction } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import type { Digit, Level } from '@sudoku/core'
import type { Pulse } from '@/game/hooks/usePulse'
import { levelOf } from '@/game/utils/start.utils'
import type { SaveState } from '@/scan/components/DevMenu'
import { REVIEW_CONFIDENCE } from '@/scan/constants/correction.constants'
import type { CaptureSession } from '@/scan/hooks/useCaptureSession'
import { useCorrectionEdits, type CorrectionEditActions } from '@/scan/hooks/useCorrectionEdits'
import { useSolvedPulse } from '@/scan/hooks/useSolvedPulse'
import { useVerify } from '@/scan/hooks/useVerify'
import type { CellLook } from '@/scan/utils/correction.utils'
import { isFull, markedCells, panelState, type PanelState } from '@/scan/utils/correctionSession.utils'
import { finalGrid } from '@/scan/utils/finalGrid.utils'
import { checkPlay, type PlayBlock, type ScannedStart } from '@/scan/utils/play.utils'
import { resultsGateReached } from '@/scan/utils/transition.utils'
import { useHaptics } from '@/settings/hooks/useHaptics'
import type { FinalGrid } from '@/utils/finalGrid.utils'

/**
 * What the correction session hands to the rest of the app. Each one is optional except onRetake.
 * onPlay: without it, Play stays off. onSave: development builds. onHome: the solved panel shows a Home button.
 * onExit: gets the final grid when the screen unmounts after the player could edit it, by any route except retake. The scan is final.
 */
export type CorrectionExits = {
  onRetake(): void
  onPlay?: ((start: ScannedStart) => void) | undefined
  onSave?: ((grid: FinalGrid) => Promise<boolean>) | undefined
  onExit?: ((grid: FinalGrid) => void) | undefined
  onHome?: (() => void) | undefined
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
  scanAnother(): void
  save(): void
}

/**
 * The view of the correction session: what the screen renders. The session is one state machine over the capture session, the edits
 * of the player and the checks of the grid. The screen sends intents through `actions`.
 *
 * editable: the player can edit. It is false during the capture transition, and for a failed or missing result.
 * panel: null until the result arrives. open and openLook: the cell in the panel. picking: its keypad.
 * conflictCells: the cells to mark, which are the given conflicts and the cells of the verdict. hints: the solution digit of each
 * wrong entry, after Check.
 * block: why Play is off, or null. canPlay: the gate is open and the parent gave onPlay. canSolve: the gate is open.
 * solution: the solution digits while Solve shows them, until the next edit.
 * fullGrid: set when no cell is empty. phase ready: the player has not tapped Check.
 * celebrated: the solved pulse runs. It starts once the open cell closes, and it stays until the verdict changes.
 */
export type CorrectionSession = {
  editable: boolean
  panel: PanelState | null
  looks: readonly CellLook[]
  open: number | null
  openLook: CellLook | undefined
  picking: boolean
  flow: readonly number[]
  toCheck: number
  conflictCount: number
  conflictCells: ReadonlySet<number>
  hints: Readonly<Record<number, number>>
  level: Level
  block: PlayBlock | null
  canPlay: boolean
  canSolve: boolean
  solution: readonly number[] | null
  fullGrid: { phase: 'ready' | 'wrong' | 'clash' | 'solved'; count: number } | null
  solved: boolean
  celebrated: boolean
  pulse: Pulse
  threshold: number
  setThreshold(threshold: number): void
  saveState: SaveState
  canSave: boolean
  actions: CorrectionActions
}

const NO_HINTS: Readonly<Record<number, number>> = {}

/**
 * The correction session: the edits, the given conflicts, the play gate, the verdict, the celebration, the panel state and the haptic
 * cues of the correction screen (scan-pipeline concept, "The correction session"). It reads the capture session for the phase and the
 * result. The ring threshold of the dev menu is not saved: a new scan starts at REVIEW_CONFIDENCE.
 */
export function useCorrectionSession(
  capture: Pick<CaptureSession, 'phase' | 'result' | 'crossFade' | 'clock' | 'resultsAt'>,
  exits: CorrectionExits,
): CorrectionSession {
  const { result } = capture
  // The transition clock exists until the review. In the review, every layer shows and nothing waits.
  const transition = capture.phase === 'review' ? null : capture
  const clock = transition?.clock
  const resultsAt = transition?.resultsAt
  const reduceMotion = transition?.crossFade ?? false
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
  const level = useMemo(() => levelOf(grid.givens), [grid])

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

  const solvedBefore = useRef(false)
  useEffect(() => {
    if (celebrated && !solvedBefore.current) play('success')
    solvedBefore.current = celebrated
  }, [celebrated, play])
  // Success when the last check makes the puzzle playable. The first summary of a review only sets the state: a scan that needs no
  // check already had its success haptic. While a cell is open, the summary has no check, so the state waits.
  const readyBefore = useRef<boolean | null>(null)
  const ready = start !== null
  useEffect(() => {
    if (!editable || selected !== null) return
    if (readyBefore.current === false && ready) play('success')
    readyBefore.current = ready
  }, [editable, selected, ready, play])
  // A recognised grid gets its success when the results gate opens: the digits start to sweep in at that moment.
  // A boolean, not ok: a worklet copies what it captures to the UI thread, and the result holds images.
  const recognised = ok !== null
  useAnimatedReaction(
    () => recognised && resultsAt != null && resultsAt.value >= 0,
    (gateOpen, previous) => {
      if (gateOpen && previous === false) scheduleOnRN(play, 'success')
    },
  )
  // A failure keeps the results gate closed. Its warning plays when the failure panel starts to slide in.
  useAnimatedReaction(
    () => failed && resultsGateReached(clock?.value, reduceMotion),
    (go, previous) => {
      if (go && go !== previous) scheduleOnRN(play, 'warning')
    },
  )

  // The solution shows until the next edit: it belongs to the looks it was shown for.
  const [solutionFor, setSolutionFor] = useState<readonly CellLook[] | null>(null)
  const solution = start !== null && solutionFor === looks ? start.solution : null

  // A new edit makes the saved copy old, so Save works again: the status counts only for the looks that it was made for.
  const [saving, setSaving] = useState<{ looks: readonly CellLook[]; status: Exclude<SaveState, 'idle'> } | null>(null)
  const saveState: SaveState = saving !== null && saving.looks === looks ? saving.status : 'idle'
  const canSave = exits.onSave !== undefined && ok?.photoPath != null

  // The unmount reads the latest values, because the effect that listens for it runs once.
  const latest = useRef({ ok, looks, editable, onExit: exits.onExit })
  useEffect(() => {
    latest.current = { ok, looks, editable, onExit: exits.onExit }
  })
  const retaking = useRef(false)
  useEffect(
    () => () => {
      const { ok: last, looks: finalLooks, editable: could, onExit } = latest.current
      if (could && !retaking.current && last !== null) onExit?.(finalGrid(last.cells, finalLooks))
    },
    [],
  )

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
      retaking.current = true
      exits.onRetake()
    },
    scanAnother: () => exits.onRetake(),
    save: () => {
      if (exits.onSave === undefined || ok === null || saveState === 'saving') return
      const final = finalGrid(ok.cells, looks)
      setSaving({ looks, status: 'saving' })
      void exits.onSave(final).then((saved) => setSaving({ looks, status: saved ? 'saved' : 'failed' }))
    },
  }

  return {
    editable,
    panel: result == null ? null : panelState(failed, open, picking),
    looks,
    open,
    openLook: open === null ? undefined : looks[open],
    picking,
    flow,
    toCheck,
    conflictCount: editable ? conflicts.filter(Boolean).length : 0,
    conflictCells,
    hints,
    level,
    block,
    canPlay,
    canSolve: start !== null,
    solution,
    fullGrid: full ? { phase: verdict === null ? 'ready' : verdict.status, count: marked.size } : null,
    solved,
    celebrated,
    pulse,
    threshold,
    setThreshold,
    saveState,
    canSave,
    actions,
  }
}
