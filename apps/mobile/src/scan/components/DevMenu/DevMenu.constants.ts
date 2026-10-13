/** The label of the Save button, by state. */
export const SAVE_TEXT = {
  idle: 'Save corrections',
  saving: 'Saving…',
  saved: 'Saved ✓',
  failed: 'Not saved. Try again',
} as const

export type SaveState = keyof typeof SAVE_TEXT

/** Points: the height of the inspector view and the side padding of the sheet. */
export const VIEWER_HEIGHT = 262
export const SHEET_PADDING = 20
