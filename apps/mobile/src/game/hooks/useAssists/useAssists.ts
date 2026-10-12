import { DEFAULT_ASSISTS, type Assists } from '@/game/constants/assists.constants'

/** The assists that shade the grid. Every assist is on until the player can change them in the settings. */
export function useAssists(): Assists {
  return DEFAULT_ASSISTS
}
