import { fireEvent, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import { okResult, review } from '@/scan/scanTestKit'
import type { CaptureResult } from '@/scan/utils/captureResult.utils'
import { correctionLayout } from '@/scan/utils/correction.utils'
import { CorrectionScreen } from './CorrectionScreen'

export const layout = correctionLayout({ width: 402, height: 874 }, { top: 62, bottom: 34, left: 0, right: 0 })

export const given = { digit: 5, kind: 'printed', confidence: 1 } as const
export const entry = { digit: 7, kind: 'handwritten', confidence: 1 } as const
export const shaky = (digit: number, confidence: number, second = 1) =>
  ({ digit, kind: 'printed', confidence, second }) as const

export const style = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style)
export const press = (testID: string) => fireEvent.press(screen.getByTestId(testID))
export const clock = (value: number) => ({ value }) as SharedValue<number>

/** The entering animation of the nearest element, the node itself or above it, that takes one. */
export const entering = (node: ReturnType<typeof screen.getByTestId> | null): unknown => {
  for (let at = node; at; at = at.parent) if ('entering' in at.props) return at.props.entering
  return undefined
}

/** The screen in the review of a result, with no exits but Retake. */
export const ui = (result: CaptureResult) => (
  <CorrectionScreen session={review(result)} layout={layout} onRetake={jest.fn()} />
)

// Three cells to check, in reading order: 3, 40 and 70.
export const flowScan = () => okResult({ 0: given, 3: shaky(4, 0.5, 9), 40: shaky(2, 0.6), 70: { confidence: 0.4 } })
