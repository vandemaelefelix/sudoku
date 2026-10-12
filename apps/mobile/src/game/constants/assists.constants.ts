/** The shades that help the player read the grid. The game-screen concept describes each one. */
export type Assists = {
  rowColumn: boolean
  box: boolean
  selectedCell: boolean
  sameNumbers: boolean
}

export const DEFAULT_ASSISTS: Assists = { rowColumn: true, box: true, selectedCell: true, sameNumbers: true }
