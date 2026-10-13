import type { InspectorView } from '@/scan/utils/inspector.utils'

export const TABS: readonly { view: InspectorView; label: string }[] = [
  { view: 'photo', label: 'Photo' },
  { view: 'cutout', label: 'Cutout' },
  { view: 'overlay', label: 'Overlay' },
  { view: 'cells', label: 'Cells' },
]

/** Points of the corner dots and the line widths of the inspector. */
export const DOT_RADIUS = 6
export const LINE_WIDTH = 1.5
export const EDGE_WIDTH = 3

/** Points: the height of the confidence bar at the foot of a cell on the Cells tab. */
export const BAR_HEIGHT = 3
