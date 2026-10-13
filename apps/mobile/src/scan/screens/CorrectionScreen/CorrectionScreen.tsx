import { Canvas, Picture, Skia, createPicture } from '@shopify/react-native-skia'
import { useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import Animated, {
  Easing,
  LinearTransition,
  useAnimatedReaction,
  useReducedMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type EntryAnimationsValues,
  type LayoutAnimation,
  type SharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUnistyles } from 'react-native-unistyles'
import type { RecogniseResult } from '@/scanner'
import { LEVEL_NAMES } from '@/constants/level.constants'
import { Icon } from '@/game/components/Icon'
import { CorrectionCell, type CellConfidence, type DigitSizes } from '@/scan/components/CorrectionCell'
import { CorrectionCheck } from '@/scan/components/CorrectionCheck'
import { CorrectionSummary } from '@/scan/components/CorrectionSummary'
import { DevMenu, type SaveState } from '@/scan/components/DevMenu'
import { PanelButton } from '@/scan/components/PanelButton'
import { useCorrectionEdits } from '@/scan/hooks/useCorrectionEdits'
import type { InspectorView } from '@/scan/utils/inspector.utils'
import { panelAt, shiftOf, transitionAt } from '@/scan/utils/transition.utils'
import {
  cellLook,
  drawGridLines,
  gridLineStyle,
  type CellLook,
  type CorrectionLayout,
} from '@/scan/utils/correction.utils'
import { checkPlay, levelOf, type ScannedStart } from '@/scan/utils/play.utils'
import { ThemeDecoration } from '@/theme/decorations/ThemeDecoration'
import { SHARED_TYPE } from '@/theme/shared.tokens'
import {
  DIGIT_SHARE,
  FAILURE_SLIDE_MS,
  KIND_TAG,
  PANEL_HIDDEN,
  PANEL_RESIZE_MS,
  SWAP_MS,
  SWAP_RISE,
  PLAY_BLOCK_TEXT,
  TITLE,
} from './CorrectionScreen.constants'
import { styles } from './CorrectionScreen.styles'
import { GATE_RESULTS } from '@/scan/constants/transition.constants'
import { PANEL_PADDING, REVIEW_CONFIDENCE } from '@/scan/constants/correction.constants'

export type CorrectionProps = {
  result: RecogniseResult | null
  layout: CorrectionLayout
  onRetake: (looks: readonly CellLook[]) => void
  /** Play this puzzle. Without it, the button stays off: the transition shows the panel but cannot start a game. */
  onPlay?: (start: ScannedStart, looks: readonly CellLook[]) => void
  /** Save the scan with the corrections (development builds). With it, the dev menu shows Save. */
  onSave?: (looks: readonly CellLook[]) => Promise<boolean>
  /** The transition clock. Without it, everything shows (the review phase). */
  clock?: SharedValue<number>
  reduceMotion?: boolean
  /** True while the results gate holds longer than SPINNER_DELAY. */
  waiting?: SharedValue<boolean>
  /** The clock value when the results gate opened, or -1 before (see sweepShift). */
  resultsAt?: SharedValue<number>
}

/** The new content of the panel fades in and rises a little, so a change of state reads as one motion. */
function swapIn(_values: EntryAnimationsValues): LayoutAnimation {
  'worklet'
  const timing = { duration: SWAP_MS, easing: Easing.out(Easing.cubic) }
  return {
    initialValues: { opacity: 0, transform: [{ translateY: SWAP_RISE }] },
    animations: { opacity: withTiming(1, timing), transform: [{ translateY: withTiming(0, timing) }] },
  }
}

const PANEL_RESIZE = LinearTransition.duration(PANEL_RESIZE_MS).easing(Easing.out(Easing.cubic))

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
  const { bottom } = useSafeAreaInsets()
  const systemReduceMotion = useReducedMotion()
  const motion = !(reduceMotion || systemReduceMotion)
  const { bar, title, grid, panel } = layout
  const failed = result != null && !result.ok
  const ok = result?.ok === true ? result : null
  const cellSize = grid.width / 9
  // A theme sets its digit sizes relative to the system font: a serif given needs more size than a sans entry to look as large.
  const { given: givenRole, entry: entryRole } = theme.type
  const baseScale = SHARED_TYPE.given.scale
  const digitSizes = useMemo<DigitSizes>(
    () => ({
      given: cellSize * DIGIT_SHARE * (givenRole.scale / baseScale),
      entry: cellSize * DIGIT_SHARE * (entryRole.scale / baseScale),
    }),
    [cellSize, givenRole.scale, entryRole.scale, baseScale],
  )

  // The ring threshold of the dev menu. It is not saved: a new scan starts at REVIEW_CONFIDENCE.
  const [threshold, setThreshold] = useState(REVIEW_CONFIDENCE)
  const {
    looks,
    selected,
    picking,
    conflicts,
    toCheck,
    flow,
    grid: corrected,
    actions,
  } = useCorrectionEdits(result, threshold)
  // The player edits only the finished screen. During the transition the cells are not pressable and show no edit marks.
  const editable = clock == null && ok !== null
  const open = editable && selected !== null ? selected : null
  const openLook = open === null ? undefined : looks[open]
  const conflictCount = conflicts.filter(Boolean).length
  // The solver runs when the panel shows the summary, never per key and never while the transition clock runs.
  const check = useMemo(
    () => (editable && selected === null ? checkPlay(corrected, conflicts) : null),
    [editable, selected, corrected, conflicts],
  )
  const start = check?.ok ? check.start : null
  const blockText = check !== null && !check.ok ? PLAY_BLOCK_TEXT[check.block] : null
  const canPlay = start !== null && onPlay !== undefined

  // The solution shows until the next edit: it belongs to the looks it was shown for.
  const [solutionFor, setSolutionFor] = useState<readonly CellLook[] | null>(null)
  const solution = start !== null && solutionFor === looks ? start.puzzle.solution : null

  const devTools = __DEV__ && editable
  const [devOpen, setDevOpen] = useState(false)
  const [view, setView] = useState<InspectorView>('photo')
  const [labelKinds, setLabelKinds] = useState(false)
  const [showConfidence, setShowConfidence] = useState(false)
  const [saving, setSaving] = useState<{ looks: readonly CellLook[]; status: Exclude<SaveState, 'idle'> } | null>(null)
  // A new edit makes the saved copy old, so Save works again: the status counts only for the looks that it was made for.
  const saveState: SaveState = saving !== null && saving.looks === looks ? saving.status : 'idle'
  const save = async () => {
    if (!onSave || saveState === 'saving') return
    setSaving({ looks, status: 'saving' })
    setSaving({ looks, status: (await onSave(looks)) ? 'saved' : 'failed' })
  }

  const confidences = useMemo<(CellConfidence | null)[] | null>(() => {
    if (!devTools || !showConfidence || ok === null) return null
    return looks.map((look, n) => {
      const read = ok.cells[n]
      if (read === undefined) return null
      const scanned = cellLook(read, threshold)
      const edited = scanned.digit !== look.digit || scanned.style !== look.style
      return {
        tag: KIND_TAG[look.style],
        value: edited ? 'fix' : String(Math.round(read.confidence * 100)),
        low: read.confidence < threshold,
      }
    })
  }, [devTools, showConfidence, ok, looks, threshold])

  // The pictures are made again when the theme changes (ADR-015, point 10). The cell fill lies under the cells and the lines lie
  // over them, so the fill of an open or conflicting cell never covers a grid line.
  const { board, lines } = useMemo(() => {
    const side = grid.width
    const lineStyle = gridLineStyle(theme)
    // Half the frame width inside each edge, so the canvas does not clip the frame.
    const inset = lineStyle.frameWidth / 2
    // The transition canvas fills the cells with the same token, so nothing jumps at the handoff.
    const cellFill = theme.components.cell.fill
    const bounds = { x: 0, y: 0, width: side, height: side }
    return {
      board: createPicture((canvas) => {
        const fill = Skia.Paint()
        fill.setColor(Skia.Color(cellFill))
        canvas.drawRect(Skia.XYWHRect(0, 0, side, side), fill)
      }, bounds),
      lines: createPicture(
        (canvas) =>
          drawGridLines(
            canvas,
            Skia.Paint(),
            [side - 2 * inset, 0, inset, 0, side - 2 * inset, inset, 0, 0],
            1,
            lineStyle,
          ),
        bounds,
      ),
    }
  }, [grid.width, theme])
  const gridBox = { position: 'absolute', left: grid.x, top: grid.y, width: grid.width, height: grid.height } as const
  // The board and the lines mount with the transition and stay hidden under it. A new Skia canvas is blank until a later
  // display frame, so a canvas that mounted at the end of the transition would blink.
  const boardBox = [gridBox, { opacity: clock ? 0 : 1 }]

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
  const largeTitle = title.height > 0

  return (
    <View testID="correction-screen" style={[styles.screen, !clock && styles.screenFilled]}>
      <Canvas testID="correction-board" style={boardBox}>
        <Picture picture={board} />
      </Canvas>
      <Animated.View
        pointerEvents={result == null ? 'none' : 'box-none'}
        style={[styles.bar, { left: bar.x, top: bar.y, width: bar.width, height: bar.height }, titleStyle]}
      >
        <Pressable
          testID="retake"
          accessibilityRole="button"
          accessibilityLabel="Retake the photo"
          onPress={() => onRetake(looks)}
          hitSlop={8}
          style={styles.retake}
        >
          <Icon name="back" tone="text" />
          <Text style={styles.retakeText}>Retake</Text>
        </Pressable>
        {!largeTitle && (
          <Text accessibilityRole="header" style={styles.barTitle}>
            {TITLE}
          </Text>
        )}
        <View style={styles.barEnd}>
          {devTools && (
            <Pressable
              testID="dev-open"
              accessibilityRole="button"
              accessibilityLabel="Developer menu"
              onPress={() => setDevOpen(true)}
              style={styles.wrench}
            >
              <Icon name="wrench" tone="textMuted" />
            </Pressable>
          )}
        </View>
      </Animated.View>
      {largeTitle && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.titleBlock,
            { left: title.x, top: title.y, width: title.width, height: title.height },
            titleStyle,
          ]}
        >
          <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit style={styles.display}>
            {TITLE}
          </Text>
          <ThemeDecoration slot="titleMark" />
        </Animated.View>
      )}
      {looks.map((look, n) => (
        <CorrectionCell
          // oxlint-disable-next-line react/no-array-index-key -- the index is the cell position, a fixed identity of 81 cells
          key={n}
          n={n}
          look={look}
          size={cellSize}
          digitSizes={digitSizes}
          left={grid.x + (n % 9) * cellSize}
          top={grid.y + Math.floor(n / 9) * cellSize}
          selected={open === n}
          conflict={editable && (conflicts[n] ?? false)}
          solution={solution === null || look.digit !== '' ? '' : String(solution[n] ?? '')}
          confidence={confidences?.[n] ?? null}
          onSelect={editable ? actions.select : undefined}
          clock={clock}
          resultsAt={resultsAt}
          reduceMotion={reduceMotion}
        />
      ))}
      <Canvas testID="correction-lines" pointerEvents="none" style={boardBox}>
        <Picture picture={lines} />
      </Canvas>
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
          // The keypad makes the panel taller. The panel grows to it instead of jumping.
          {...(motion ? { layout: PANEL_RESIZE } : {})}
          style={[styles.panel, { left: panel.x, width: panel.width, minHeight: panel.height }, panelStyle]}
        >
          {!(openLook && picking) && <ThemeDecoration slot="panelEdge" />}
          <View
            style={[
              styles.panelBody,
              { padding: PANEL_PADDING, paddingTop: PANEL_PADDING - 4, paddingBottom: bottom + PANEL_PADDING },
            ]}
          >
            <Animated.View
              // A new key mounts new content, so each state change plays the swap. The next cell keeps the key:
              // the panel stays and CorrectionCheck moves its content to the new cell.
              key={result.ok === false ? 'failure' : open === null ? 'summary' : picking ? 'pick' : 'check'}
              {...(clock || !motion ? {} : { entering: swapIn })}
            >
              {result.ok === false ? (
                <View testID="correction-failure" style={styles.failure}>
                  <Text style={styles.failureTitle}>The scan failed</Text>
                  <Text style={styles.failureReason}>{result.reason}</Text>
                  <PanelButton testID="retake-failure" label="Retake" kind="primary" onPress={() => onRetake(looks)} />
                </View>
              ) : open !== null && openLook ? (
                <CorrectionCheck
                  cell={open}
                  look={openLook}
                  looks={looks}
                  flow={flow}
                  picking={picking}
                  image={result.flatImage}
                  hint={result.cells[open]?.second ?? null}
                  labelKinds={devTools && labelKinds}
                  animate={motion}
                  onClose={actions.close}
                  onYes={actions.yes}
                  onNo={actions.no}
                  onDigit={actions.setDigit}
                  onClear={actions.clear}
                  onKind={actions.setKind}
                />
              ) : (
                <CorrectionSummary
                  toCheck={toCheck}
                  conflictCount={editable ? conflictCount : 0}
                  level={LEVEL_NAMES[levelOf(corrected.givens)]}
                  blockText={blockText}
                  canPlay={canPlay}
                  canSolve={start !== null}
                  solutionShown={solution !== null}
                  onStartCheck={actions.startCheck}
                  onPlay={start !== null && onPlay ? () => onPlay(start, looks) : undefined}
                  onToggleSolve={() => setSolutionFor(solution === null ? looks : null)}
                />
              )}
            </Animated.View>
          </View>
        </Animated.View>
      )}
      {devTools && ok !== null && (
        <DevMenu
          visible={devOpen}
          onClose={() => setDevOpen(false)}
          result={ok}
          view={view}
          onView={setView}
          labelKinds={labelKinds}
          onLabelKinds={setLabelKinds}
          showConfidence={showConfidence}
          onShowConfidence={setShowConfidence}
          threshold={threshold}
          onThreshold={setThreshold}
          saveState={saveState}
          onSave={onSave && ok.photoPath != null ? () => void save() : undefined}
        />
      )}
    </View>
  )
}
