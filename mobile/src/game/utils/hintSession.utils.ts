import {
  planHint,
  shownBefore,
  revealHint,
  type CellDigit,
  type Game,
  type HintPlan,
  type HintRung,
} from '@sudoku/core'

/** The hint that the player reads on the hint card (ADR-032). step: the index of the step that shows. */
export type OpenHint = {
  plan: HintPlan
  step: number
  rung: HintRung
}

/**
 * The buttons of the hint card. hintMore: the next rung. hintAnswer: the answer rung of the last step.
 * hintNext: the next step. hintFill: "Fill it". hintErase: "Erase it".
 */
export type HintCardAction = 'hintMore' | 'hintAnswer' | 'hintNext' | 'hintFill' | 'hintClose' | 'hintErase'

/**
 * The part of a Session that the hint transitions read and write. session.utils.ts owns the Session and calls these
 * functions from reduceSession, the one entry for a session change. The functions keep the type of their session.
 */
export type HintState = {
  game: Game
  notesMode: boolean
  shownAnswers: readonly CellDigit[]
  hint: OpenHint | null
}

export function withHint<S extends HintState>(session: S, hint: OpenHint | null): S {
  return hint === session.hint ? session : { ...session, hint }
}

/** Counts the answer once in this game session (ADR-032 point 7). */
function revealed<S extends HintState>(session: S, answer: CellDigit): S {
  if (shownBefore(answer, session.shownAnswers)) return session
  return {
    ...session,
    game: revealHint(session.game, answer, session.shownAnswers),
    shownAnswers: [...session.shownAnswers, answer],
  }
}

function lastStep(plan: HintPlan): number {
  return plan.kind === 'steps' ? plan.steps.length - 1 : 0
}

/** The answer rung of the last step counts. */
function showRung<S extends HintState>(session: S, hint: OpenHint, index: number, rung: HintRung): S {
  const next = withHint(session, { ...hint, step: index, rung })
  if (hint.plan.kind !== 'steps' || rung !== 4 || index !== lastStep(hint.plan)) return next
  return revealed(next, hint.plan.answer)
}

/** The Hint tool: plans a new hint, or ends the open one. */
export function hintTool<S extends HintState>(session: S): S {
  if (session.hint !== null) return withHint(session, null)
  if (session.game.status !== 'playing') return session
  const plan = planHint(session.game)
  if (plan === null) return session
  const next = withHint(session, { plan, step: 0, rung: 1 })
  // The fallback card shows its answer at once.
  return plan.kind === 'fallback' ? revealed(next, plan.answer) : next
}

/** A button of the hint card that only changes the hint: more, answer, next and close. */
export function hintCard<S extends HintState>(session: S, type: Exclude<HintCardAction, 'hintFill' | 'hintErase'>): S {
  const hint = session.hint
  if (hint === null) return session
  const { plan, step: index, rung } = hint
  const steps = plan.kind === 'steps'
  switch (type) {
    case 'hintMore':
      return steps && rung < 4 ? showRung(session, hint, index, (rung + 1) as HintRung) : session
    case 'hintAnswer':
      return steps ? showRung(session, hint, lastStep(plan), 4) : session
    case 'hintNext':
      return steps && rung === 4 && index < lastStep(plan)
        ? withHint(session, { ...hint, step: index + 1, rung: 1 })
        : session
    case 'hintClose':
      return withHint(session, null)
  }
}

/**
 * The plan that "Fill it" fills, or null when the card offers no Fill it. The card offers it only once the answer
 * shows: on the fallback, or on rung 4 of the last step.
 */
export function fillablePlan(hint: OpenHint | null): Exclude<HintPlan, { kind: 'mistake' }> | null {
  if (hint === null || hint.plan.kind === 'mistake') return null
  const { plan, step, rung } = hint
  return plan.kind === 'fallback' || (rung === 4 && step === lastStep(plan)) ? plan : null
}

/**
 * The open hint after an action (ADR-032 point 14). An entry, an erase, an undo, a pause and the end of the game end
 * the hint. A notes edit and a selection keep it.
 */
export function hintAfter(before: HintState, after: HintState, action: { type: string }): OpenHint | null {
  const hint = after.hint
  if (hint === null || after.game.status !== 'playing') return null
  const boardMove = (action.type === 'digit' && !before.notesMode) || action.type === 'erase' || action.type === 'undo'
  return boardMove && after.game !== before.game ? null : hint
}
