import type { ComponentType } from 'react'
import type { ThemeName } from '@/theme/theme.types'
import { OpartCardWaves, OpartSummaryWaves, OpartWaves } from '@/theme/decorations/OpartWaves'
import { ProgressiveDisc } from '@/theme/decorations/ProgressiveDisc'
import { ProgressiveStripes } from '@/theme/decorations/ProgressiveStripes'
import type { DecorationSlot } from './decorations.types'

/** The theme decorations of each theme (ADR-015, point 9; ADR-021). A theme leaves a slot out to draw nothing there. */
export const DECORATIONS: Readonly<Record<ThemeName, Partial<Record<DecorationSlot, ComponentType>>>> = {
  daylight: {},
  midnight: {},
  opart: { panelEdge: OpartWaves, cardEdge: OpartCardWaves, summaryEdge: OpartSummaryWaves },
  progressive: { panelEdge: ProgressiveStripes, titleMark: ProgressiveDisc },
}
