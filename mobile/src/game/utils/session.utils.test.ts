import { planHint } from '@sudoku/core'
import { canErase, canUndo, reduceSession, startSession, type Session, type SessionAction } from './session.utils'
import { sampleStart } from './sample.utils'

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

it('fills the answer of the hint plan, selects it and counts one hint', () => {
  const before = start()
  const plan = planHint(before.game)
  if (plan === null || plan.kind === 'mistake') throw new Error('expected a plan with an answer')
  const session = run(before, { type: 'hint' })
  expect(session.game.entries[plan.answer.cell]).toBe(plan.answer.digit)
  expect(session.game.selected).toBe(plan.answer.cell)
  expect(session.game.hintsUsed).toBe(1)
  expect(session.shownAnswers).toEqual([plan.answer])
  expect(session.move).toMatchObject({ kind: 'hint', cell: plan.answer.cell })
})

it('counts the same hint answer once after an undo', () => {
  const session = run(start(), { type: 'hint' }, { type: 'undo' }, { type: 'hint' })
  expect(session.game.hintsUsed).toBe(1)
  expect(session.shownAnswers).toHaveLength(1)
})

it('selects a wrong entry instead of filling a hint', () => {
  const wrong = run(start(), { type: 'select', cell: OPEN }, { type: 'digit', digit: 5 }, { type: 'select', cell: 0 })
  const session = run(wrong, { type: 'hint' })
  expect(session.game.selected).toBe(OPEN)
  expect(session.game.hintsUsed).toBe(0)
  expect(session.move).toBe(wrong.move)
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
