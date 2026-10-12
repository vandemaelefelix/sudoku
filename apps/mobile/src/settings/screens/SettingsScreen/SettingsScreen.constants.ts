import type { AssistName } from '@/game/constants/assists.constants'

/** The switch rows in the canvas order, with the canvas text. */
export const ASSIST_ROWS: ReadonlyArray<{ name: AssistName; label: string; description: string }> = [
  { name: 'rowColumn', label: 'Row and column', description: 'Shade the row and column of the selected cell.' },
  { name: 'box', label: 'Box', description: 'Shade the 3×3 box of the selected cell.' },
  {
    name: 'selectedCell',
    label: 'Selected cell',
    description: 'Fill the selected cell. When off, a thin ring still marks it.',
  },
  { name: 'sameNumbers', label: 'Same numbers', description: 'Shade every cell that holds the selected number.' },
]
