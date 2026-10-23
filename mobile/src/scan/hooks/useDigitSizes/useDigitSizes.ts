import { useMemo } from 'react'
import { useUnistyles } from 'react-native-unistyles'
import type { DigitSizes } from '@/scan/components/CorrectionCell'
import { SHARED_TYPE } from '@/theme/shared.tokens'
import { DIGIT_SHARE } from './useDigitSizes.constants'

/**
 * The digit sizes of the cells. A theme sets them relative to the system font: a serif given needs more size than a sans entry to
 * look as large.
 */
export function useDigitSizes(cellSize: number): DigitSizes {
  const { theme } = useUnistyles()
  const { given: givenRole, entry: entryRole } = theme.type
  const baseScale = SHARED_TYPE.given.scale
  return useMemo<DigitSizes>(
    () => ({
      given: cellSize * DIGIT_SHARE * (givenRole.scale / baseScale),
      entry: cellSize * DIGIT_SHARE * (entryRole.scale / baseScale),
    }),
    [cellSize, givenRole.scale, entryRole.scale, baseScale],
  )
}
