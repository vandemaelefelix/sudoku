import { fireEvent, render, screen } from '@testing-library/react-native'
import type { CellLook } from '@/scan/utils/correction.utils'
import { CorrectionCheck } from './CorrectionCheck'

const sure: CellLook = { digit: '5', style: 'given', uncertain: false }
const shaky: CellLook = { digit: '4', style: 'entry', uncertain: true }
const looks = (...overrides: [number, CellLook][]): CellLook[] => {
  const all = Array.from({ length: 81 }, () => sure)
  for (const [cell, look] of overrides) all[cell] = look
  return all
}

const props = () => ({
  cell: 3,
  look: shaky,
  looks: looks([3, shaky], [40, shaky], [70, { ...shaky, uncertain: false }]),
  flow: [3, 40, 70],
  picking: false,
  image: undefined,
  hint: null,
  labelKinds: false,
  animate: false,
  onClose: jest.fn(),
  onYes: jest.fn(),
  onNo: jest.fn(),
  onDigit: jest.fn(),
  onClear: jest.fn(),
  onKind: jest.fn(),
})

describe('CorrectionCheck in the check state', () => {
  it('asks about the digit, names the cell and counts the progress', () => {
    render(<CorrectionCheck {...props()} />)
    expect(screen.getByTestId('correction-question')).toHaveTextContent('Is this a 4?')
    expect(screen.getByText('Row 1, column 4')).toBeTruthy()
    expect(screen.getByLabelText('1 of 3 cells checked')).toBeTruthy()
    expect(screen.getByTestId('correction-yes')).toHaveTextContent('Yes, 4')
  })

  it('sends Yes, No and Close', () => {
    const p = props()
    render(<CorrectionCheck {...p} />)
    fireEvent.press(screen.getByTestId('correction-yes'))
    fireEvent.press(screen.getByTestId('correction-no'))
    fireEvent.press(screen.getByTestId('correction-close'))
    expect(p.onYes).toHaveBeenCalledTimes(1)
    expect(p.onNo).toHaveBeenCalledTimes(1)
    expect(p.onClose).toHaveBeenCalledTimes(1)
  })

  it('asks whether an empty read is right', () => {
    render(<CorrectionCheck {...props()} look={{ digit: '', style: 'empty', uncertain: true }} />)
    expect(screen.getByTestId('correction-question')).toHaveTextContent('Is this empty?')
    expect(screen.getByTestId('correction-yes')).toHaveTextContent('Yes, empty')
  })
})

describe('CorrectionCheck in the pick state', () => {
  it('shows the keypad with the second guess, and sends a digit and Empty', () => {
    const p = props()
    render(<CorrectionCheck {...p} picking hint={9} />)
    expect(screen.getByTestId('correction-question')).toHaveTextContent('What is it?')
    expect(screen.getByTestId('correction-key-9')).toContainElement(screen.getByTestId('correction-hint'))
    expect(screen.queryByTestId('correction-yes')).toBeNull()
    fireEvent.press(screen.getByTestId('correction-key-2'))
    expect(p.onDigit).toHaveBeenCalledWith(2)
    fireEvent.press(screen.getByTestId('correction-clear'))
    expect(p.onClear).toHaveBeenCalledTimes(1)
  })

  it('has no progress and no hint for a sure cell', () => {
    render(<CorrectionCheck {...props()} cell={0} look={sure} picking hint={9} />)
    expect(screen.getByTestId('correction-question')).toHaveTextContent('Change this 5')
    expect(screen.queryByTestId('correction-progress')).toBeNull()
    expect(screen.queryByTestId('correction-hint')).toBeNull()
  })
})

describe('CorrectionCheck with the kind labels', () => {
  it('shows the labels only when asked, and sends the kind', () => {
    const p = props()
    const { rerender } = render(<CorrectionCheck {...p} />)
    expect(screen.queryByTestId('correction-kinds')).toBeNull()
    rerender(<CorrectionCheck {...p} labelKinds />)
    fireEvent.press(screen.getByTestId('correction-kind-given'))
    expect(p.onKind).toHaveBeenCalledWith('given')
  })
})
