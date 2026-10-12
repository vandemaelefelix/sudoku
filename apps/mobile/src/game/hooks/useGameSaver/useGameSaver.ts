import { createContext, useContext, useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import type { Game } from '@sudoku/core'
import { needsSave } from '@/game/utils/save.utils'

/** Stores the game in progress. It returns at once and never throws: the UI never waits for a save. */
export type SaveGame = (game: Game) => void

/** The play screen gives the save. Without it, the game screen saves nothing. */
export const GameSaveContext = createContext<SaveGame | null>(null)

/**
 * Saves the board after each move. A clock tick and a selection do not save, so the hook also saves
 * the latest board and time played when the app leaves the foreground and when the screen closes (QR-11).
 */
export function useGameSaver(board: Game, playedMs: number): void {
  const save = useContext(GameSaveContext)
  const lastSaved = useRef(board)
  const latest = useRef({ board, playedMs })
  useEffect(() => {
    latest.current = { board, playedMs }
  })
  useEffect(() => {
    if (save === null || !needsSave(lastSaved.current, board)) return
    lastSaved.current = board
    save(board)
  }, [save, board])
  useEffect(() => {
    if (save === null) return undefined
    const saveLatest = () => save({ ...latest.current.board, playedMs: latest.current.playedMs })
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') saveLatest()
    })
    return () => {
      subscription.remove()
      saveLatest()
    }
  }, [save])
}
