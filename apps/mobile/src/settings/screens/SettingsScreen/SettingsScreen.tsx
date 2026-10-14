import { Pressable, ScrollView, Text, View } from 'react-native'
import { Icon } from '@/game/components/Icon'
import { ThemeStatusBar } from '@/game/components/ThemeStatusBar'
import { useAssists } from '@/game/hooks/useAssists'
import { AssistPreview } from '@/settings/components/AssistPreview'
import { AssistRow } from '@/settings/components/AssistRow'
import { ThemePicker } from '@/settings/components/ThemePicker'
import { useHaptics } from '@/settings/hooks/useHaptics'
import { useThemePreference } from '@/settings/hooks/useThemePreference'
import { pressedStyles } from '@/theme/pressed.styles'
import { ASSIST_ROWS, HAPTICS_ROW } from './SettingsScreen.constants'
import { styles } from './SettingsScreen.styles'

type SettingsScreenProps = { onBack(): void }

/** The assists, the haptics switch and the theme preference. Each change applies at once, ticks and is saved. */
export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { assists, setAssist } = useAssists()
  const { preference, choose } = useThemePreference()
  const haptics = useHaptics()
  // play runs after the change, so turning haptics on ticks and turning them off is silent.
  const switchHaptics = (on: boolean) => {
    haptics.setOn(on)
    haptics.play('tick')
  }
  return (
    <>
      <ThemeStatusBar />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={onBack}
            style={({ pressed }) => [styles.back, pressed && pressedStyles.pressed]}
          >
            <Icon name="back" tone="text" />
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>
            Settings
          </Text>
        </View>
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Assists
          </Text>
          <Text style={styles.hint}>Turn these off for a raw game.</Text>
        </View>
        <View style={styles.card}>
          <AssistPreview />
          {ASSIST_ROWS.map(({ name, label, description }, index) => (
            <AssistRow
              key={name}
              label={label}
              description={description}
              value={assists[name]}
              divider={index > 0}
              onChange={(on) => {
                haptics.play('tick')
                setAssist(name, on)
              }}
            />
          ))}
        </View>
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Theme
          </Text>
          <ThemePicker
            value={preference}
            onChange={(next) => {
              haptics.play('tick')
              choose(next)
            }}
          />
        </View>
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Feedback
          </Text>
        </View>
        <View style={styles.card}>
          <AssistRow
            label={HAPTICS_ROW.label}
            description={HAPTICS_ROW.description}
            value={haptics.on}
            divider={false}
            onChange={switchHaptics}
          />
        </View>
      </ScrollView>
    </>
  )
}
