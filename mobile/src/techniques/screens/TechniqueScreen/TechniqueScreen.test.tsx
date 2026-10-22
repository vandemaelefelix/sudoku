import { techniqueExample } from '@sudoku/core'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { IntlProvider } from 'react-intl'
import { CATALOGUES } from '@/i18n/messages'
import { createAppIntl } from '@/i18n/utils/intl.utils'
import { exampleSpeech } from '@/techniques/utils/techniques.utils'
import { TechniqueScreen } from './TechniqueScreen'

// VoiceOver reads the example board as one text, so the queries ask for its hidden cells.
const hidden = { includeHiddenElements: true }

it('shows the name, the definition, the level and the explanation', () => {
  render(<TechniqueScreen technique="pointing" onBack={jest.fn()} />)
  expect(screen.getByRole('header', { name: 'Pointing' })).toBeTruthy()
  expect(
    screen.getByText(
      'A digit that fits in only one row or column of a box. That row or column loses the digit outside the box.',
    ),
  ).toBeTruthy()
  expect(screen.getByText('First seen in Medium puzzles.')).toBeTruthy()
  expect(screen.getByText(/^In a box, a digit fits only in the cells of one row\./)).toBeTruthy()
})

it('shows the page in Dutch', () => {
  render(
    <IntlProvider locale="nl-BE" messages={CATALOGUES.nl}>
      <TechniqueScreen technique="pointing" onBack={jest.fn()} />
    </IntlProvider>,
  )
  expect(screen.getByRole('header', { name: 'Aanwijzen' })).toBeTruthy()
  expect(screen.getByText('Komt voor het eerst voor in puzzels op niveau Gemiddeld.')).toBeTruthy()
  expect(screen.getByText(/^In een blok past een cijfer alleen in de vakjes van één rij\./)).toBeTruthy()
  expect(screen.getByText('Voorbeeld')).toBeTruthy()
})

it('draws the example board with the highlight roles of its step', () => {
  render(<TechniqueScreen technique="pointing" onBack={jest.fn()} />)
  const { step } = techniqueExample('pointing')!
  expect(screen.getAllByTestId(/^cell-\d+$/, hidden)).toHaveLength(81)
  for (const cell of step.pattern) expect(screen.getByTestId(`cell-${cell}-hint-pattern`, hidden)).toBeTruthy()
  expect(screen.getAllByTestId(/^note-strike-\d$/, hidden)).toHaveLength(step.eliminations.length)
})

it('reads the example to VoiceOver as text', () => {
  render(<TechniqueScreen technique="xWing" onBack={jest.fn()} />)
  const text = exampleSpeech(createAppIntl('en'), techniqueExample('xWing')!)
  expect(screen.getByLabelText(text)).toBeTruthy()
})

it('shows the target cell with its ghost digit for a placement', () => {
  render(<TechniqueScreen technique="hiddenSingle" onBack={jest.fn()} />)
  const { cell } = techniqueExample('hiddenSingle')!.step.placements[0]!
  expect(screen.getByTestId(`cell-${cell}-hint-target`, hidden)).toBeTruthy()
})

it('says so for an unknown technique, and goes back', () => {
  const onBack = jest.fn()
  render(<TechniqueScreen technique={null} onBack={onBack} />)
  expect(screen.getByText('This technique is not in the app.')).toBeTruthy()
  fireEvent.press(screen.getByRole('button', { name: 'Back' }))
  expect(onBack).toHaveBeenCalled()
})
