import { Image } from 'react-native'
import googleLogo from '@assets/google/google-g.png'
import { AuthButton } from '@/account/components/AuthButton'
import { styles } from './GoogleButton.styles'

type GoogleButtonProps = { busy: boolean; disabled?: boolean; onPress(): void }

/**
 * The button in the outline look of the theme. Google's brand rules fix the colours of the "G", so the logo is a
 * PNG and its colours stay out of the theme.
 */
export function GoogleButton({ busy, disabled = false, onPress }: GoogleButtonProps) {
  return (
    <AuthButton
      label="Continue with Google"
      kind="outline"
      busy={busy}
      disabled={disabled}
      onPress={onPress}
      icon={<Image testID="google-logo" source={googleLogo} style={styles.logo} accessibilityIgnoresInvertColors />}
    />
  )
}
