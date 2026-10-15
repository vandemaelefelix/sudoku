import { fireEvent, render, screen } from '@testing-library/react-native'
import { cobaltColour } from '@/theme/themes/cobalt'
import { ConflictHatch } from './ConflictHatch'

const moves = () =>
  (screen.getByTestId('skia-path').props.path.calls as unknown[][]).filter((call) => call[0] === 'moveTo')

const unistyles = jest.requireMock<typeof import('react-native-unistyles')>('react-native-unistyles')

afterEach(() => jest.restoreAllMocks())

it('draws no hatch in Light, where the danger fill marks the conflict', () => {
  render(<ConflictHatch />)
  expect(screen.queryByTestId('conflict-hatch')).toBeNull()
})

describe('in Colour', () => {
  beforeEach(() => {
    jest
      .spyOn(unistyles, 'useUnistyles')
      .mockReturnValue({ theme: cobaltColour, rt: unistyles.UnistylesRuntime } as never)
  })

  it('draws the stripes of the theme in a canvas that takes no touch', () => {
    render(<ConflictHatch />)
    const canvas = screen.getByTestId('conflict-hatch')
    expect(canvas.props.pointerEvents).toBe('none')
    const stripes = screen.getByTestId('skia-path')
    const hatch = cobaltColour.components.cell.conflictHatch
    expect(stripes.props).toMatchObject({
      strokeWidth: hatch?.width,
      color: hatch?.color,
      opacity: hatch?.opacity,
      style: 'stroke',
    })
  })

  it('draws a stripe every pitch once the cell has a size', () => {
    render(<ConflictHatch />)
    expect(moves()).toHaveLength(0)
    fireEvent(screen.getByTestId('conflict-hatch'), 'layout', { nativeEvent: { layout: { width: 40, height: 40 } } })
    // The mock path records its calls. 40 + 40 points with a pitch of 5 give 17 stripes.
    expect(moves()).toHaveLength(17)
  })
})
