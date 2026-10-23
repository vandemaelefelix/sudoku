import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { ScreenHeader } from '@/components/ScreenHeader'
import { ThemeDecoration } from '@/theme/decorations/ThemeDecoration'
import { styles } from './AuthLayout.styles'

type AuthLayoutProps = { title: string; onBack(): void; children: ReactNode }

/** The page of a sign-in screen. It scrolls, so the keyboard never covers the focused field. */
export function AuthLayout({ title, onBack, children }: AuthLayoutProps) {
  return (
    <Screen keyboardAware>
      <ScreenHeader onBack={onBack} />
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <ThemeDecoration slot="sectionRule" />
      </View>
      {children}
    </Screen>
  )
}
