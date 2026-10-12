/** The shades that help the player read the grid. The game-screen concept describes each one. */
export type Assists = {
  rowColumn: boolean
  box: boolean
  selectedCell: boolean
  sameNumbers: boolean
}

export const DEFAULT_ASSISTS: Assists = { rowColumn: true, box: true, selectedCell: true, sameNumbers: true }

export type AssistName = keyof Assists

/** The SettingsRepository key of the assists. The value is the Assists object as JSON (ADR-012). */
export const ASSISTS_KEY = 'game.assists'
