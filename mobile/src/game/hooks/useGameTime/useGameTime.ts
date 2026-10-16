import { createContext, useContext } from 'react'

export const GameTimeContext = createContext<number | null>(null)

/** The time played in milliseconds. It changes about once a second: read it only where the time shows. */
export function useGameTime(): number {
  const playedMs = useContext(GameTimeContext)
  if (playedMs === null) throw new Error('useGameTime needs a GameProvider')
  return playedMs
}
