import { Text, View } from 'react-native'
import { AccountSection } from '@/account/components/AccountSection'
import { LinkRow } from '@/components/LinkRow'
import { Screen } from '@/components/Screen'
import { ScreenHeader } from '@/components/ScreenHeader'
import { useAssists } from '@/game/hooks/useAssists'
import { AssistPreview } from '@/settings/components/AssistPreview'
import { AppearancePicker } from '@/settings/components/AppearancePicker'
import { LanguagePicker } from '@/settings/components/LanguagePicker'
import { AssistRow } from '@/settings/components/AssistRow'
import { ScanningSection } from '@/settings/components/ScanningSection'
import { SettingsFooter } from '@/settings/components/SettingsFooter'
import { ThemePicker } from '@/settings/components/ThemePicker'
import { useHaptics } from '@/preferences/hooks/useHaptics'
import { useThemePreference } from '@/settings/hooks/useThemePreference'
import { useIntl } from '@/i18n/hooks/useIntl'
import { useLanguage } from '@/i18n/hooks/useLanguage'
import { ThemeDecoration } from '@/theme/decorations/ThemeDecoration'
import { ASSIST_ROWS } from './SettingsScreen.constants'
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
  // play runs after the change, so turning haptics on ticks and turning them off is silent.
  const switchHaptics = (on: boolean) => {
    haptics.setOn(on)
    haptics.play('tick')
  }
  return (
    <Screen>
      <ScreenHeader title={intl.formatMessage({ id: 'settings.title' })} onBack={onBack} />
      <View style={styles.section}>
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {intl.formatMessage({ id: 'settings.assists.title' })}
          </Text>
          <ThemeDecoration slot="sectionRule" />
        </View>
        <Text style={styles.hint}>{intl.formatMessage({ id: 'settings.assists.hint' })}</Text>
      </View>
      <View testID="assist-card" style={styles.card}>
        <AssistPreview />
        {ASSIST_ROWS.map(({ name, label, description }, index) => (
          <AssistRow
            key={name}
            label={intl.formatMessage({ id: label })}
            description={intl.formatMessage({ id: description })}
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
            {intl.formatMessage({ id: 'settings.theme.title' })}
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
            {intl.formatMessage({ id: 'settings.appearance.title' })}
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
            {intl.formatMessage({ id: 'settings.feedback.title' })}
          </Text>
          <ThemeDecoration slot="sectionRule" />
        </View>
      </View>
      <View style={styles.card}>
        <AssistRow
          label={intl.formatMessage({ id: 'settings.haptics.label' })}
          description={intl.formatMessage({ id: 'settings.haptics.description' })}
          value={haptics.on}
          divider={false}
          onChange={switchHaptics}
        />
      </View>
      <View style={styles.section}>
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {intl.formatMessage({ id: 'settings.learn.title' })}
          </Text>
          <ThemeDecoration slot="sectionRule" />
        </View>
      </View>
      <View style={styles.card}>
        <LinkRow
          label={intl.formatMessage({ id: 'techniques.title' })}
          description={intl.formatMessage({ id: 'settings.learn.techniques' })}
          divider={false}
          onPress={onTechniques}
        />
      </View>
      <ScanningSection />
      <AccountSection onSignIn={onSignIn} />
      <SettingsFooter />
    </Screen>
  )
}
