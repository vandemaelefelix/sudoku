import { useEffect, useRef } from 'react'
import { AccessibilityInfo, Pressable, ScrollView, Text, View } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import type { TechniqueId } from '@sudoku/core'
import { PanelButton } from '@/components/PanelButton'
import { Icon } from '@/components/Icon'
import { HINT_SLIDE } from '@/game/constants/hint.constants'
import { useGameActions } from '@/game/hooks/useGameActions'
import { hintCardView } from '@/game/utils/hint.utils'
import type { OpenHint } from '@/game/utils/hintSession.utils'
import { useIntl } from '@/i18n/hooks/useIntl'
import { pressedStyles } from '@/theme/pressed.styles'
import { easeOut, riseIn, sinkOut } from '@/utils/motion.utils'
import { CLOSE_SLOP, CONTROL_MAX_SCALE, DOT_FILL_MS, RUNGS } from './HintCard.constants'
import { styles } from './HintCard.styles'

type HintCardProps = {
  hint: OpenHint
  /** Opens the page of the technique. Without it, the card has no "Learn more". */
  onLearn?: ((technique: TechniqueId) => void) | undefined
}

/** hint-<action> for the end-to-end flows, such as hint-more for hintMore. */
const testIdOf = (action: string) => `hint-${action.slice('hint'.length).toLowerCase()}`

/**
 * The hint card, in place of the tool row and the keypad (ADR-032, amendment of 2026-10-22). It is not modal: the grid
 * stays live. It covers the whole dock, so its edges line up with the grid and do not move between rungs. It rises in
 * and sinks out, and the text cross-fades. With Reduce Motion, only the fades stay. VoiceOver focus moves to the title when the card opens, because the Hint tool that had it is now
 * hidden. VoiceOver reads each new text through an announcement: iOS has no live region.
 */
export function HintCard({ hint, onLearn }: HintCardProps) {
  const { hintCard } = useGameActions()
  const intl = useIntl()
  const { theme } = useUnistyles()
  const reduceMotion = useReducedMotion()
  const { title, text, rung, stepLabel, buttons, technique } = hintCardView(intl, hint)
  const spoken = stepLabel === null ? text : `${stepLabel}. ${text}`
  const titleRef = useRef<Text>(null)
  useEffect(() => {
    if (titleRef.current) AccessibilityInfo.sendAccessibilityEvent(titleRef.current, 'focus')
  }, [])
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(spoken)
  }, [spoken])
  const filled = useSharedValue(rung ?? 0)
  useEffect(() => {
    const target = rung ?? 0
    const duration = Math.abs(target - filled.get()) * DOT_FILL_MS
    filled.set(withTiming(target, { duration, easing: Easing.linear, reduceMotion: ReduceMotion.Never }))
  }, [rung, filled])
  const slide = reduceMotion ? 0 : HINT_SLIDE
  const fadeIn = FadeIn.duration(theme.motion.short).easing(easeOut).reduceMotion(ReduceMotion.Never)
  const fadeOut = FadeOut.duration(theme.motion.short).easing(easeOut).reduceMotion(ReduceMotion.Never)
  const [main, ...others] = buttons
  const learn = technique !== null && onLearn !== undefined
  const learnLabel = intl.formatMessage({ id: 'hint.button.learnMoreLabel' }, { technique: title })
  return (
    <Animated.View
      testID="hint-card"
      entering={riseIn(0, slide, theme.motion.medium)}
      exiting={sinkOut(slide, theme.motion.medium)}
      style={styles.card}
    >
      <View style={styles.top}>
        <Animated.View key={title} entering={fadeIn} style={styles.titleBox}>
          <Text
            ref={titleRef}
            accessibilityRole="header"
            maxFontSizeMultiplier={CONTROL_MAX_SCALE}
            style={styles.title}
          >
            {title}
          </Text>
        </Animated.View>
        <View style={styles.progress}>
          {stepLabel !== null && (
            <Text maxFontSizeMultiplier={CONTROL_MAX_SCALE} style={styles.step}>
              {stepLabel}
            </Text>
          )}
          {rung !== null && RUNGS.map((dot) => <RungDot key={dot} dot={dot} on={dot <= rung} filled={filled} />)}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={intl.formatMessage({ id: 'hint.close' })}
          hitSlop={CLOSE_SLOP}
          onPress={() => hintCard('hintClose')}
          style={styles.close}
        >
          <Icon name="close" tone="textMuted" />
        </Pressable>
      </View>
      <ScrollView style={styles.textBox}>
        <Animated.View key={text} entering={fadeIn} exiting={fadeOut}>
          <Text
            // VoiceOver reaches the inline link as an action of the text, with the name of the technique.
            accessibilityActions={learn ? [{ name: 'learnMore', label: learnLabel }] : undefined}
            onAccessibilityAction={() => learn && onLearn(technique)}
            style={styles.text}
          >
            {text}
            {learn && (
              <>
                {' '}
                <Text
                  testID="hint-learn"
                  accessibilityRole="link"
                  onPress={() => onLearn(technique)}
                  style={styles.link}
                >
                  {intl.formatMessage({ id: 'hint.button.learnMore' })}
                </Text>
              </>
            )}
          </Text>
        </Animated.View>
      </ScrollView>
      <View testID="hint-buttons" style={styles.buttons}>
        {others.map((button) => (
          <TextButton
            key={button.action}
            testID={testIdOf(button.action)}
            label={button.label}
            onPress={() => hintCard(button.action)}
          />
        ))}
        {main !== undefined && (
          <View style={styles.main}>
            <PanelButton
              testID={testIdOf(main.action)}
              label={main.label}
              kind="primary"
              compact
              onPress={() => hintCard(main.action)}
            />
          </View>
        )}
      </View>
    </Animated.View>
  )
}

type RungDotProps = { dot: number; on: boolean; filled: SharedValue<number> }

/** filled counts the filled dots and eases between rungs, so each dot fills after the one before it. */
function RungDot({ dot, on, filled }: RungDotProps) {
  const fillStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, filled.get() - (dot - 1))) }))
  return (
    <View testID={`hint-rung-${dot}${on ? '-on' : ''}`} style={styles.dot}>
      <Animated.View style={[styles.dotFill, fillStyle]} />
    </View>
  )
}

type TextButtonProps = { testID: string; label: string; onPress(): void }

/** The action next to the main button: the accent text alone, with a touch target of 44 pt. */
function TextButton({ testID, label, onPress }: TextButtonProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.textButton, pressed && pressedStyles.pressed]}
    >
      <Text numberOfLines={1} maxFontSizeMultiplier={CONTROL_MAX_SCALE} style={styles.textButtonText}>
        {label}
      </Text>
    </Pressable>
  )
}
