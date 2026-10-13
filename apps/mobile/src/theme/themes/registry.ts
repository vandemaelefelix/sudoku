import type { Theme, ThemeName } from '@/theme/theme.types'
import { daylight } from '@/theme/themes/daylight'
import { midnight } from '@/theme/themes/midnight'
import { opart } from '@/theme/themes/opart'
import { progressive } from '@/theme/themes/progressive'

/** Every theme, in the order of the Settings picker. To add a theme, add its folder and one line here (ADR-021). */
export const THEMES: Readonly<Record<ThemeName, Theme>> = { daylight, midnight, opart, progressive }

export const THEME_NAMES = Object.keys(THEMES) as readonly ThemeName[]
