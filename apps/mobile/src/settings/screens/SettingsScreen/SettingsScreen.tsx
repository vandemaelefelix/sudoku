import { Pressable, ScrollView, Text, View } from 'react-native'
import { Icon } from '@/game/components/Icon'
import { ThemeStatusBar } from '@/game/components/ThemeStatusBar'
import { useAssists } from '@/game/hooks/useAssists'
import { AssistPreview } from '@/settings/components/AssistPreview'
import { AssistRow } from '@/settings/components/AssistRow'
import { ThemePicker } from '@/settings/components/ThemePicker'
import { useThemePreference } from '@/settings/hooks/useThemePreference'
import { ASSIST_ROWS } from './SettingsScreen.constants'
import { styles } from './SettingsScreen.styles'

type SettingsScreenProps = { onBack(): void }

/** The assists and the theme preference. Each change applies at once and is saved. */
export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { assists, setAssist } = useAssists()
  const { preference, choose } = useThemePreference()
  return (
    <>
      <ThemeStatusBar />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.back}>
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
              onChange={(on) => setAssist(name, on)}
            />
          ))}
        </View>
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Theme
          </Text>
          <ThemePicker value={preference} onChange={choose} />
        </View>
      </ScrollView>
    </>
  )
}
