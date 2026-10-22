import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { DEFAULT_ASSISTS, type AssistName } from '@/game/constants/assists.constants'
import { useAssists } from '@/game/hooks/useAssists'
import { cobalt } from '@/theme/themes/cobalt'
import { AssistPreview } from './AssistPreview'

// VoiceOver skips the preview, so every query must include hidden elements.
const hidden = { includeHiddenElements: true }
const styleOf = (cell: number) => StyleSheet.flatten(screen.getByTestId(`cell-${cell}-fill`, hidden).props.style)
const colours = cobalt.components.cell

// The store is one module value for the whole test file, so each test turns every assist on again.
afterEach(async () => {
  const { result, unmount } = renderHook(() => useAssists())
  const names = Object.keys(DEFAULT_ASSISTS) as AssistName[]
  await act(async () => {
    names.forEach((name) => result.current.setAssist(name, true))
  })
  unmount()
})

it('draws the real grid with the shades of the canvas', () => {
  render(<AssistPreview />)
  expect(screen.getAllByTestId(/^cell-\d+$/, hidden)).toHaveLength(81)
  expect(styleOf(39).backgroundColor).toBe(colours.selected)
  expect(styleOf(36).backgroundColor).toBe(colours.peer)
  expect(styleOf(5).backgroundColor).toBe(colours.same)
  expect(styleOf(54).backgroundColor).toBe(colours.conflictFill)
})

it('follows a switch at once', async () => {
  // The hook comes first: each render points screen at its own tree.
  const { result } = renderHook(() => useAssists())
  render(<AssistPreview />)
  // Cell 31 is in the box of cell 39, not in its row or column, and holds no 8.
  await act(async () => result.current.setAssist('box', false))
  expect(styleOf(31).backgroundColor).toBe(colours.fill)
  fireEvent(screen.getByTestId('grid-box', hidden), 'layout', { nativeEvent: { layout: { width: 180, height: 180 } } })
  const frame = () => StyleSheet.flatten(screen.getByTestId('selection-frame', hidden).props.style)
  expect(frame().borderWidth).toBe(colours.selectedRingWidth)
  await act(async () => result.current.setAssist('selectedCell', false))
  // Without the selected fill, a thinner frame marks the selected cell.
  expect(frame()).toMatchObject({ borderColor: colours.ring, borderWidth: cobalt.shape.stroke.ring })
})

it('cannot be tapped and VoiceOver skips it', () => {
  render(<AssistPreview />)
  expect(screen.queryAllByRole('button', hidden)).toHaveLength(0)
  expect(screen.getByTestId('grid', hidden).props.accessibilityElementsHidden).toBe(true)
})

it('has the 180 pt size of the canvas', () => {
  render(<AssistPreview />)
  expect(StyleSheet.flatten(screen.getByTestId('assist-preview', hidden).props.style)).toMatchObject({
    width: 180,
    height: 180,
  })
})

it('draws no pulse', () => {
  render(<AssistPreview />)
  expect(screen.queryAllByTestId(/^cell-\d+-wave$/, hidden)).toHaveLength(0)
})
