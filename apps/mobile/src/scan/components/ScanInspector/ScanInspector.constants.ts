import type { InspectorView } from '@/scan/utils/inspector.utils'

export const TABS: readonly { view: InspectorView; label: string }[] = [
  { view: 'correct', label: 'Correct' },
  { view: 'photo', label: 'Photo' },
  { view: 'cutout', label: 'Cut-out' },
  { view: 'overlay', label: 'Overlay' },
]

/** Points of the corner dots and the line widths of the inspector. */
export const DOT_RADIUS = 6
export const LINE_WIDTH = 1.5
export const EDGE_WIDTH = 3
