import { useEffect } from 'react'
import { AccessibilityInfo, Pressable, ScrollView, Text, View } from 'react-native'
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { PanelButton } from '@/components/PanelButton'
import { Icon } from '@/game/components/Icon'
import { useGameActions } from '@/game/hooks/useGameActions'
import { hintCardView } from '@/game/utils/hint.utils'
import type { OpenHint } from '@/game/utils/session.utils'
import { easeOut } from '@/utils/motion.utils'
import { CARD_FADE_MS, CLOSE_SLOP, RUNGS, TOP_MAX_SCALE } from './HintCard.constants'
import { styles } from './HintCard.styles'

/**
 * The hint card, in place of the keypad (ADR-032 point 6). It is not modal: the grid stays live. The text scrolls under
 * Dynamic Type, and the buttons stay at the bottom. The card only fades in, so Reduce Motion needs nothing more.
 * VoiceOver reads each new text through an announcement: iOS has no live region.
 */
export function HintCard({ hint }: { hint: OpenHint }) {
  const { hintCard } = useGameActions()
  const { title, text, rung, stepLabel, buttons } = hintCardView(hint)
  const spoken = stepLabel === null ? text : `${stepLabel}. ${text}`
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(spoken)
  }, [spoken])
  const opacity = useSharedValue(0)
  useEffect(() => {
    opacity.set(withTiming(1, { duration: CARD_FADE_MS, easing: easeOut, reduceMotion: ReduceMotion.Never }))
  }, [opacity])
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }))
  return (
    <Animated.View testID="hint-card" style={[styles.card, fadeStyle]}>
      <View style={styles.top}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={TOP_MAX_SCALE} style={styles.title}>
          {title}
        </Text>
        <View style={styles.progress}>
          {stepLabel !== null && (
            <Text maxFontSizeMultiplier={TOP_MAX_SCALE} style={styles.step}>
              {stepLabel}
            </Text>
          )}
          {rung !== null &&
            RUNGS.map((dot) => (
              <View
                key={dot}
                testID={`hint-rung-${dot}${dot <= rung ? '-on' : ''}`}
                style={[styles.dot, dot <= rung && styles.dotOn]}
              />
            ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close the hint"
          hitSlop={CLOSE_SLOP}
          onPress={() => hintCard('hintClose')}
          style={styles.close}
        >
          <Icon name="close" tone="textMuted" />
        </Pressable>
      </View>
      <ScrollView style={styles.textBox}>
        <Text style={styles.text}>{text}</Text>
      </ScrollView>
      <View testID="hint-buttons" style={styles.buttons}>
        {buttons.map((button, index) => (
          <PanelButton
            key={button.action}
            label={button.label}
            kind={index === 0 ? 'primary' : 'second'}
            grow
            compact
            onPress={() => hintCard(button.action)}
          />
        ))}
      </View>
    </Animated.View>
  )
}
