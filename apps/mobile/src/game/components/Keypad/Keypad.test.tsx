import { render, screen, within } from '@testing-library/react-native'
import type { ReactElement } from 'react'
import { GameProvider } from '@/game/components/GameProvider'
import { sampleStart } from '@/game/utils/sample.utils'
import { Keypad } from './Keypad'

const renderInGame = (ui: ReactElement) => render(<GameProvider start={sampleStart()}>{ui}</GameProvider>)

it('lays out the keys 1 to 5 and 6 to 9 in two rows', () => {
  renderInGame(<Keypad />)
  const first = within(screen.getByTestId('keypad-row-0')).getAllByRole('button')
  const second = within(screen.getByTestId('keypad-row-1')).getAllByRole('button')
  expect(first.map((key) => key.props.accessibilityLabel)).toEqual([
    'Enter 1',
    'Enter 2',
    'Enter 3',
    'Enter 4',
    'Enter 5',
  ])
  expect(second).toHaveLength(4)
})

it('makes each key 64 × 60 pt', () => {
  renderInGame(<Keypad />)
  expect(screen.getByLabelText('Enter 1')).toHaveStyle({ width: 64, height: 60 })
})
