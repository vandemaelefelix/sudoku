export const ICON_PATHS = {
  back: 'M15 18l-6-6 6-6',
  pause: 'M9 5v14M15 5v14',
  play: 'M8 5l11 7-11 7z',
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  erase: 'M20 20H9l-4.6-4.6a1.5 1.5 0 0 1 0-2.1l8.9-8.9a1.5 1.5 0 0 1 2.1 0l4.6 4.6a1.5 1.5 0 0 1 0 2.1L13 19M8 11l6 6',
  notes: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z',
  hint: 'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z',
  scan: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3',
} as const

/** The canvas draws 24 pt icons with a 1.8 line and 16 pt icons with a 2 line, in a 24-unit box. */
export const STROKE_WIDTH = { 16: 2, 24: 1.8 } as const

export const VIEW_BOX = 24
