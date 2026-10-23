import type { ReactNode } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { Icon } from '@/components/Icon'
import { useIntl } from '@/i18n/hooks/useIntl'
import { ThemeStatusBar } from '@/components/ThemeStatusBar'
import { ThemeDecoration } from '@/theme/decorations/ThemeDecoration'
import { pressedStyles } from '@/theme/pressed.styles'
import { styles } from './AuthLayout.styles'

type AuthLayoutProps = { title: string; onBack(): void; children: ReactNode }

/** The page of a sign-in screen. It scrolls, so the keyboard never covers the focused field. */
export function AuthLayout({ title, onBack, children }: AuthLayoutProps) {
  const intl = useIntl()
  const { theme } = useUnistyles()
  return (
    <>
      <ThemeStatusBar />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        indicatorStyle={theme.scrollIndicator}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={intl.formatMessage({ id: 'common.back' })}
            onPress={onBack}
            style={({ pressed }) => [styles.back, pressed && pressedStyles.pressed]}
          >
            <Icon name="back" tone="text" />
          </Pressable>
        </View>
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <ThemeDecoration slot="sectionRule" />
        </View>
        {children}
      </ScrollView>
    </>
  )
}
