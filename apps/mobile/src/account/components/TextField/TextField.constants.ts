import { CODE_LENGTH } from '@/account/constants/account.constants'

export type FieldKind = 'email' | 'password' | 'newPassword' | 'code'

type FieldTraits = {
  textContentType: 'username' | 'password' | 'newPassword' | 'oneTimeCode'
  autoComplete: 'email' | 'current-password' | 'new-password' | 'one-time-code'
  keyboardType: 'email-address' | 'default' | 'number-pad'
  secureTextEntry: boolean
  maxLength?: number
}

/** iOS offers the saved email, a strong new password and the code from Mail by these traits. */
export const FIELD_TRAITS: Readonly<Record<FieldKind, FieldTraits>> = {
  email: { textContentType: 'username', autoComplete: 'email', keyboardType: 'email-address', secureTextEntry: false },
  password: {
    textContentType: 'password',
    autoComplete: 'current-password',
    keyboardType: 'default',
    secureTextEntry: true,
  },
  newPassword: {
    textContentType: 'newPassword',
    autoComplete: 'new-password',
    keyboardType: 'default',
    secureTextEntry: true,
  },
  code: {
    textContentType: 'oneTimeCode',
    autoComplete: 'one-time-code',
    keyboardType: 'number-pad',
    secureTextEntry: false,
    maxLength: CODE_LENGTH,
  },
}
