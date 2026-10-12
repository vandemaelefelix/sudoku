import { Pressable, Text, View } from 'react-native'
import { LEVELS, type Level } from '@sudoku/core'
import { ThemeStatusBar } from '@/game/components/ThemeStatusBar'
import { LEVEL_NAMES } from '@/constants/level.constants'
import { styles } from './HomeMenu.styles'

type HomeMenuProps = {
  /** The level of the game in progress. Null when no game is in progress. */
  continueLevel: Level | null
  onNewGame(level: Level): void
  onContinue(): void
  onScan(): void
  onSettings(): void
}

export function HomeMenu({ continueLevel, onNewGame, onContinue, onScan, onSettings }: HomeMenuProps) {
  return (
    <View style={styles.screen}>
      <ThemeStatusBar />
      <Text accessibilityRole="header" style={styles.title}>
        Sudoku
      </Text>
      {continueLevel !== null && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Continue, ${LEVEL_NAMES[continueLevel]}`}
          onPress={onContinue}
          style={[styles.button, styles.continue]}
        >
          <Text style={styles.continueLabel}>Continue</Text>
          <Text style={styles.continueCaption}>{LEVEL_NAMES[continueLevel]}</Text>
        </Pressable>
      )}
      <Text accessibilityRole="header" style={styles.section}>
        New game
      </Text>
      {LEVELS.map((level) => (
        <Pressable key={level} accessibilityRole="button" onPress={() => onNewGame(level)} style={styles.button}>
          <Text style={styles.label}>{LEVEL_NAMES[level]}</Text>
        </Pressable>
      ))}
      <View style={styles.links}>
        <Pressable accessibilityRole="button" onPress={onScan} style={[styles.button, styles.link]}>
          <Text style={styles.label}>Scan a puzzle</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onSettings} style={[styles.button, styles.link]}>
          <Text style={styles.label}>Settings</Text>
        </Pressable>
      </View>
    </View>
  )
}
