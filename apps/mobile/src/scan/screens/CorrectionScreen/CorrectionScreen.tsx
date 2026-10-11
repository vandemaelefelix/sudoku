import { Canvas, Picture, Skia, createPicture } from '@shopify/react-native-skia'
import { useMemo } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import type { RecogniseResult } from '@/scanner'
import { useColors } from '@/theme/colors'
import { CorrectionCell } from '@/scan/components/CorrectionCell'
import { panelAt, shiftOf, transitionAt } from '@/scan/utils/transition.utils'
import { cellLook, cellsToCheck, drawGridLines, type CorrectionLayout } from '@/scan/utils/correction.utils'
import { FAILURE_SLIDE_MS, PANEL_HIDDEN } from './CorrectionScreen.constants'
import { styles } from './CorrectionScreen.styles'
import { GATE_RESULTS } from '@/scan/constants/transition.constants'

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
  const colors = useColors()
  const { title, grid, panel } = layout
  const failed = result != null && !result.ok
  const cellSize = grid.width / 9

  const looks = useMemo(() => (result?.ok ? result.cells.map(cellLook) : []), [result])
  const toCheck = result?.ok ? cellsToCheck(result.cells) : 0

  // The inset keeps the 2 pt outer box line inside the canvas.
  const board = useMemo(() => {
    const side = grid.width
    return createPicture(
      (canvas) => {
        const fill = Skia.Paint()
        fill.setColor(Skia.Color(colors.surface))
        canvas.drawRect(Skia.XYWHRect(0, 0, side, side), fill)
        drawGridLines(canvas, Skia.Paint(), [side - 2, 0, 1, 0, side - 2, 1, 0, 0], 1, colors.ink, colors.line)
      },
      { x: 0, y: 0, width: side, height: side },
    )
  }, [grid.width, colors])

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
    <View
      testID="correction-screen"
      style={[StyleSheet.absoluteFill, !clock && { backgroundColor: colors.background }]}
    >
      {!clock && (
        <Canvas style={{ position: 'absolute', left: grid.x, top: grid.y, width: grid.width, height: grid.height }}>
          <Picture picture={board} />
        </Canvas>
      )}
      <Animated.View
        pointerEvents="none"
        style={[styles.title, { left: title.x, top: title.y, width: title.width, height: title.height }, titleStyle]}
      >
        <Text style={[styles.titleText, { color: colors.text }]}>Check the scan</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>Tap a digit to fix it</Text>
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
          colors={colors}
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
          <ActivityIndicator color={colors.muted} />
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
              backgroundColor: colors.surface,
              shadowColor: colors.shadow,
            },
            panelStyle,
          ]}
        >
          {failed ? (
            <View testID="correction-failure" style={styles.failure}>
              <Text style={[styles.failureTitle, { color: colors.text }]}>The scan failed</Text>
              <Text style={[styles.failureReason, { color: colors.muted }]}>{result.reason}</Text>
            </View>
          ) : toCheck > 0 ? (
            <View style={[styles.chip, { backgroundColor: colors.warningSurface }]}>
              <Text
                style={[styles.chipText, { color: colors.warningText }]}
              >{`● ${toCheck} ${toCheck === 1 ? 'cell' : 'cells'} to check`}</Text>
            </View>
          ) : (
            <Text style={[styles.sure, { color: colors.muted }]}>All cells look sure</Text>
          )}
          {!failed && (
            <Pressable
              testID="play"
              accessibilityRole="button"
              accessibilityState={{ disabled: true }}
              disabled
              style={[styles.play, { backgroundColor: colors.accent }]}
            >
              <Text style={[styles.playText, { color: colors.onAccent }]}>Play this puzzle</Text>
            </Pressable>
          )}
          <Pressable testID="retake" accessibilityRole="button" onPress={onRetake} hitSlop={8}>
            <Text style={[styles.retake, { color: colors.accent }]}>Retake</Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  )
}
