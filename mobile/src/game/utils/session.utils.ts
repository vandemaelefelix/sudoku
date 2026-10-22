import {
  createGame,
  erase,
  fillHint,
  pause,
  planHint,
  shownBefore,
  place,
  resume,
  revealHint,
  select,
  tick,
  toggleNote,
  undo,
  type CellDigit,
  type Completion,
  type Digit,
  type Game,
  type HintPlan,
  type HintRung,
  type MoveResult,
  type NewGame,
} from '@sudoku/core'

export type MoveKind = 'number' | 'clear' | 'note' | 'erase' | 'undo' | 'hint'

/**
 * The last action that changed the board. id grows by one per move, so an effect sees a repeat of the same move.
 * cell is the selected cell after the move. For an undo it is the cell that the undo restored.
 */
export type Move = {
  id: number
  kind: MoveKind
  cell: number | null
  completed: Completion
  mistake: boolean
}

/**
 * A game and the screen state around it. Notes mode belongs to the screen, not to the rules.
 * board is the game at its last change other than time. A clock tick keeps the same board object,
 * so the grid does not render again each second. Its playedMs is stale: read game.playedMs for the time.
 * shownAnswers holds the hint answers that this session showed, so each one counts once (ADR-032 point 7).
 * The saved game keeps neither them nor the open hint.
 */
export type Session = {
  game: Game
  board: Game
  notesMode: boolean
  move: Move | null
  shownAnswers: readonly CellDigit[]
  hint: OpenHint | null
}

/** The hint that the player reads on the hint card (ADR-032). step: the index of the step that shows. */
export type OpenHint = {
  plan: HintPlan
  step: number
  rung: HintRung
}

export type SessionAction =
  | { type: 'select'; cell: number }
  | { type: 'digit'; digit: Digit }
  | { type: 'erase' }
  | { type: 'undo' }
  | { type: 'hint' }
  | { type: HintCardAction }
  | { type: 'toggleNotesMode' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'tick'; elapsedMs: number }

/**
 * The buttons of the hint card. hintMore: the next rung. hintAnswer: the answer rung of the last step.
 * hintNext: the next step. hintErase: "Erase it".
 */
export type HintCardAction = 'hintMore' | 'hintAnswer' | 'hintNext' | 'hintFill' | 'hintClose' | 'hintErase'

/** A new game from its givens, or a saved game to resume as it is. */
export type GameStart = NewGame | Game

function isGame(start: GameStart): start is Game {
  return 'status' in start
}

export function startSession(start: GameStart): Session {
  const game = isGame(start) ? start : createGame(start)
  return { game, board: game, notesMode: false, move: null, shownAnswers: [], hint: null }
}

function withGame(session: Session, game: Game): Session {
  return game === session.game ? session : { ...session, game }
}

/** The cell whose number changed, else the first cell whose notes changed, else null. An undo keeps the selection. */
export function changedCell(before: Game, after: Game): number | null {
  const entry = after.entries.findIndex((digit, cell) => digit !== before.entries[cell])
  if (entry !== -1) return entry
  const notes = after.notes.findIndex((digits, cell) => digits.join('') !== before.notes[cell]?.join(''))
  return notes === -1 ? null : notes
}

/** The core returns the same game object when an action changes nothing. Then the session stays the same too. */
function moved(session: Session, kind: MoveKind, result: MoveResult): Session {
  if (result.game === session.game) return session
  return {
    ...session,
    game: result.game,
    move: {
      id: (session.move?.id ?? 0) + 1,
      kind,
      cell: kind === 'undo' ? changedCell(session.game, result.game) : result.game.selected,
      completed: result.completed,
      mistake: result.game.mistakes > session.game.mistakes,
    },
  }
}

function placeDigit(session: Session, digit: Digit): Session {
  if (session.notesMode) return moved(session, 'note', toggleNote(session.game, digit))
  const result = place(session.game, digit)
  const cell = result.game.selected
  const cleared = cell !== null && result.game.entries[cell] === 0
  return moved(session, cleared ? 'clear' : 'number', result)
}

function withHint(session: Session, hint: OpenHint | null): Session {
  return hint === session.hint ? session : { ...session, hint }
}

/** Counts the answer once in this game session (ADR-032 point 7). */
function revealed(session: Session, answer: CellDigit): Session {
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
function showRung(session: Session, hint: OpenHint, index: number, rung: HintRung): Session {
  const next = withHint(session, { ...hint, step: index, rung })
  if (hint.plan.kind !== 'steps' || rung !== 4 || index !== lastStep(hint.plan)) return next
  return revealed(next, hint.plan.answer)
}

/** The Hint tool: plans a new hint, or ends the open one. */
function hintTool(session: Session): Session {
  if (session.hint !== null) return withHint(session, null)
  if (session.game.status !== 'playing') return session
  const plan = planHint(session.game)
  if (plan === null) return session
  const next = withHint(session, { plan, step: 0, rung: 1 })
  // The fallback card shows its answer at once.
  return plan.kind === 'fallback' ? revealed(next, plan.answer) : next
}

function fillAnswer(session: Session, plan: HintPlan): Session {
  if (plan.kind === 'mistake') return session
  const next = moved(session, 'hint', fillHint(session.game, plan, session.shownAnswers))
  if (next === session) return session
  const shownAnswers = shownBefore(plan.answer, session.shownAnswers)
    ? session.shownAnswers
    : [...session.shownAnswers, plan.answer]
  return { ...next, shownAnswers, hint: null }
}

function eraseMistake(session: Session, plan: HintPlan): Session {
  if (plan.kind !== 'mistake') return session
  return withHint(moved(session, 'erase', erase(select(session.game, plan.cell))), null)
}

function hintCard(session: Session, type: HintCardAction): Session {
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
    case 'hintFill':
      // The card offers Fill it only once the answer shows: on the fallback, or on rung 4 of the last step.
      return plan.kind === 'fallback' || (rung === 4 && index === lastStep(plan)) ? fillAnswer(session, plan) : session
    case 'hintClose':
      return withHint(session, null)
    case 'hintErase':
      return eraseMistake(session, plan)
  }
}

/**
 * The open hint after an action (ADR-032 point 14). An entry, an erase, an undo, a pause and the end of the game end
 * the hint. A notes edit and a selection keep it.
 */
function hintAfter(before: Session, after: Session, action: SessionAction): OpenHint | null {
  const hint = after.hint
  if (hint === null || after.game.status !== 'playing') return null
  const boardMove = (action.type === 'digit' && !before.notesMode) || action.type === 'erase' || action.type === 'undo'
  return boardMove && after.game !== before.game ? null : hint
}

function step(session: Session, action: SessionAction): Session {
  switch (action.type) {
    case 'select':
      return withGame(session, select(session.game, action.cell))
    case 'digit':
      return placeDigit(session, action.digit)
    case 'erase':
      return moved(session, 'erase', erase(session.game))
    case 'undo':
      return moved(session, 'undo', undo(session.game))
    case 'hint':
      return hintTool(session)
    case 'hintMore':
    case 'hintAnswer':
    case 'hintNext':
    case 'hintFill':
    case 'hintClose':
    case 'hintErase':
      return hintCard(session, action.type)
    case 'toggleNotesMode':
      return session.game.status === 'playing' ? { ...session, notesMode: !session.notesMode } : session
    case 'pause':
      return withGame(session, pause(session.game))
    case 'resume':
      return withGame(session, resume(session.game))
    case 'tick':
      return withGame(session, tick(session.game, action.elapsedMs))
  }
}

export function reduceSession(session: Session, action: SessionAction): Session {
  const stepped = step(session, action)
  const next = withHint(stepped, hintAfter(session, stepped, action))
  if (action.type === 'tick' || next.board === next.game) return next
  return { ...next, board: next.game }
}

export function canUndo(game: Game): boolean {
  return undo(game).game !== game
}

export function canErase(game: Game): boolean {
  return erase(game).game !== game
}
