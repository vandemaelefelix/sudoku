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

it('returns the same session when an action changes nothing', () => {
  const session = start()
  expect(reduceSession(session, { type: 'undo' })).toBe(session)
  expect(reduceSession(session, { type: 'digit', digit: 4 })).toBe(session)
  expect(reduceSession(session, { type: 'erase' })).toBe(session)
})

it('fills the cell that the random source picks with a hint, and selects it', () => {
  const session = run(start(), { type: 'hint', random: () => 0 })
  expect(session.game.entries[OPEN]).toBe(4)
  expect(session.game.selected).toBe(OPEN)
  expect(session.move).toMatchObject({ kind: 'hint', cell: OPEN })
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
