import { Canvas, Picture, Skia, createPicture } from '@shopify/react-native-skia'
import { useMemo, useState } from 'react'
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
import { ScanInspector, ScanTabs } from '@/scan/components/ScanInspector'
import type { InspectorView } from '@/scan/utils/inspector.utils'
import { useCorrectionEdits } from '@/scan/hooks/useCorrectionEdits'
import { panelAt, shiftOf, transitionAt } from '@/scan/utils/transition.utils'
import { drawGridLines, gridLineStyle, type CellLook, type CorrectionLayout } from '@/scan/utils/correction.utils'
import { checkPlay, type ScannedStart } from '@/scan/utils/play.utils'
import { FAILURE_SLIDE_MS, PANEL_HIDDEN, PLAY_BLOCK_TEXT, SAVE_TEXT } from './CorrectionScreen.constants'
import { styles } from './CorrectionScreen.styles'
import { GATE_RESULTS } from '@/scan/constants/transition.constants'
import { PANEL_PADDING } from '@/scan/constants/correction.constants'

export type CorrectionProps = {
  result: RecogniseResult | null
  layout: CorrectionLayout
  onRetake: (looks: readonly CellLook[]) => void
  /** Play this puzzle. Without it, the button stays off: the transition shows the panel but cannot start a game. */
  onPlay?: (start: ScannedStart, looks: readonly CellLook[]) => void
  /** Save the scan with the corrections (development builds). With it, the screen shows Save and not Play, and the tabs of the inspector. */
  onSave?: (looks: readonly CellLook[]) => Promise<boolean>
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
  onPlay,
  onSave,
  clock,
  reduceMotion = false,
  waiting,
  resultsAt,
}: CorrectionProps) {
  const { theme } = useUnistyles()
  const { title, grid, panel } = layout
  const failed = result != null && !result.ok
  const cellSize = grid.width / 9

  const { looks, selected, conflicts, toCheck, grid: corrected, actions } = useCorrectionEdits(result)
  // The player edits only the finished screen. During the transition the cells are not pressable and show no edit marks.
  const editable = clock == null && result?.ok === true
  const selectedLook = editable && selected !== null ? looks[selected] : undefined
  const conflictCount = conflicts.filter(Boolean).length
  // The solver runs once when the pad closes, never per key and never while the transition clock runs.
  const check = useMemo(
    () => (editable && selected === null ? checkPlay(corrected, conflicts) : null),
    [editable, selected, corrected, conflicts],
  )
  const start = check?.ok ? check.start : null
  const blockText = check !== null && !check.ok ? PLAY_BLOCK_TEXT[check.block] : null
  const canPlay = start !== null && onPlay !== undefined

  // The development tools need the photo file, which only a development build saves.
  const devTools = __DEV__ && clock == null && result?.ok === true && result.photoPath != null
  const [view, setView] = useState<InspectorView>('correct')
  const inspectView = devTools && view !== 'correct' ? view : null
  const [saving, setSaving] = useState<{ looks: readonly CellLook[]; status: 'saving' | 'saved' | 'failed' } | null>(
    null,
  )
  // A new edit makes the saved copy old, so Save works again: the status counts only for the looks that it was made for.
  const saveState = saving !== null && saving.looks === looks ? saving.status : 'idle'
  const save = async () => {
    if (!onSave || saveState === 'saving') return
    setSaving({ looks, status: 'saving' })
    setSaving({ looks, status: (await onSave(looks)) ? 'saved' : 'failed' })
  }

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
      {!clock && inspectView === null && (
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
      {inspectView !== null && result?.ok === true && (
        <ScanInspector
          view={inspectView}
          result={result}
          region={{ x: grid.x, y: grid.y, width: grid.width, height: panel.y - grid.y - 8 }}
        />
      )}
      {inspectView === null &&
        looks.map((look, n) => (
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
          {devTools && !failed && !selectedLook && <ScanTabs view={view} onChange={setView} />}
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
              {onSave ? (
                <Pressable
                  testID="save"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: saveState === 'saving' || saveState === 'saved' }}
                  disabled={saveState === 'saving' || saveState === 'saved'}
                  onPress={() => void save()}
                  style={[styles.play, (saveState === 'saving' || saveState === 'saved') && styles.playDisabled]}
                >
                  <Text style={styles.playText}>{SAVE_TEXT[saveState]}</Text>
                </Pressable>
              ) : (
                <>
                  {blockText !== null && (
                    <Text testID="play-blocked" style={styles.blocked}>
                      {blockText}
                    </Text>
                  )}
                  <Pressable
                    testID="play"
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !canPlay }}
                    accessibilityHint={blockText ?? undefined}
                    disabled={!canPlay}
                    onPress={start !== null && onPlay ? () => onPlay(start, looks) : undefined}
                    style={[styles.play, !canPlay && styles.playDisabled]}
                  >
                    <Text style={styles.playText}>Play this puzzle</Text>
                  </Pressable>
                </>
              )}
            </>
          )}
          {!selectedLook && (
            <Pressable testID="retake" accessibilityRole="button" onPress={() => onRetake(looks)} hitSlop={8}>
              <Text style={styles.retake}>Retake</Text>
            </Pressable>
          )}
        </Animated.View>
      )}
    </View>
  )
}
