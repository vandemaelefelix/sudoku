import { Canvas, Picture, Skia, createPicture } from '@shopify/react-native-skia'
import { memo, useMemo } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import type { RecogniseResult } from '@/scanner'
import { useColors, type Colors } from '@/theme/colors'
import { GATE_RESULTS, digitAlpha, panelAt, ringsAt, sweepShift, transitionAt } from '@/scan/transition/timeline'
import { cellLook, cellsToCheck, type CellLook } from './cells'
import { drawGridLines } from './gridLines'
import type { CorrectionLayout } from './layout'

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

const PANEL_HIDDEN = 1.4
/** Milliseconds a failure panel needs to slide up. */
const FAILURE_SLIDE_MS = 300
const RING_INSET = 1.5
/** Points that a digit rises while it fades in. */
const DIGIT_RISE = 3

type Timing = {
  clock?: SharedValue<number> | undefined
  resultsAt?: SharedValue<number> | undefined
  reduceMotion: boolean
}

type CellProps = Timing & { n: number; look: CellLook; size: number; left: number; top: number; colors: Colors }

type RingProps = Timing & { n: number; size: number; left: number; top: number; color: string }

function shiftOf(t: number, resultsAt: SharedValue<number> | undefined, reduceMotion: boolean): number {
  'worklet'
  return resultsAt ? sweepShift(resultsAt.value, t, reduceMotion) : 0
}

const Ring = memo(function Ring({ n, size, left, top, color, clock, resultsAt, reduceMotion }: RingProps) {
  const style = useAnimatedStyle(() => {
    if (!clock) return { opacity: 1 }
    const t = clock.value
    return { opacity: ringsAt(t, reduceMotion, shiftOf(t, resultsAt, reduceMotion)) }
  })
  return (
    <Animated.View
      testID={`correction-ring-${n}`}
      pointerEvents="none"
      style={[
        styles.ring,
        {
          left: left + RING_INSET,
          top: top + RING_INSET,
          width: size - 2 * RING_INSET,
          height: size - 2 * RING_INSET,
          borderColor: color,
        },
        style,
      ]}
    />
  )
})

const Cell = memo(function Cell({ n, look, size, left, top, colors, clock, resultsAt, reduceMotion }: CellProps) {
  const row = Math.floor(n / 9)
  const col = n % 9
  const digitStyle = useAnimatedStyle(() => {
    let alpha = 1
    if (clock) {
      const t = clock.value
      alpha = digitAlpha(t, row, col, reduceMotion, shiftOf(t, resultsAt, reduceMotion))
    }
    return { opacity: alpha, transform: [{ translateY: (1 - alpha) * DIGIT_RISE }] }
  })
  const entry = look.style === 'entry'
  return (
    <>
      <Animated.Text
        testID={`correction-cell-${n}`}
        style={[
          styles.digit,
          {
            left,
            top,
            width: size,
            height: size,
            lineHeight: size,
            fontSize: size * 0.6,
            color: entry ? colors.accent : colors.text,
            fontWeight: entry ? '500' : '600',
          },
          digitStyle,
        ]}
      >
        {look.digit}
      </Animated.Text>
      {look.uncertain && (
        <Ring
          n={n}
          size={size}
          left={left}
          top={top}
          color={colors.warning}
          clock={clock}
          resultsAt={resultsAt}
          reduceMotion={reduceMotion}
        />
      )}
    </>
  )
})

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
        <Cell
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

const styles = StyleSheet.create({
  title: { position: 'absolute', alignItems: 'center', justifyContent: 'center', gap: 2 },
  titleText: { fontSize: 17, fontWeight: '600' },
  subtitle: { fontSize: 13 },
  digit: { position: 'absolute', textAlign: 'center', fontVariant: ['tabular-nums'] },
  ring: { position: 'absolute', borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 6 },
  waiting: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  panel: {
    position: 'absolute',
    borderRadius: 24,
    padding: 12,
    gap: 9,
    justifyContent: 'center',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  chip: { alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999 },
  chipText: { fontSize: 13, fontWeight: '600' },
  sure: { fontSize: 13, fontWeight: '500' },
  play: { alignItems: 'center', paddingVertical: 12, borderRadius: 14, opacity: 0.5 },
  playText: { fontSize: 16, fontWeight: '600' },
  retake: { fontSize: 15, fontWeight: '500', textAlign: 'center' },
  failure: { gap: 4 },
  failureTitle: { fontSize: 16, fontWeight: '600' },
  failureReason: { fontSize: 13 },
})
