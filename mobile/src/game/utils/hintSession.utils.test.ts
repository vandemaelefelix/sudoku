import { planHint, type CellDigit, type Digit, type Game } from '@sudoku/core'
import { pointingStart, sampleStart, stuckStart } from './sample.utils'
import { OPEN, runSession as run, sampleSession as start } from '@/game/sample.testkit'
import { startSession, type Session, type SessionAction } from './session.utils'

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
    expect(session.hint).toEqual({ plan: planHint(before.game), step: 0, rung: 1 })
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

  it('ignores Fill it before the answer shows', () => {
    const session = opened(pointing())
    expect(run(session, { type: 'hintFill' })).toBe(session)
    const elimination = run(session, ...more(3))
    expect(run(elimination, { type: 'hintFill' })).toBe(elimination)
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

  it('ends the hint with the close button or a tap on the Hint tool', () => {
    expect(run(opened(start()), { type: 'hintClose' }).hint).toBeNull()
    expect(run(opened(start()), { type: 'hint' }).hint).toBeNull()
  })

  describe('counts a close as before (ADR-032 point 7)', () => {
    it('does not count a close at rung 1, 2 or 3', () => {
      for (const rung of [1, 2, 3]) {
        const session = run(opened(start()), ...more(rung - 1), { type: 'hintClose' })
        expect(session.hint).toBeNull()
        expect(session.game.hintsUsed).toBe(0)
      }
    })

    it('keeps the count of the answer rung of the last step after a close', () => {
      const session = run(opened(start()), ...more(3), { type: 'hintClose' })
      expect(session.game.hintsUsed).toBe(1)
    })

    it('does not count a close at the answer rung of an elimination step', () => {
      const session = run(opened(pointing()), ...more(3), { type: 'hintClose' })
      expect(session.game.hintsUsed).toBe(0)
    })

    it('keeps the count of the fallback after a close', () => {
      expect(run(opened(startSession(stuckStart())), { type: 'hintClose' }).game.hintsUsed).toBe(1)
    })

    it('does not count a close of the wrong-entry card', () => {
      expect(run(opened(wrongEntry()), { type: 'hintClose' }).game.hintsUsed).toBe(0)
    })
  })

  it('does not count the target digit that the player places after a close', () => {
    const answer = answerOf(start().game)
    const session = run(
      opened(start()),
      { type: 'hintClose' },
      { type: 'select', cell: answer.cell },
      { type: 'digit', digit: answer.digit },
    )
    expect(session.game.entries[answer.cell]).toBe(answer.digit)
    expect(session.game.hintsUsed).toBe(0)
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
    expect(session.hint).toMatchObject({ rung: 2 })
  })

  it('ends when the target digit wins the game', () => {
    const near = sampleStart()
    const entries = near.solution.map((value, cell) => (cell === OPEN || near.givens[cell] !== 0 ? 0 : value))
    const session = run(
      startSession({ ...near, entries }),
      { type: 'hint' },
      { type: 'hintAnswer' },
      { type: 'hintFill' },
    )
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
    expect(erased.game.selected).toBe(OPEN)
    expect(erased.move).toMatchObject({ kind: 'erase', cell: OPEN })
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
