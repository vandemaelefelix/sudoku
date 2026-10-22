import type { AssistName } from '@/game/constants/assists.constants'
import type { MessageId } from '@/i18n/messages'

/** The switch rows in the canvas order. label and description: message ids. */
export const ASSIST_ROWS: ReadonlyArray<{ name: AssistName; label: MessageId; description: MessageId }> = [
  { name: 'rowColumn', label: 'settings.assists.rowColumn', description: 'settings.assists.rowColumnText' },
  { name: 'box', label: 'settings.assists.box', description: 'settings.assists.boxText' },
  { name: 'selectedCell', label: 'settings.assists.selectedCell', description: 'settings.assists.selectedCellText' },
  { name: 'sameNumbers', label: 'settings.assists.sameNumbers', description: 'settings.assists.sameNumbersText' },
]
