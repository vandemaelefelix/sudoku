import { Pressable, Text, View } from 'react-native'
import Animated, { FadeIn, FadeOut, LinearTransition, ReduceMotion, useAnimatedStyle } from 'react-native-reanimated'
import { LEVELS, type Level } from '@sudoku/core'
import { ThemeStatusBar } from '@/game/components/ThemeStatusBar'
import { useEased } from '@/game/hooks/useEased'
import { LEVEL_LABELS } from '@/constants/level.constants'
import { useIntl } from '@/i18n/hooks/useIntl'
import type { HomeStats } from '@/home/utils/homeStats.utils'
import { StatsCard } from '@/stats/components/StatsCard'
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
  /** The numbers of the stats card. Undefined until the store answers. Null when they do not load. */
  stats: HomeStats | null | undefined
  onNewGame(level: Level): void
  onContinue(): void
  onScan(): void
  onSettings(): void
  onStats(): void
}

/**
 * The menu waits for the game in progress, then fades in with Continue in place, so the level list never jumps down.
 * A later change of Continue fades it, and the list glides to its new place. The stats card fades in when its numbers
 * arrive, because reading the streak grows with the history and must not hold back the menu. The links glide below it.
 */
export function HomeMenu({ continueLevel, stats, onNewGame, onContinue, onScan, onSettings, onStats }: HomeMenuProps) {
  const intl = useIntl()
  const levelName = (level: Level) => intl.formatMessage({ id: LEVEL_LABELS[level] })
  const shown = useEased(continueLevel === undefined ? 0 : 1, MENU_FADE_MS)
  const menuStyle = useAnimatedStyle(() => ({ opacity: shown.get() }))
  // The menu shows once the store answers. The splash ends its exit when this is true.
  useSplashReady(continueLevel !== undefined)
  return (
    <View style={styles.screen}>
      <ThemeStatusBar />
      <Text accessibilityRole="header" style={styles.title}>
        {intl.formatMessage({ id: 'home.title' })}
      </Text>
      <Animated.View testID="home-menu" style={[styles.menu, menuStyle]}>
        {continueLevel != null && (
          <Animated.View entering={CONTINUE_IN} exiting={CONTINUE_OUT}>
            <Pressable
              testID="continue"
              accessibilityRole="button"
              accessibilityLabel={intl.formatMessage({ id: 'home.continueLabel' }, { level: levelName(continueLevel) })}
              onPress={onContinue}
              style={({ pressed }) => [styles.button, styles.continue, pressed && pressedStyles.pressed]}
            >
              <Text style={styles.continueLabel}>{intl.formatMessage({ id: 'home.continue' })}</Text>
              <Text style={styles.continueCaption}>{levelName(continueLevel)}</Text>
            </Pressable>
          </Animated.View>
        )}
        <Animated.View layout={GLIDE} style={styles.menu}>
          <Text accessibilityRole="header" style={styles.section}>
            {intl.formatMessage({ id: 'home.newGame' })}
          </Text>
          {LEVELS.map((level) => (
            <Pressable
              key={level}
              testID={`new-game-${level}`}
              accessibilityRole="button"
              onPress={() => onNewGame(level)}
              style={({ pressed }) => [styles.button, pressed && pressedStyles.pressed]}
            >
              <Text style={styles.label}>{levelName(level)}</Text>
            </Pressable>
          ))}
          {stats != null && (
            <Animated.View entering={CONTINUE_IN} layout={GLIDE}>
              {stats.played === 0 ? (
                <Text style={styles.noStats}>{intl.formatMessage({ id: 'home.noStats' })}</Text>
              ) : (
                <StatsCard winRate={stats.winRate} streak={stats.streak} onPress={onStats} />
              )}
            </Animated.View>
          )}
          <Animated.View layout={GLIDE} style={styles.links}>
            <Pressable
              testID="home-scan"
              accessibilityRole="button"
              onPress={onScan}
              style={({ pressed }) => [styles.button, styles.link, pressed && pressedStyles.pressed]}
            >
              <Text style={styles.label}>{intl.formatMessage({ id: 'home.scan' })}</Text>
            </Pressable>
            <Pressable
              testID="home-settings"
              accessibilityRole="button"
              onPress={onSettings}
              style={({ pressed }) => [styles.button, styles.link, pressed && pressedStyles.pressed]}
            >
              <Text style={styles.label}>{intl.formatMessage({ id: 'home.settings' })}</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </View>
  )
}
