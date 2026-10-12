import { Canvas, Picture, Skia, createPicture } from '@shopify/react-native-skia'
import { useMemo } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import type { RecogniseResult } from '@/scanner'
import { CorrectionCell } from '@/scan/components/CorrectionCell'
import { CorrectionPad } from '@/scan/components/CorrectionPad'
import { useCorrectionEdits } from '@/scan/hooks/useCorrectionEdits'
import { panelAt, shiftOf, transitionAt } from '@/scan/utils/transition.utils'
import { drawGridLines, gridLineStyle, type CorrectionLayout } from '@/scan/utils/correction.utils'
import { FAILURE_SLIDE_MS, PANEL_HIDDEN } from './CorrectionScreen.constants'
import { styles } from './CorrectionScreen.styles'
import { GATE_RESULTS } from '@/scan/constants/transition.constants'
import { PANEL_PADDING } from '@/scan/constants/correction.constants'

export type CorrectionProps = {
  result: RecogniseResult | null
  layout: CorrectionLayout
  onRetake: () => void
  /** The transition clock. Without it, everything shows (the review phase). */
  clock?: SharedValue<number>
  reduceMotion?: boolean
  /** True while the results gate holds longer than SPINNER_DELAY. */
  waiting?: SharedValue<boolean>
  /** The clock value when the results gate opened, or -1 before (see sweepShift). */
  resultsAt?: SharedValue<number>
}

export function CorrectionScreen({
  result,
  layout,
  onRetake,
  clock,
  reduceMotion = false,
  waiting,
  resultsAt,
}: CorrectionProps) {
  const { theme } = useUnistyles()
  const { title, grid, panel } = layout
  const failed = result != null && !result.ok
  const cellSize = grid.width / 9

  const { looks, selected, conflicts, toCheck, actions } = useCorrectionEdits(result)
  // The player edits only the finished screen. During the transition the cells are not pressable and show no edit marks.
  const editable = clock == null && result?.ok === true
  const selectedLook = editable && selected !== null ? looks[selected] : undefined
  const conflictCount = conflicts.filter(Boolean).length

  // The picture is made again when the theme changes (ADR-015, point 10).
  const board = useMemo(() => {
    const side = grid.width
    const lines = gridLineStyle(theme)
    // Half the frame width inside each edge, so the canvas does not clip the frame.
    const inset = lines.frameWidth / 2
    // The transition canvas fills the cells with the same token, so nothing jumps at the handoff.
    const cellFill = theme.components.cell.fill
    return createPicture(
      (canvas) => {
        const fill = Skia.Paint()
        fill.setColor(Skia.Color(cellFill))
        canvas.drawRect(Skia.XYWHRect(0, 0, side, side), fill)
        drawGridLines(canvas, Skia.Paint(), [side - 2 * inset, 0, inset, 0, side - 2 * inset, inset, 0, 0], 1, lines)
      },
      { x: 0, y: 0, width: side, height: side },
    )
  }, [grid.width, theme])

  const titleStyle = useAnimatedStyle(() => ({ opacity: clock ? transitionAt(clock.value, reduceMotion).title : 1 }))
  // A failure keeps the results gate closed, so the clock never reaches the panel ramp. The failure panel slides in on its own
  // timing instead, from the moment the clock reaches the results gate (any held clock with Reduce Motion).
  const failureSlide = useSharedValue(0)
  useAnimatedReaction(
    () => failed && (clock == null || reduceMotion || clock.value >= GATE_RESULTS - 1e-6),
    (go, previous) => {
      if (go === previous) return
      failureSlide.set(go ? withTiming(1, { duration: FAILURE_SLIDE_MS }) : 0)
    },
  )
  const panelStyle = useAnimatedStyle(() => {
    let slide = 1
    if (clock) {
      const t = clock.value
      slide = failed ? failureSlide.value : panelAt(t, reduceMotion, shiftOf(t, resultsAt, reduceMotion))
    }
    return { transform: [{ translateY: (1 - slide) * PANEL_HIDDEN * panel.height }] }
  })
  const waitingStyle = useAnimatedStyle(() => ({ opacity: waiting?.value ? 1 : 0 }))

  return (
    <View testID="correction-screen" style={[styles.screen, !clock && styles.screenFilled]}>
      {!clock && (
        <Canvas style={{ position: 'absolute', left: grid.x, top: grid.y, width: grid.width, height: grid.height }}>
          <Picture picture={board} />
        </Canvas>
      )}
      <Animated.View
        pointerEvents="none"
        style={[styles.title, { left: title.x, top: title.y, width: title.width, height: title.height }, titleStyle]}
      >
        <Text style={styles.titleText}>Check the scan</Text>
        <Text style={styles.subtitle}>Tap a cell to fix it</Text>
      </Animated.View>
      {looks.map((look, n) => (
        <CorrectionCell
          // oxlint-disable-next-line react/no-array-index-key -- the index is the cell position, a fixed identity of 81 cells
          key={n}
          n={n}
          look={look}
          size={cellSize}
          left={grid.x + (n % 9) * cellSize}
          top={grid.y + Math.floor(n / 9) * cellSize}
          selected={editable && selected === n}
          conflict={editable && (conflicts[n] ?? false)}
          onSelect={editable ? actions.select : undefined}
          clock={clock}
          resultsAt={resultsAt}
          reduceMotion={reduceMotion}
        />
      ))}
      {result == null && waiting && (
        <Animated.View
          testID="correction-waiting"
          pointerEvents="none"
          style={[styles.waiting, { left: grid.x, top: grid.y, width: grid.width, height: grid.height }, waitingStyle]}
        >
          <ActivityIndicator color={theme.colors.textMuted} />
        </Animated.View>
      )}
      {result != null && (
        <Animated.View
          testID="correction-panel"
          style={[
            styles.panel,
            {
              left: panel.x,
              top: panel.y,
              width: panel.width,
              height: panel.height,
              padding: PANEL_PADDING,
            },
            panelStyle,
          ]}
        >
          {failed ? (
            <View testID="correction-failure" style={styles.failure}>
              <Text style={styles.failureTitle}>The scan failed</Text>
              <Text style={styles.failureReason}>{result.reason}</Text>
            </View>
          ) : selectedLook ? (
            <CorrectionPad
              cell={selected ?? 0}
              look={selectedLook}
              onDigit={actions.setDigit}
              onClear={actions.clear}
              onKind={actions.setKind}
              onDone={actions.deselect}
            />
          ) : (
            <>
              <View style={styles.chips}>
                {conflictCount > 0 && (
                  <View style={[styles.chip, styles.chipConflict]}>
                    <Text
                      style={[styles.chipText, styles.chipConflictText]}
                    >{`● ${conflictCount} givens in conflict`}</Text>
                  </View>
                )}
                {toCheck > 0 ? (
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>{`● ${toCheck} ${toCheck === 1 ? 'cell' : 'cells'} to check`}</Text>
                  </View>
                ) : (
                  conflictCount === 0 && <Text style={styles.sure}>All cells look sure</Text>
                )}
              </View>
              <Pressable
                testID="play"
                accessibilityRole="button"
                accessibilityState={{ disabled: true }}
                disabled
                style={styles.play}
              >
                <Text style={styles.playText}>Play this puzzle</Text>
              </Pressable>
            </>
          )}
          {!selectedLook && (
            <Pressable testID="retake" accessibilityRole="button" onPress={onRetake} hitSlop={8}>
              <Text style={styles.retake}>Retake</Text>
            </Pressable>
          )}
        </Animated.View>
      )}
    </View>
  )
}
