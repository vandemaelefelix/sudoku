import { fireEvent, render, screen } from '@testing-library/react-native'
import * as Haptics from 'expo-haptics'
import type { ReactElement } from 'react'
import { GameProvider } from '@/game/components/GameProvider'
import { Grid } from '@/game/components/Grid'
import { Keypad } from '@/game/components/Keypad'
import { sampleStart } from '@/game/utils/sample.utils'
import { Tools } from './Tools'

const renderInGame = (ui: ReactElement) => render(<GameProvider start={sampleStart()}>{ui}</GameProvider>)

const renderTools = () =>
  renderInGame(
    <>
      <Grid />
      <Tools />
      <Keypad />
    </>,
  )

afterEach(() => jest.restoreAllMocks())

it('has Undo, Erase, Notes and Hint, with Undo and Erase disabled at the start', () => {
  renderTools()
  expect(screen.getByLabelText('Undo')).toBeDisabled()
  expect(screen.getByLabelText('Erase')).toBeDisabled()
  expect(screen.getByLabelText('Notes')).toBeEnabled()
  expect(screen.getByLabelText('Hint')).toBeEnabled()
})

it('undoes and erases a placed number', () => {
  renderTools()
  fireEvent.press(screen.getByTestId('cell-2'))
  fireEvent.press(screen.getByLabelText('Enter 4'))
  expect(screen.getByLabelText('Row 1, column 3, 4')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('Erase'))
  expect(screen.getByLabelText('Row 1, column 3, empty')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('Undo'))
  expect(screen.getByLabelText('Row 1, column 3, 4')).toBeTruthy()
})

it('turns notes mode on and off', () => {
  renderTools()
  fireEvent.press(screen.getByLabelText('Notes'))
  expect(screen.getByLabelText('Notes')).toBeSelected()
  fireEvent.press(screen.getByTestId('cell-2'))
  fireEvent.press(screen.getByLabelText('Note 3'))
  expect(screen.getByLabelText('Row 1, column 3, empty, notes 3')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('Notes'))
  expect(screen.getByLabelText('Notes')).not.toBeSelected()
})

it('marks the Hint tool as active while a hint is open, and ends the hint on a second tap', () => {
  renderTools()
  fireEvent.press(screen.getByLabelText('Hint'))
  expect(screen.getByLabelText('Hint')).toBeSelected()
  fireEvent.press(screen.getByLabelText('Hint'))
  expect(screen.getByLabelText('Hint')).not.toBeSelected()
})

it('makes every tool a touch target of 52 pt', () => {
  renderTools()
  for (const name of ['Undo', 'Erase', 'Notes', 'Hint']) {
    expect(screen.getByLabelText(name)).toHaveStyle({ width: 52, height: 52 })
  }
})

it('ticks when Notes turns on and off', () => {
  renderTools()
  jest.mocked(Haptics.selectionAsync).mockClear()
  fireEvent.press(screen.getByLabelText('Notes'))
  fireEvent.press(screen.getByLabelText('Notes'))
  expect(Haptics.selectionAsync).toHaveBeenCalledTimes(2)
})

it('gives every tool the test ID tool-<icon> for the end-to-end flows', () => {
  renderTools()
  expect(screen.getByTestId('tool-undo')).toHaveProp('accessibilityLabel', 'Undo')
  expect(screen.getByTestId('tool-erase')).toHaveProp('accessibilityLabel', 'Erase')
  expect(screen.getByTestId('tool-notes')).toHaveProp('accessibilityLabel', 'Notes')
  expect(screen.getByTestId('tool-hint')).toHaveProp('accessibilityLabel', 'Hint')
})
