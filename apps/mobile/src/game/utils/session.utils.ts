import {
  createGame,
  erase,
  hint,
  pause,
  place,
  resume,
  select,
  tick,
  toggleNote,
  undo,
  type Completion,
  type Digit,
  type Game,
  type MoveResult,
  type NewGame,
  type Random,
} from '@sudoku/core'

export type MoveKind = 'number' | 'clear' | 'note' | 'erase' | 'undo' | 'hint'

/** The last action that changed the board. id grows by one per move, so an effect sees a repeat of the same move. */
export type Move = {
  id: number
  kind: MoveKind
  cell: number | null
  completed: Completion
  mistake: boolean
}

/** A game and the screen state around it. Notes mode belongs to the screen, not to the rules. */
export type Session = { game: Game; notesMode: boolean; move: Move | null }

export type SessionAction =
  | { type: 'select'; cell: number }
  | { type: 'digit'; digit: Digit }
  | { type: 'erase' }
  | { type: 'undo' }
  | { type: 'hint'; random: Random }
  | { type: 'toggleNotesMode' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'tick'; elapsedMs: number }

export function startSession(start: NewGame): Session {
  return { game: createGame(start), notesMode: false, move: null }
}

function withGame(session: Session, game: Game): Session {
  return game === session.game ? session : { ...session, game }
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
      cell: result.game.selected,
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

export function reduceSession(session: Session, action: SessionAction): Session {
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
      return moved(session, 'hint', hint(session.game, action.random))
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

export function canUndo(game: Game): boolean {
  return undo(game).game !== game
}

export function canErase(game: Game): boolean {
  return erase(game).game !== game
}
