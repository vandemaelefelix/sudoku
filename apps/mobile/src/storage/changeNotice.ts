import { devWarn, errorMessage } from '@/utils/log.utils'
import { resultOf } from './PuzzleRepository'
import type { GameStorage } from './gameStorage.types'

/**
 * Adds `subscribe` to a storage. The listeners run after a write that can change the history resolves: a start (it can
 * abandon a game), a save that finishes a game, and a clear. The sync listens here, because `game/` and `stats/` must not
 * import `sync/` (ADR-028). A listener that throws never fails the write.
 */
export function withChangeNotice(storage: Omit<GameStorage, 'subscribe'>): GameStorage {
  const listeners = new Set<() => void>()
  const notify = () => {
    for (const listener of listeners) {
      try {
        listener()
      } catch (error) {
        devWarn('storage', `A change listener threw: ${errorMessage(error)}`)
      }
    }
  }
  const after = async <T>(write: Promise<T>, changed = true): Promise<T> => {
    const result = await write
    if (changed) notify()
    return result
  }
  return {
    ...storage,
    puzzles: {
      ...storage.puzzles,
      start: (input) => after(storage.puzzles.start(input)),
      save: (id, game, owner) => after(storage.puzzles.save(id, game, owner), resultOf(game) !== null),
    },
    history: { ...storage.history, clear: (owner) => after(storage.history.clear(owner)) },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
