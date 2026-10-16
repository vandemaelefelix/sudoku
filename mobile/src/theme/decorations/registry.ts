import type { ComponentType } from 'react'
import type { ThemeName } from '@/theme/theme.types'
import { OpartCardWaves, OpartSectionRule, OpartSummaryWaves, OpartWaves } from '@/theme/decorations/OpartWaves'
import type { DecorationSlot } from './decorations.types'

const OPART_DECORATIONS: Partial<Record<DecorationSlot, ComponentType>> = {
  panelEdge: OpartWaves,
  cardEdge: OpartCardWaves,
  summaryEdge: OpartSummaryWaves,
  sectionRule: OpartSectionRule,
}

/** The theme decorations of each theme (ADR-015, point 9; ADR-025). Every colourway draws the Op-art waves. A theme leaves a slot out to draw nothing there. */
export const DECORATIONS: Readonly<Record<ThemeName, Partial<Record<DecorationSlot, ComponentType>>>> = {
  cobalt: OPART_DECORATIONS,
  forest: OPART_DECORATIONS,
  bordeaux: OPART_DECORATIONS,
}
