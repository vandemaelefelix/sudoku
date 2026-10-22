import { HintCard } from '@/game/components/HintCard'
import { Keypad } from '@/game/components/Keypad'
import { useGameState } from '@/game/hooks/useGameState'

/** The keypad, or the hint card in its place while the player reads a hint. */
export function KeypadSlot() {
  const { hint } = useGameState()
  return hint?.view === 'card' ? <HintCard hint={hint} /> : <Keypad />
}
