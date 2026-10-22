import { HINT_TECHNIQUES, TECHNIQUE_PAGES, techniqueExample } from '@sudoku/core'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { exampleSpeech } from '@/techniques/utils/techniques.utils'
import { TechniqueScreen } from './TechniqueScreen'

// VoiceOver reads the example board as one text, so the queries ask for its hidden cells.
const hidden = { includeHiddenElements: true }

it('shows the name, the definition, the level and the explanation', () => {
  render(<TechniqueScreen technique="pointing" onBack={jest.fn()} />)
  const pointing = HINT_TECHNIQUES.pointing!
  expect(screen.getByRole('header', { name: 'Pointing' })).toBeTruthy()
  expect(screen.getByText(pointing.definition.charAt(0).toUpperCase() + pointing.definition.slice(1))).toBeTruthy()
  expect(screen.getByText('First seen in Medium puzzles.')).toBeTruthy()
  expect(screen.getByText(TECHNIQUE_PAGES.pointing!.explanation)).toBeTruthy()
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
  const text = exampleSpeech(techniqueExample('xWing')!)
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
