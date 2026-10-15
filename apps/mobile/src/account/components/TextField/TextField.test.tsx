import { fireEvent, render, screen } from '@testing-library/react-native'
import { AccessibilityInfo, StyleSheet } from 'react-native'
import { cobalt } from '@/theme/themes/cobalt'
import { TextField } from './TextField'

it('shows a visible label and gives it to VoiceOver', () => {
  render(<TextField label="Email" kind="email" value="" onChangeText={jest.fn()} />)
  expect(screen.getByText('Email', { includeHiddenElements: true })).toBeTruthy()
  expect(screen.getByLabelText('Email')).toBeTruthy()
})

it('asks iOS to fill the email, the new password and the email code', () => {
  render(
    <>
      <TextField label="Email" kind="email" value="" onChangeText={jest.fn()} />
      <TextField label="Password" kind="newPassword" value="" onChangeText={jest.fn()} />
      <TextField label="Code" kind="code" value="" onChangeText={jest.fn()} />
    </>,
  )
  expect(screen.getByLabelText('Email').props).toMatchObject({
    textContentType: 'username',
    autoComplete: 'email',
    keyboardType: 'email-address',
    autoCapitalize: 'none',
    autoCorrect: false,
  })
  expect(screen.getByLabelText('Password').props).toMatchObject({
    textContentType: 'newPassword',
    secureTextEntry: true,
  })
  expect(screen.getByLabelText('Code').props).toMatchObject({
    textContentType: 'oneTimeCode',
    keyboardType: 'number-pad',
    maxLength: 6,
  })
})

it('passes the typed text up', () => {
  const onChangeText = jest.fn()
  render(<TextField label="Email" kind="email" value="" onChangeText={onChangeText} />)
  fireEvent.changeText(screen.getByLabelText('Email'), 'alice@example.com')
  expect(onChangeText).toHaveBeenCalledWith('alice@example.com')
})

it('shows an error under the field in the danger colour and announces it once, with no hint that repeats it', () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
  render(<TextField label="Password" kind="password" value="" onChangeText={jest.fn()} error="Wrong." />)
  expect(StyleSheet.flatten(screen.getByText('Wrong.').props.style).color).toBe(cobalt.colors.danger)
  expect(screen.getByLabelText('Password').props.accessibilityHint).toBeUndefined()
  expect(announce).toHaveBeenCalledWith('Wrong.')
  announce.mockRestore()
})

it('draws the field in the surface fill with the frame of the stats card', () => {
  render(<TextField label="Email" kind="email" value="" onChangeText={jest.fn()} />)
  expect(StyleSheet.flatten(screen.getByLabelText('Email').props.style)).toMatchObject({
    backgroundColor: cobalt.colors.surface,
    borderColor: cobalt.components.summary.border,
    color: cobalt.colors.text,
  })
})
