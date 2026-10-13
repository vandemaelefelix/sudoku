import type { SkImage } from '@shopify/react-native-skia'
import { Pressable, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import type { Digit } from '@sudoku/core'
import { Icon } from '@/game/components/Icon'
import { CellCrop } from '@/scan/components/CellCrop'
import { CorrectionPad } from '@/scan/components/CorrectionPad'
import { PanelButton } from '@/scan/components/PanelButton'
import type { CellLook, CellStyle } from '@/scan/utils/correction.utils'
import { cellPlace, panelQuestion, yesLabel } from '@/scan/utils/correctionEdit.utils'
import { KIND_LABELS, TEXT_FADE_MS } from './CorrectionCheck.constants'
import { styles } from './CorrectionCheck.styles'

type CorrectionCheckProps = {
  /** The open cell, row-major. */
  cell: number
  look: CellLook
  /** All 81 looks, for the progress dots. */
  looks: readonly CellLook[]
  /** The cells the scanner was unsure of, in reading order. */
  flow: readonly number[]
  /** True: the pick state (the keypad). False: the check state (No and Yes). */
  picking: boolean
  /** The flattened grid, for the crop. */
  image: SkImage | undefined
  /** The second guess of the model for this cell, or null. */
  hint: number | null
  /** Dev builds: the Printed, Handwritten, Notes and Empty labels. */
  labelKinds: boolean
  /** Move to a new cell with motion: the crop pans, and the text and the Yes label fade. False with Reduce Motion. */
  animate: boolean
  onClose(): void
  onYes(): void
  onNo(): void
  onDigit(digit: Digit): void
  onClear(): void
  onKind(style: CellStyle): void
}

/** The check state and the pick state of the correction panel: one cell, its crop and the question about it. */
export function CorrectionCheck({
  cell,
  look,
  looks,
  flow,
  picking,
  image,
  hint,
  labelKinds,
  animate,
  onClose,
  onYes,
  onNo,
  onDigit,
  onClear,
  onKind,
}: CorrectionCheckProps) {
  const done = flow.filter((n) => !looks[n]?.uncertain).length
  return (
    <View testID="correction-check" style={styles.check}>
      {look.uncertain && (
        <View
          testID="correction-progress"
          accessible
          accessibilityRole="image"
          accessibilityLabel={`${done} of ${flow.length} cells checked`}
          style={styles.progress}
        >
          {flow.map((n) => (
            <View key={n} style={[styles.dot, !looks[n]?.uncertain && styles.dotDone, n === cell && styles.dotNow]} />
          ))}
        </View>
      )}
      <View style={styles.head}>
        <CellCrop image={image} cell={cell} animate={animate} />
        {/* The key is the cell, so the text of the next cell fades in. The panel itself stays. */}
        <Animated.View key={cell} {...(animate ? { entering: FadeIn.duration(TEXT_FADE_MS) } : {})} style={styles.text}>
          <Text testID="correction-question" style={styles.question}>
            {panelQuestion(look, picking)}
          </Text>
          <Text style={styles.place}>{cellPlace(cell)}</Text>
        </Animated.View>
        <Pressable
          testID="correction-close"
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={styles.close}
        >
          <Icon name="close" tone="textMuted" />
        </Pressable>
      </View>
      {labelKinds && (
        <View testID="correction-kinds" accessibilityRole="radiogroup" style={styles.kinds}>
          {KIND_LABELS.map(({ style, label }) => {
            const on = look.style === style
            return (
              <Pressable
                key={style}
                testID={`correction-kind-${style}`}
                accessibilityRole="radio"
                accessibilityLabel={label}
                accessibilityState={{ checked: on }}
                onPress={() => onKind(style)}
                style={[styles.kind, on && styles.kindOn]}
              >
                <Text style={[styles.kindText, on && styles.kindTextOn]}>{label}</Text>
              </Pressable>
            )
          })}
        </View>
      )}
      {picking ? (
        <CorrectionPad
          cell={cell}
          look={look}
          hint={look.uncertain ? hint : null}
          onDigit={onDigit}
          onClear={onClear}
        />
      ) : (
        <View style={styles.answers}>
          <PanelButton testID="correction-no" label="No" kind="second" grow onPress={onNo} />
          <PanelButton
            testID="correction-yes"
            label={yesLabel(look)}
            kind="primary"
            grow
            animateLabel={animate}
            onPress={onYes}
          />
        </View>
      )}
    </View>
  )
}
