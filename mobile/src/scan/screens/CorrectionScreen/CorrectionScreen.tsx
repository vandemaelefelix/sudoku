import { Canvas, Picture, Skia, createPicture } from '@shopify/react-native-skia'
import { useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import Animated, {
  FadeOut,
  LinearTransition,
  useAnimatedReaction,
  useReducedMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUnistyles } from 'react-native-unistyles'
import { PanelButton } from '@/components/PanelButton'
import { LEVEL_LABELS } from '@/constants/level.constants'
import { useIntl } from '@/i18n/hooks/useIntl'
import { Icon } from '@/game/components/Icon'
import { CorrectionCell, type CellConfidence, type DigitSizes } from '@/scan/components/CorrectionCell'
import { CorrectionCheck } from '@/scan/components/CorrectionCheck'
import { CorrectionSummary } from '@/scan/components/CorrectionSummary'
import { CorrectionTile } from '@/scan/components/CorrectionTile'
import { DevMenu } from '@/scan/components/DevMenu'
import { NO_GRID } from '@/scanner'
import type { CaptureSession } from '@/scan/hooks/useCaptureSession'
import { type CorrectionExits, useCorrectionSession } from '@/scan/hooks/useCorrectionSession'
import type { InspectorView } from '@/scan/utils/inspector.utils'
import { swapIn } from '@/scan/utils/swap.utils'
import { panelAt, resultsGateReached, shiftOf, transitionAt } from '@/scan/utils/transition.utils'
import { SWAP_OUT_MS } from '@/scan/constants/swap.constants'
import { easeOut } from '@/utils/motion.utils'
import { cellLook, drawGridLines, gridLineStyle, type CorrectionLayout } from '@/scan/utils/correction.utils'
import { ThemeDecoration } from '@/theme/decorations/ThemeDecoration'
import { SHARED_TYPE } from '@/theme/shared.tokens'
import { pressedStyles } from '@/theme/pressed.styles'
import {
  DIGIT_SHARE,
  FAILURE_SLIDE_MS,
  KIND_TAG,
  WAITING_FADE_MS,
  PANEL_HIDDEN,
  PANEL_RESIZE_MS,
  PLAY_BLOCK_TEXT,
} from './CorrectionScreen.constants'
import { styles } from './CorrectionScreen.styles'
import { PANEL_PADDING } from '@/scan/constants/correction.constants'

export type CorrectionProps = CorrectionExits & {
  /**
   * The capture session. In the capturing phase the clock drives every layer and the results may be null. In the review phase
   * everything shows and the player can edit.
   */
  session: Pick<CaptureSession, 'phase' | 'origin' | 'result' | 'crossFade' | 'clock' | 'waiting' | 'resultsAt'>
  layout: CorrectionLayout
}

// The old content fades out while the new content rises in, so a change of state reads as one motion.
const SWAP_OUT = FadeOut.duration(SWAP_OUT_MS).easing(easeOut)
const PANEL_RESIZE = LinearTransition.duration(PANEL_RESIZE_MS).easing(easeOut)

export function CorrectionScreen({ session: capture, layout, ...exits }: CorrectionProps) {
  // The transition clock exists until the review. In the review, every layer shows and nothing waits.
  const transition = capture.phase === 'review' ? null : capture
  const clock = transition?.clock
  const reduceMotion = transition?.crossFade ?? false
  const waiting = transition?.waiting
  const resultsAt = transition?.resultsAt
  const { theme } = useUnistyles()
  const intl = useIntl()
  const { bottom } = useSafeAreaInsets()
  const systemReduceMotion = useReducedMotion()
  const motion = !(reduceMotion || systemReduceMotion)
  const { bar, title, grid, panel, panelInset } = layout
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

  const correction = useCorrectionSession(capture, exits)
  const { actions, editable, looks, openCell, picking, scan, solution, solved, threshold } = correction
  const open = openCell?.cell ?? null
  const failed = correction.panel === 'failure'
  // A failed import offers another image, not the camera. Without a grid, the panel says what to pick.
  const importFailed = failed && capture.origin === 'library' && exits.onChooseImage !== undefined
  const importNoGrid = importFailed && correction.failure === NO_GRID
  const blockId = correction.block === null ? null : PLAY_BLOCK_TEXT[correction.block]
  const blockText = blockId === null ? null : intl.formatMessage({ id: blockId })
  const heading = intl.formatMessage({ id: solved ? 'scan.correction.solved' : 'scan.correction.title' })
  let failureText = ''
  if (importNoGrid) failureText = intl.formatMessage({ id: 'scan.failure.importReason' })
  else if (failed) {
    failureText = intl.formatMessage({
      id: correction.failure === NO_GRID ? 'scan.failure.noGrid' : 'scan.failure.other',
    })
  }
  const full = correction.fullGrid && {
    ...correction.fullGrid,
    onVerify: actions.verify,
    onScanAnother: actions.scanAnother,
    onHome: exits.onHome,
  }
  // The dev menu belongs to the screen: these switches change what the screen draws, never the scan.
  const devTools = __DEV__ && editable
  const [devOpen, setDevOpen] = useState(false)
  const [view, setView] = useState<InspectorView>('photo')
  const [labelKinds, setLabelKinds] = useState(false)
  const [showConfidence, setShowConfidence] = useState(false)

  const confidences = useMemo<(CellConfidence | null)[] | null>(() => {
    if (!devTools || !showConfidence || scan === null) return null
    return looks.map((look, n) => {
      const read = scan.cells[n]
      if (read === undefined) return null
      const scanned = cellLook(read, threshold)
      const edited = scanned.digit !== look.digit || scanned.style !== look.style
      return {
        tag: KIND_TAG[look.style],
        value: edited ? 'fix' : String(Math.round(read.confidence * 100)),
        low: read.confidence < threshold,
      }
    })
  }, [devTools, showConfidence, scan, looks, threshold])

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
  // The tile of the open cell. An uncertain cell keeps its own ring and fill instead. During the transition no cell is
  // open, and the tile stays away so it never slides with the grid.
  const tile =
    clock !== undefined || open === null || looks[open]?.uncertain !== false
      ? null
      : { left: grid.x + (open % 9) * cellSize, top: grid.y + Math.floor(open / 9) * cellSize, size: cellSize }
  const gridBox = { position: 'absolute', left: grid.x, top: grid.y, width: grid.width, height: grid.height } as const
  // The board and the lines mount with the transition and stay hidden under it. A new Skia canvas is blank until a later
  // display frame, so a canvas that mounted at the end of the transition would blink.
  const boardBox = [gridBox, { opacity: clock ? 0 : 1 }]

  const titleStyle = useAnimatedStyle(() => ({ opacity: clock ? transitionAt(clock.value, reduceMotion).title : 1 }))
  // A failure keeps the results gate closed, so the clock never reaches the panel ramp. The failure panel slides in on its own
  // timing instead, from the moment the clock reaches the results gate (any held clock with Reduce Motion).
  const failureSlide = useSharedValue(0)
  useAnimatedReaction(
    () => failed && resultsGateReached(clock?.value, reduceMotion),
    (go, previous) => {
      if (go === previous) return
      failureSlide.set(go ? withTiming(1, { duration: FAILURE_SLIDE_MS, easing: easeOut }) : 0)
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
  const waitingStyle = useAnimatedStyle(() => ({
    opacity: withTiming(waiting?.value ? 1 : 0, { duration: WAITING_FADE_MS, easing: easeOut }),
  }))
  const largeTitle = title.height > 0

  return (
    <View testID="correction-screen" style={[styles.screen, !clock && styles.screenFilled]}>
      <Canvas testID="correction-board" style={boardBox}>
        <Picture picture={board} />
      </Canvas>
      <Animated.View
        pointerEvents={correction.panel === null ? 'none' : 'box-none'}
        style={[styles.bar, { left: bar.x, top: bar.y, width: bar.width, height: bar.height }, titleStyle]}
      >
        <Pressable
          testID="retake"
          accessibilityRole="button"
          accessibilityLabel={intl.formatMessage({ id: 'scan.correction.retakeLabel' })}
          onPress={actions.retake}
          hitSlop={8}
          style={({ pressed }) => [styles.retake, pressed && pressedStyles.pressed]}
        >
          <Icon name="back" tone="text" />
          <Text style={styles.retakeText}>{intl.formatMessage({ id: 'scan.correction.retake' })}</Text>
        </Pressable>
        {!largeTitle && (
          <Text accessibilityRole="header" style={styles.barTitle}>
            {heading}
          </Text>
        )}
        <View style={styles.barEnd}>
          {devTools && (
            <Pressable
              testID="dev-open"
              accessibilityRole="button"
              accessibilityLabel={intl.formatMessage({ id: 'scan.correction.devMenu' })}
              onPress={() => setDevOpen(true)}
              style={({ pressed }) => [styles.wrench, pressed && pressedStyles.pressed]}
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
            {heading}
          </Text>
        </Animated.View>
      )}
      <CorrectionTile rect={tile} />
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
          conflict={correction.conflictCells.has(n)}
          hint={String(correction.hints[n] ?? '')}
          pulse={correction.celebrated ? correction.pulse : undefined}
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
      {correction.panel === null && waiting && (
        <Animated.View
          testID="correction-waiting"
          pointerEvents="none"
          style={[styles.waiting, { left: grid.x, top: grid.y, width: grid.width, height: grid.height }, waitingStyle]}
        >
          <ActivityIndicator color={theme.colors.textMuted} />
        </Animated.View>
      )}
      {correction.panel !== null && (
        <Animated.View
          testID="correction-panel"
          // The keypad makes the panel taller. The panel grows to it instead of jumping.
          {...(motion ? { layout: PANEL_RESIZE } : {})}
          style={[styles.panel, { left: panel.x, width: panel.width, minHeight: panel.height }, panelStyle]}
        >
          {!(openCell && picking) && <ThemeDecoration slot="panelEdge" />}
          <View
            style={[
              styles.panelBody,
              {
                padding: PANEL_PADDING,
                paddingHorizontal: PANEL_PADDING + panelInset,
                paddingTop: PANEL_PADDING - 4,
                paddingBottom: bottom + PANEL_PADDING,
              },
            ]}
          >
            <Animated.View
              // A new key mounts new content, so each state change plays the swap. The next cell keeps the key:
              // the panel stays and CorrectionCheck moves its content to the new cell.
              key={correction.panel}
              {...(clock || !motion ? {} : { entering: swapIn, exiting: SWAP_OUT })}
            >
              {correction.panel === 'failure' ? (
                <View testID="correction-failure" style={styles.failure}>
                  <Text style={styles.failureTitle}>
                    {intl.formatMessage({ id: importNoGrid ? 'scan.failure.importTitle' : 'scan.failure.title' })}
                  </Text>
                  <Text style={styles.failureReason}>{failureText}</Text>
                  {importFailed ? (
                    <PanelButton
                      testID="choose-another"
                      label={intl.formatMessage({ id: 'scan.failure.chooseAnother' })}
                      kind="primary"
                      onPress={actions.chooseImage}
                    />
                  ) : (
                    <PanelButton
                      testID="retake-failure"
                      label={intl.formatMessage({ id: 'scan.correction.retake' })}
                      kind="primary"
                      onPress={actions.retake}
                    />
                  )}
                </View>
              ) : openCell !== null && correction.panel !== 'summary' ? (
                <CorrectionCheck
                  cell={openCell.cell}
                  look={openCell.look}
                  looks={looks}
                  flow={correction.flow}
                  picking={picking}
                  image={correction.image}
                  hint={correction.hint}
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
                  toCheck={correction.toCheck}
                  conflictCount={correction.conflictCount}
                  level={correction.level === null ? '' : intl.formatMessage({ id: LEVEL_LABELS[correction.level] })}
                  blockText={blockText}
                  canPlay={correction.canPlay}
                  animate={!clock && motion}
                  canSolve={correction.canSolve}
                  solutionShown={solution !== null}
                  full={full}
                  onStartCheck={actions.startCheck}
                  onPlay={correction.canPlay ? actions.play : undefined}
                  onToggleSolve={actions.toggleSolution}
                />
              )}
            </Animated.View>
          </View>
        </Animated.View>
      )}
      {devTools && scan !== null && (
        <DevMenu
          visible={devOpen}
          onClose={() => setDevOpen(false)}
          result={scan}
          view={view}
          onView={setView}
          labelKinds={labelKinds}
          onLabelKinds={setLabelKinds}
          showConfidence={showConfidence}
          onShowConfidence={setShowConfidence}
          threshold={threshold}
          onThreshold={correction.setThreshold}
          saveState={correction.saveState}
          onSave={correction.canSave ? actions.save : undefined}
        />
      )}
    </View>
  )
}
