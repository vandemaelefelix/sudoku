import { DIGITS, type CheckCell, type Kind, type KindTab, type Label } from '../../api/types'
import { KIND_LETTER, labelText } from '../../components/CellTile'
import type { KeyHelp } from '../../components/Frame'
import { plural } from '../../format'

export type Mode = 'digits' | 'kinds'

/** What the Digits step and the Kind step do differently. The Check step has no other test of the mode. */
export interface CheckMode {
  id: Mode
  tabs: string[]
  /** The field of a cell that the step labels. */
  field: 'digit' | 'kind'
  /** The percent that the sure button starts with. */
  threshold: number
  next: { name: string; route: string }
  task: string
  /** Why the step is empty. */
  empty: string
  keyList: KeyHelp[]
  /** The label that the cell has before a fix. */
  current: (cell: CheckCell) => string | null
  /** The text of a label on a tile. */
  show: (value: string | null) => string
  /** The label that a key gives, or undefined when the key belongs to the other step. */
  pick: (key: string) => string | undefined
  /** Why a key of the other step does nothing. */
  wrongKey: string
  /** Why the page cannot be confirmed while `n` cells have no label. */
  missing: (n: number) => string
}

const hasHave = (n: number): string => (n === 1 ? 'has' : 'have')

const KIND_KEYS: Record<string, Kind> = { p: 'printed', h: 'handwritten', u: 'unsure' }

export const MODES: Record<Mode, CheckMode> = {
  digits: {
    id: 'digits',
    tabs: [...DIGITS, 'unknown'],
    field: 'digit',
    threshold: 98,
    next: { name: 'Kind', route: 'kinds' },
    task: 'The cells with the most doubt come first. Select each cell with a wrong digit and type its digit. Enter confirms the rest.',
    empty: 'No cell waits for a digit. Cells of approved scans and loose cells appear here.',
    keyList: [
      { keys: '0–9', does: 'Give the selected cells their digit (0 is empty)' },
      { keys: 'X', does: 'Discard the selected cells' },
    ],
    current: (cell) => cell.digit,
    show: (value) => (value === null ? '?' : labelText(value as Label)),
    pick: (key) => (key === '0' ? 'empty' : key === 'x' ? 'discarded' : /^[1-9]$/.test(key) ? key : undefined),
    wrongKey: 'The Digits step has no kind. The Kind step comes next.',
    missing: (n) => `${plural(n, 'cell')} ${hasHave(n)} no digit yet. Select each one and type its digit.`,
  },
  kinds: {
    id: 'kinds',
    tabs: DIGITS.slice(1),
    field: 'kind',
    threshold: 95,
    next: { name: 'Finish', route: 'finish' },
    task: 'The cells with the most doubt come first. Select each cell with a wrong kind and press P or H. Enter confirms the rest.',
    empty: 'No cell waits for a kind. A cell needs a confirmed digit first.',
    keyList: [{ keys: 'P H U', does: 'Printed, handwritten or unsure for the selected cells' }],
    current: (cell) => cell.kind,
    show: (value) => (value === null ? '?' : KIND_LETTER[value as Kind]),
    pick: (key) => KIND_KEYS[key],
    wrongKey: 'The Kind step does not change digits. Go back to Digits to fix a digit.',
    missing: (n) => `${plural(n, 'cell')} ${hasHave(n)} no kind yet. Select each one and press P or H.`,
  },
}

/** The keys of the step for the help overlay: the selection keys, the keys of the mode, then the common keys. */
export const keysOf = (mode: CheckMode): KeyHelp[] => [
  { keys: 'Click', does: 'Select a cell, or unselect it' },
  { keys: 'Shift-click', does: 'Select the range from the last clicked cell' },
  { keys: 'Drag', does: 'Draw a box around cells to select them' },
  { keys: '⌘A', does: 'Select the page' },
  ...mode.keyList,
  { keys: 'Enter', does: 'Confirm the page: the fixes, and the current label for the rest' },
  { keys: '← →', does: 'Previous or next tab' },
  { keys: 'Esc', does: 'Clear the selection. With none selected, go back to the start' },
]

export const KIND_TABS: KindTab[] = ['all', 'printed', 'handwritten', 'unsure']

export const tabName = (tab: string): string => (tab === 'empty' ? 'Empty' : tab === 'unknown' ? 'No guess' : tab)

export const kindName = (kind: KindTab): string =>
  kind === 'all' ? 'All' : kind.charAt(0).toUpperCase() + kind.slice(1)

/** The first tab after `tab` that has cells, around the end. */
export function nextWithCells<T extends string>(tabs: T[], tab: T, counts: Record<string, number>): T | undefined {
  const at = tabs.indexOf(tab)
  return [...tabs.slice(at + 1), ...tabs.slice(0, at)].find((t) => (counts[t] ?? 0) > 0)
}

export const routeOf = (mode: Mode, tab: string, kind: KindTab): string =>
  `${mode}/${tab}${kind === 'all' ? '' : `/${kind}`}`
