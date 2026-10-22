import { Pressable, ScrollView, Text, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { AccountSection } from '@/account/components/AccountSection'
import { LinkRow } from '@/components/LinkRow'
import { Icon } from '@/game/components/Icon'
import { ThemeStatusBar } from '@/game/components/ThemeStatusBar'
import { useAssists } from '@/game/hooks/useAssists'
import { AssistPreview } from '@/settings/components/AssistPreview'
import { AppearancePicker } from '@/settings/components/AppearancePicker'
import { LanguagePicker } from '@/settings/components/LanguagePicker'
import { AssistRow } from '@/settings/components/AssistRow'
import { ScanningSection } from '@/settings/components/ScanningSection'
import { SettingsFooter } from '@/settings/components/SettingsFooter'
import { ThemePicker } from '@/settings/components/ThemePicker'
import { useHaptics } from '@/settings/hooks/useHaptics'
import { useThemePreference } from '@/settings/hooks/useThemePreference'
import { TECHNIQUES_TITLE } from '@/techniques/constants/techniques.constants'
import { useIntl } from '@/i18n/hooks/useIntl'
import { useLanguage } from '@/i18n/hooks/useLanguage'
import { ThemeDecoration } from '@/theme/decorations/ThemeDecoration'
import { pressedStyles } from '@/theme/pressed.styles'
import { ASSIST_ROWS, HAPTICS_ROW, TECHNIQUES_ROW } from './SettingsScreen.constants'
import { styles } from './SettingsScreen.styles'

type SettingsScreenProps = { onBack(): void; onSignIn(): void; onTechniques(): void }

/**
 * The assists, the haptics switch, the colourway and the appearance. Each change applies at once, ticks and is saved.
 * The scanning switch comes before the account section, which is there in a build with a Clerk key. The footer shows the version and the ID.
 */
export function SettingsScreen({ onBack, onSignIn, onTechniques }: SettingsScreenProps) {
  const { assists, setAssist } = useAssists()
  const { preference, appearance, choose, chooseAppearance } = useThemePreference()
  const haptics = useHaptics()
  const language = useLanguage()
  const intl = useIntl()
  const { theme } = useUnistyles()
  // play runs after the change, so turning haptics on ticks and turning them off is silent.
  const switchHaptics = (on: boolean) => {
    haptics.setOn(on)
    haptics.play('tick')
  }
  return (
    <>
      <ThemeStatusBar />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        // The scroll bar follows the iOS appearance. The page follows the theme, so the two can differ (ADR-026).
        indicatorStyle={theme.scrollIndicator}
      >
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
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Assists
            </Text>
            <ThemeDecoration slot="sectionRule" />
          </View>
          <Text style={styles.hint}>Turn these off for a raw game.</Text>
        </View>
        <View testID="assist-card" style={styles.card}>
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
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Theme
            </Text>
            <ThemeDecoration slot="sectionRule" />
          </View>
          <ThemePicker
            value={preference}
            onChange={(next) => {
              haptics.play('tick')
              choose(next)
            }}
          />
        </View>
        <View style={styles.section}>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Appearance
            </Text>
            <ThemeDecoration slot="sectionRule" />
          </View>
          <AppearancePicker
            value={appearance}
            onChange={(next) => {
              haptics.play('tick')
              chooseAppearance(next)
            }}
          />
        </View>
        <View style={styles.section}>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              {intl.formatMessage({ id: 'settings.language.title' })}
            </Text>
            <ThemeDecoration slot="sectionRule" />
          </View>
          <LanguagePicker
            value={language.choice}
            onChange={(next) => {
              haptics.play('tick')
              language.choose(next)
            }}
          />
        </View>
        <View style={styles.section}>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Feedback
            </Text>
            <ThemeDecoration slot="sectionRule" />
          </View>
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
        <View style={styles.section}>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Learn
            </Text>
            <ThemeDecoration slot="sectionRule" />
          </View>
        </View>
        <View style={styles.card}>
          <LinkRow
            label={TECHNIQUES_TITLE}
            description={TECHNIQUES_ROW.description}
            divider={false}
            onPress={onTechniques}
          />
        </View>
        <ScanningSection />
        <AccountSection onSignIn={onSignIn} />
        <SettingsFooter />
      </ScrollView>
    </>
  )
}
