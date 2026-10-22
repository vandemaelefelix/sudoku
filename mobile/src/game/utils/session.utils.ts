import {
  createGame,
  erase,
  fillHint,
  pause,
  planHint,
  place,
  resume,
  select,
  tick,
  toggleNote,
  undo,
  type CellDigit,
  type Completion,
  type Digit,
  type Game,
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
 * The saved game does not keep them.
 */
export type Session = {
  game: Game
  board: Game
  notesMode: boolean
  move: Move | null
  shownAnswers: readonly CellDigit[]
}

export type SessionAction =
  | { type: 'select'; cell: number }
  | { type: 'digit'; digit: Digit }
  | { type: 'erase' }
  | { type: 'undo' }
  | { type: 'hint' }
  | { type: 'toggleNotesMode' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'tick'; elapsedMs: number }

/** A new game from its givens, or a saved game to resume as it is. */
export type GameStart = NewGame | Game

function isGame(start: GameStart): start is Game {
  return 'status' in start
}

export function startSession(start: GameStart): Session {
  const game = isGame(start) ? start : createGame(start)
  return { game, board: game, notesMode: false, move: null, shownAnswers: [] }
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

/**
 * Until the hint card ships, a hint fills the answer of its plan at once. For a wrong entry it
 * selects that cell instead, so the player sees what to erase.
 */
function hintMove(session: Session): Session {
  const plan = planHint(session.game)
  if (plan === null) return session
  if (plan.kind === 'mistake') return withGame(session, select(session.game, plan.cell))
  const next = moved(session, 'hint', fillHint(session.game, plan, session.shownAnswers))
  const { cell, digit } = plan.answer
  if (next === session || session.shownAnswers.some((item) => item.cell === cell && item.digit === digit)) return next
  return { ...next, shownAnswers: [...session.shownAnswers, plan.answer] }
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
      return hintMove(session)
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
  const next = step(session, action)
  if (action.type === 'tick' || next.board === next.game) return next
  return { ...next, board: next.game }
}

export function canUndo(game: Game): boolean {
  return undo(game).game !== game
}

export function canErase(game: Game): boolean {
  return erase(game).game !== game
}
