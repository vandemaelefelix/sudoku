import { planHint, type CellDigit, type Digit, type Game } from '@sudoku/core'
import { canErase, canUndo, reduceSession, startSession, type Session, type SessionAction } from './session.utils'
import { pointingStart, sampleStart, stuckStart } from './sample.utils'

// Cell 2 is empty in the canvas puzzle. Its solution is 4.
const OPEN = 2
const start = () => startSession(sampleStart())
const run = (session: Session, ...actions: SessionAction[]) => actions.reduce(reduceSession, session)

it('places a number in the selected cell and records the move', () => {
  const session = run(start(), { type: 'select', cell: OPEN }, { type: 'digit', digit: 4 })
  expect(session.game.entries[OPEN]).toBe(4)
  expect(session.move).toMatchObject({ id: 1, kind: 'number', cell: OPEN, mistake: false })
})

it('marks a wrong number as a mistake', () => {
  const session = run(start(), { type: 'select', cell: OPEN }, { type: 'digit', digit: 5 })
  expect(session.game.mistakes).toBe(1)
  expect(session.move).toMatchObject({ kind: 'number', mistake: true })
})

it('records a clear when the same number is placed again', () => {
  const session = run(start(), { type: 'select', cell: OPEN }, { type: 'digit', digit: 4 }, { type: 'digit', digit: 4 })
  expect(session.game.entries[OPEN]).toBe(0)
  expect(session.move).toMatchObject({ id: 2, kind: 'clear' })
})

it('toggles a note in notes mode', () => {
  const session = run(start(), { type: 'select', cell: OPEN }, { type: 'toggleNotesMode' }, { type: 'digit', digit: 3 })
  expect(session.notesMode).toBe(true)
  expect(session.game.notes[OPEN]).toEqual([3])
  expect(session.move).toMatchObject({ kind: 'note' })
})

it('records the restored cell for an undo, not the selected cell', () => {
  const session = run(
    start(),
    { type: 'select', cell: OPEN },
    { type: 'digit', digit: 4 },
    { type: 'select', cell: 0 },
    { type: 'undo' },
  )
  expect(session.game.selected).toBe(0)
  expect(session.move).toMatchObject({ kind: 'undo', cell: OPEN })
})

it('records the cell of an undone note', () => {
  const session = run(
    start(),
    { type: 'select', cell: OPEN },
    { type: 'toggleNotesMode' },
    { type: 'digit', digit: 3 },
    { type: 'select', cell: 0 },
    { type: 'undo' },
  )
  expect(session.move).toMatchObject({ kind: 'undo', cell: OPEN })
})

it('returns the same session when an action changes nothing', () => {
  const session = start()
  expect(reduceSession(session, { type: 'undo' })).toBe(session)
  expect(reduceSession(session, { type: 'digit', digit: 4 })).toBe(session)
  expect(reduceSession(session, { type: 'erase' })).toBe(session)
})

it('adds time only while the game is playing', () => {
  const played = run(start(), { type: 'tick', elapsedMs: 1000 })
  expect(played.game.playedMs).toBe(1000)
  const paused = run(played, { type: 'pause' })
  expect(paused.game.status).toBe('paused')
  expect(reduceSession(paused, { type: 'tick', elapsedMs: 1000 })).toBe(paused)
  expect(run(paused, { type: 'resume' }).game.status).toBe('playing')
})

it('does not change notes mode after the game is lost', () => {
  const lost = run(
    start(),
    { type: 'select', cell: OPEN },
    { type: 'digit', digit: 5 },
    { type: 'digit', digit: 6 },
    { type: 'digit', digit: 7 },
  )
  expect(lost.game.status).toBe('lost')
  expect(reduceSession(lost, { type: 'toggleNotesMode' })).toBe(lost)
})

it('knows when undo and erase can act', () => {
  const fresh = start()
  expect(canUndo(fresh.game)).toBe(false)
  expect(canErase(fresh.game)).toBe(false)
  const placed = run(fresh, { type: 'select', cell: OPEN }, { type: 'digit', digit: 4 })
  expect(canUndo(placed.game)).toBe(true)
  expect(canErase(placed.game)).toBe(true)
  // Cell 0 holds the given 5.
  expect(canErase(run(placed, { type: 'select', cell: 0 }).game)).toBe(false)
})

it('keeps the same board when only the time changes', () => {
  const placed = run(start(), { type: 'select', cell: OPEN }, { type: 'digit', digit: 4 })
  expect(placed.board).toBe(placed.game)
  const ticked = run(placed, { type: 'tick', elapsedMs: 1000 })
  expect(ticked.game.playedMs).toBe(1000)
  expect(ticked.board).toBe(placed.board)
  const paused = run(ticked, { type: 'pause' })
  expect(paused.board).toBe(paused.game)
})

it('resumes a game as it was saved', () => {
  const played = run(
    start(),
    { type: 'select', cell: OPEN },
    { type: 'toggleNotesMode' },
    { type: 'digit', digit: 3 },
    { type: 'toggleNotesMode' },
    { type: 'digit', digit: 5 },
    { type: 'tick', elapsedMs: 65_000 },
  ).game
  const session = startSession(played)
  expect(session.game).toBe(played)
  expect(session.board).toBe(played)
  expect(session.game).toMatchObject({ mistakes: 1, playedMs: 65_000 })
  expect(session.game.undoSteps).toHaveLength(2)
  expect(session).toMatchObject({ notesMode: false, move: null })
})

it('starts a new game from the givens', () => {
  const session = startSession(sampleStart())
  expect(session.game).toMatchObject({ mistakes: 0, playedMs: 0, status: 'playing' })
  expect(session.move).toBeNull()
})

const answerOf = (game: Game): CellDigit => {
  const plan = planHint(game)
  if (plan === null || plan.kind === 'mistake') throw new Error('expected a plan with an answer')
  return plan.answer
}
const opened = (session: Session) => run(session, { type: 'hint' })
const more = (times: number): SessionAction[] => Array.from({ length: times }, () => ({ type: 'hintMore' }))
const pointing = () => startSession(pointingStart())
const wrongEntry = () =>
  run(start(), { type: 'select', cell: OPEN }, { type: 'digit', digit: 5 }, { type: 'select', cell: 0 })

describe('the open hint (ADR-032)', () => {
  it('opens the card at rung 1 of step 1 and changes nothing in the game', () => {
    const before = start()
    const session = opened(before)
    expect(session.hint).toMatchObject({ plan: planHint(before.game), step: 0, rung: 1, view: 'card' })
    expect(session.game).toBe(before.game)
  })

  it('moves down one rung at a time and counts when the answer rung of the last step opens', () => {
    const session = run(opened(start()), ...more(2))
    expect(session.hint).toMatchObject({ rung: 3 })
    expect(session.game.hintsUsed).toBe(0)
    const answer = run(session, { type: 'hintMore' })
    expect(answer.hint).toMatchObject({ rung: 4 })
    expect(answer.game.hintsUsed).toBe(1)
    expect(answer.shownAnswers).toEqual([answerOf(start().game)])
    expect(run(answer, { type: 'hintMore' })).toBe(answer)
  })

  it('leads from the answer rung of an elimination step to the next step, and counts only the last', () => {
    const session = run(opened(pointing()), ...more(3))
    expect(session.hint).toMatchObject({ step: 0, rung: 4 })
    expect(session.game.hintsUsed).toBe(0)
    const next = run(session, { type: 'hintNext' })
    expect(next.hint).toMatchObject({ step: 1, rung: 1 })
    expect(run(next, ...more(3)).game.hintsUsed).toBe(1)
  })

  it('jumps to the answer of the last step with Show answer, and counts', () => {
    const session = run(opened(pointing()), { type: 'hintAnswer' })
    expect(session.hint).toMatchObject({ step: 1, rung: 4 })
    expect(session.game.hintsUsed).toBe(1)
  })

  it('fills the answer, ends the hint and counts it once', () => {
    const answer = answerOf(start().game)
    const session = run(opened(start()), { type: 'hintAnswer' }, { type: 'hintFill' })
    expect(session.game.entries[answer.cell]).toBe(answer.digit)
    expect(session.game.hintsUsed).toBe(1)
    expect(session.hint).toBeNull()
    expect(session.move).toMatchObject({ kind: 'hint', cell: answer.cell })
  })

  it('counts Fill it on a hint that never showed the answer', () => {
    expect(run(opened(start()), { type: 'hintFill' }).game.hintsUsed).toBe(1)
  })

  it('counts the same answer once in a game session', () => {
    const session = run(
      opened(start()),
      { type: 'hintAnswer' },
      { type: 'hintClose' },
      { type: 'hint' },
      { type: 'hintAnswer' },
      { type: 'hintFill' },
      { type: 'undo' },
      { type: 'hint' },
      { type: 'hintFill' },
    )
    expect(session.game.hintsUsed).toBe(1)
    expect(session.shownAnswers).toHaveLength(1)
  })

  it('hands the move back with Try it, and opens the card again at the same rung', () => {
    const strip = run(opened(start()), { type: 'hintMore' }, { type: 'hintTry' })
    expect(strip.hint).toMatchObject({ rung: 2, view: 'strip' })
    expect(run(strip, { type: 'hintOpen' }).hint).toMatchObject({ rung: 2, view: 'card' })
    expect(run(strip, { type: 'hint' }).hint).toMatchObject({ rung: 2, view: 'card' })
  })

  it('ends the hint with the close button or a tap on the active Hint tool', () => {
    expect(run(opened(start()), { type: 'hintClose' }).hint).toBeNull()
    expect(run(opened(start()), { type: 'hint' }).hint).toBeNull()
    expect(run(opened(start()), { type: 'hintTry' }, { type: 'hintClose' }).hint).toBeNull()
  })

  it('says "Nice." when the player places the target digit, without a count', () => {
    const answer = answerOf(start().game)
    const session = run(
      opened(start()),
      { type: 'hintTry' },
      { type: 'select', cell: answer.cell },
      { type: 'digit', digit: answer.digit },
    )
    expect(session.hint).toMatchObject({ view: 'nice' })
    expect(session.game.hintsUsed).toBe(0)
    expect(run(session, { type: 'hintClose' }).hint).toBeNull()
  })

  it('ends on any other entry, an erase, an undo or a pause', () => {
    const answer = answerOf(start().game)
    const other = answer.cell === OPEN ? 3 : OPEN
    const digit = sampleStart().solution[other] as Digit
    const hinted = () => run(start(), { type: 'select', cell: other }, { type: 'digit', digit }, { type: 'hint' })
    expect(hinted().hint?.plan.kind).toBe('steps')
    expect(run(hinted(), { type: 'digit', digit: 2 }).hint).toBeNull()
    expect(run(hinted(), { type: 'erase' }).hint).toBeNull()
    expect(run(hinted(), { type: 'undo' }).hint).toBeNull()
    expect(run(hinted(), { type: 'pause' }).hint).toBeNull()
  })

  it('stays open over a notes edit, a selection and notes mode', () => {
    const session = run(
      opened(start()),
      { type: 'hintMore' },
      { type: 'select', cell: OPEN },
      { type: 'toggleNotesMode' },
      { type: 'digit', digit: 3 },
    )
    expect(session.game.notes[OPEN]).toEqual([3])
    expect(session.hint).toMatchObject({ rung: 2, view: 'card' })
  })

  it('ends when the target digit wins the game', () => {
    const near = sampleStart()
    const entries = near.solution.map((value, cell) => (cell === OPEN || near.givens[cell] !== 0 ? 0 : value))
    const session = run(startSession({ ...near, entries }), { type: 'hint' }, { type: 'hintFill' })
    expect(session.game.status).toBe('won')
    expect(session.hint).toBeNull()
  })

  it('shows a wrong entry first and never counts it', () => {
    const session = opened(wrongEntry())
    expect(session.hint?.plan).toEqual({ kind: 'mistake', cell: OPEN })
    expect(run(session, { type: 'hintMore' })).toBe(session)
    expect(run(session, { type: 'hintFill' })).toBe(session)
    const erased = run(session, { type: 'hintErase' })
    expect(erased.game.entries[OPEN]).toBe(0)
    expect(erased.hint).toBeNull()
    expect(erased.game.hintsUsed).toBe(0)
  })

  it('counts a fallback when its card opens', () => {
    const session = opened(startSession(stuckStart()))
    expect(session.hint?.plan.kind).toBe('fallback')
    expect(session.game.hintsUsed).toBe(1)
    const filled = run(session, { type: 'hintFill' })
    expect(filled.game.hintsUsed).toBe(1)
    expect(filled.hint).toBeNull()
  })

  it('keeps the hint object while an action leaves it as it is', () => {
    const session = opened(start())
    expect(run(session, { type: 'select', cell: OPEN }).hint).toBe(session.hint)
    expect(run(session, { type: 'tick', elapsedMs: 1000 }).hint).toBe(session.hint)
  })
})
