import { Pressable, Text, View } from 'react-native'
import Animated, { FadeIn, FadeOut, LinearTransition, ReduceMotion, useAnimatedStyle } from 'react-native-reanimated'
import { LEVELS, type Level } from '@sudoku/core'
import { ThemeStatusBar } from '@/game/components/ThemeStatusBar'
import { useEased } from '@/game/hooks/useEased'
import { LEVEL_NAMES } from '@/constants/level.constants'
import { useSplashReady } from '@/splash/hooks/useSplash'
import { pressedStyles } from '@/theme/pressed.styles'
import { easeOut } from '@/utils/motion.utils'
import { MENU_FADE_MS } from './HomeMenu.constants'
import { styles } from './HomeMenu.styles'

// The fades stay with Reduce Motion. The glide moves the list, so Reduce Motion drops it.
const CONTINUE_IN = FadeIn.duration(MENU_FADE_MS).easing(easeOut).reduceMotion(ReduceMotion.Never)
const CONTINUE_OUT = FadeOut.duration(MENU_FADE_MS).easing(easeOut).reduceMotion(ReduceMotion.Never)
const GLIDE = LinearTransition.duration(MENU_FADE_MS).easing(easeOut)

type HomeMenuProps = {
  /** The level of the game in progress. Null when no game is in progress, undefined until the store answers. */
  continueLevel: Level | null | undefined
  onNewGame(level: Level): void
  onContinue(): void
  onScan(): void
  onSettings(): void
}

/**
 * The menu waits for the store, then fades in with Continue in place, so the level list never jumps down.
 * A later change of Continue fades it, and the list glides to its new place.
 */
export function HomeMenu({ continueLevel, onNewGame, onContinue, onScan, onSettings }: HomeMenuProps) {
  const shown = useEased(continueLevel === undefined ? 0 : 1, MENU_FADE_MS)
  const menuStyle = useAnimatedStyle(() => ({ opacity: shown.get() }))
  // The menu shows once the store answers. The splash ends its exit when this is true.
  useSplashReady(continueLevel !== undefined)
  return (
    <View style={styles.screen}>
      <ThemeStatusBar />
      <Text accessibilityRole="header" style={styles.title}>
        Sudoku
      </Text>
      <Animated.View testID="home-menu" style={[styles.menu, menuStyle]}>
        {continueLevel != null && (
          <Animated.View entering={CONTINUE_IN} exiting={CONTINUE_OUT}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Continue, ${LEVEL_NAMES[continueLevel]}`}
              onPress={onContinue}
              style={({ pressed }) => [styles.button, styles.continue, pressed && pressedStyles.pressed]}
            >
              <Text style={styles.continueLabel}>Continue</Text>
              <Text style={styles.continueCaption}>{LEVEL_NAMES[continueLevel]}</Text>
            </Pressable>
          </Animated.View>
        )}
        <Animated.View layout={GLIDE} style={styles.menu}>
          <Text accessibilityRole="header" style={styles.section}>
            New game
          </Text>
          {LEVELS.map((level) => (
            <Pressable
              key={level}
              accessibilityRole="button"
              onPress={() => onNewGame(level)}
              style={({ pressed }) => [styles.button, pressed && pressedStyles.pressed]}
            >
              <Text style={styles.label}>{LEVEL_NAMES[level]}</Text>
            </Pressable>
          ))}
          <View style={styles.links}>
            <Pressable
              accessibilityRole="button"
              onPress={onScan}
              style={({ pressed }) => [styles.button, styles.link, pressed && pressedStyles.pressed]}
            >
              <Text style={styles.label}>Scan a puzzle</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onSettings}
              style={({ pressed }) => [styles.button, styles.link, pressed && pressedStyles.pressed]}
            >
              <Text style={styles.label}>Settings</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  )
}
