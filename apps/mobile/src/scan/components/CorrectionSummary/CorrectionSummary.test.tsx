import { fireEvent, render, screen } from '@testing-library/react-native'
import { CorrectionSummary } from './CorrectionSummary'

const base = {
  toCheck: 0,
  conflictCount: 0,
  level: 'Hard',
  blockText: null,
  canPlay: false,
  animate: false,
  canSolve: false,
  solutionShown: false,
  onStartCheck: jest.fn(),
  onToggleSolve: jest.fn(),
} as const
const handlers = () => ({ onVerify: jest.fn(), onScanAnother: jest.fn(), onHome: jest.fn() })

it('offers one Check button for a full grid that the player has not checked', () => {
  const full = { phase: 'ready', count: 0, ...handlers() } as const
  render(<CorrectionSummary {...base} full={full} />)
  expect(screen.getByText('Grid is full')).toBeTruthy()
  expect(screen.queryByTestId('play')).toBeNull()
  expect(screen.queryByTestId('solve')).toBeNull()
  fireEvent.press(screen.getByTestId('verify'))
  expect(full.onVerify).toHaveBeenCalledTimes(1)
})

it('keeps Check off while two given digits clash', () => {
  render(<CorrectionSummary {...base} conflictCount={2} full={{ phase: 'ready', count: 0, ...handlers() }} />)
  expect(screen.getByText('2 givens clash')).toBeTruthy()
  expect(screen.getByTestId('verify').props.accessibilityState).toMatchObject({ disabled: true })
})

it('says how many cells differ, with no button', () => {
  render(<CorrectionSummary {...base} full={{ phase: 'wrong', count: 2, ...handlers() }} />)
  expect(screen.getByText('2 cells differ')).toBeTruthy()
  expect(screen.queryByTestId('verify')).toBeNull()
})

it('says one cell differs in the singular', () => {
  render(<CorrectionSummary {...base} full={{ phase: 'wrong', count: 1, ...handlers() }} />)
  expect(screen.getByText('1 cell differs')).toBeTruthy()
})

it('says how many cells clash', () => {
  render(<CorrectionSummary {...base} full={{ phase: 'clash', count: 4, ...handlers() }} />)
  expect(screen.getByText('4 cells clash')).toBeTruthy()
})

it('offers Scan another and Home for a solved grid', () => {
  const full = { phase: 'solved', count: 0, ...handlers() } as const
  render(<CorrectionSummary {...base} full={full} />)
  fireEvent.press(screen.getByTestId('scan-another'))
  fireEvent.press(screen.getByTestId('home'))
  expect(full.onScanAnother).toHaveBeenCalledTimes(1)
  expect(full.onHome).toHaveBeenCalledTimes(1)
})

it('still shows Play and Solve without a full grid', () => {
  render(<CorrectionSummary {...base} />)
  expect(screen.getByTestId('play')).toBeTruthy()
  expect(screen.getByTestId('solve')).toBeTruthy()
})
