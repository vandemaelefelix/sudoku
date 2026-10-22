import { createGame, hintMessage, planHint, type HintPlan, type HintRung, type TechniqueId } from '@sudoku/core'
import { createAppIntl } from '@/i18n/utils/intl.utils'
import { hintText } from '@/utils/hintText.utils'
import { fireEvent, render, screen, within } from '@testing-library/react-native'
import { AccessibilityInfo, StyleSheet } from 'react-native'
import { GameActionsContext } from '@/game/hooks/useGameActions'
import type { GameActions } from '@/game/utils/gameSession.utils'
import { pointingStart, stuckStart } from '@/game/utils/sample.utils'
import type { OpenHint } from '@/game/utils/session.utils'
import { cobalt } from '@/theme/themes/cobalt'
import { HintCard } from './HintCard'

const en = createAppIntl('en')
/** The English card text of a rung, as the app writes it. */
const textOf = (plan: HintPlan, step: number, rung: HintRung): string => hintText(en, hintMessage(plan, step, rung))

function planOf(start: ReturnType<typeof pointingStart>): HintPlan {
  const plan = planHint(createGame(start))
  if (plan === null) throw new Error('expected a plan')
  return plan
}

const pointing = planOf(pointingStart())
const at = (step: number, rung: HintRung, plan: HintPlan = pointing): OpenHint => ({ plan, step, rung })

const renderCard = (hint: OpenHint, onLearn?: (technique: TechniqueId) => void) => {
  const hintCard = jest.fn()
  const actions = { hintCard } as unknown as GameActions
  render(
    <GameActionsContext value={actions}>
      <HintCard hint={hint} onLearn={onLearn} />
    </GameActionsContext>,
  )
  return hintCard
}

/** The labels of the buttons and the link in reading order: the text buttons first, the main button last. */
const buttonLabels = () =>
  within(screen.getByTestId('hint-buttons'))
    .queryAllByRole(/^(button|link)$/)
    .map((button) => within(button).getByText(/./).props.children as string)
const button = (name: string) => screen.getByRole('button', { name })

afterEach(() => jest.restoreAllMocks())

it('shows the look rung: the text, the rung dots, the step and two buttons', () => {
  const hintCard = renderCard(at(0, 1))
  expect(screen.getByText('Hint')).toBeTruthy()
  expect(screen.getByText(textOf(pointing, 0, 1))).toBeTruthy()
  expect(screen.getByText('Step 1 of 2')).toBeTruthy()
  expect(screen.getAllByTestId(/^hint-rung-/)).toHaveLength(4)
  expect(screen.getAllByTestId(/^hint-rung-\d-on$/)).toHaveLength(1)
  expect(buttonLabels()).toEqual(['Show answer', 'More help'])
  fireEvent.press(button('More help'))
  expect(hintCard).toHaveBeenCalledWith('hintMore')
})

it('names the technique from rung 2 on', () => {
  renderCard(at(0, 2))
  expect(screen.getByText('Pointing')).toBeTruthy()
  expect(screen.getAllByTestId(/^hint-rung-\d-on$/)).toHaveLength(2)
})

it('leads to the next step at the answer rung of an elimination step', () => {
  const hintCard = renderCard(at(0, 4))
  expect(buttonLabels()).toEqual(['Next step'])
  fireEvent.press(button('Next step'))
  expect(hintCard).toHaveBeenCalledWith('hintNext')
})

it('offers only Fill it at the answer rung of the last step', () => {
  const hintCard = renderCard(at(1, 4))
  expect(screen.getByText('Step 2 of 2')).toBeTruthy()
  expect(buttonLabels()).toEqual(['Fill it'])
  fireEvent.press(button('Fill it'))
  expect(hintCard).toHaveBeenCalledWith('hintFill')
})

it('fills one main button per card, and keeps the other actions as text', () => {
  renderCard(at(0, 2), jest.fn())
  expect(buttonLabels()).toEqual(['Show answer', 'More help'])
  const main = StyleSheet.flatten(button('More help').props.style)
  expect(main.backgroundColor).toBe(cobalt.components.button.primary)
  expect(StyleSheet.flatten(button('Show answer').props.style).backgroundColor).toBeUndefined()
})

it('shows one card for a wrong entry, with Erase it and no rungs', () => {
  const plan: HintPlan = { kind: 'mistake', cell: 2 }
  const hintCard = renderCard(at(0, 1, plan))
  expect(screen.getByText('Row 1, column 3 holds a wrong digit. Erase it first.')).toBeTruthy()
  expect(screen.queryAllByTestId(/^hint-rung-/)).toHaveLength(0)
  fireEvent.press(button('Erase it'))
  expect(hintCard).toHaveBeenCalledWith('hintErase')
})

it('shows one card for the fallback, with Fill it', () => {
  const plan = planOf(stuckStart())
  renderCard(at(0, 1, plan))
  expect(screen.getByText(textOf(plan, 0, 1))).toBeTruthy()
  expect(screen.queryAllByTestId(/^hint-rung-/)).toHaveLength(0)
  expect(buttonLabels()).toEqual(['Fill it'])
})

it('closes on every card', () => {
  const hintCard = renderCard(at(0, 3))
  fireEvent.press(screen.getByLabelText('Close the hint'))
  expect(hintCard).toHaveBeenCalledWith('hintClose')
})

it('moves VoiceOver focus to the title when it opens', () => {
  const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockClear()
  renderCard(at(0, 1))
  const focused = focus.mock.calls
    .filter(([, event]) => event === 'focus')
    .map(([target]) => (target as unknown as { props: { children?: unknown } }).props.children)
  expect(focused).toEqual(['Hint'])
})

it('reads the new text to VoiceOver', () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
  renderCard(at(0, 1))
  expect(announce).toHaveBeenCalledWith(`Step 1 of 2. ${textOf(pointing, 0, 1)}`)
})

it('covers the tool row and the keypad from edge to edge, with the grid margin as padding and buttons of 44 pt', () => {
  renderCard(at(0, 2), jest.fn())
  const card = StyleSheet.flatten(screen.getByTestId('hint-card').props.style)
  expect(card).toMatchObject({ position: 'absolute', inset: 0, padding: cobalt.space.lg })
  for (const action of within(screen.getByTestId('hint-buttons')).getAllByRole(/^(button|link)$/)) {
    expect(StyleSheet.flatten(action.props.style).minHeight).toBeGreaterThanOrEqual(44)
  }
})

it('keeps every button label on one line', () => {
  renderCard(at(0, 2), jest.fn())
  expect(screen.getByText('Show answer').props.numberOfLines).toBe(1)
  expect(StyleSheet.flatten(screen.getByTestId('hint-buttons').props.style).flexWrap).toBe('wrap')
})

it('caps the Dynamic Type of the buttons and the top row, so the rung text keeps its room', () => {
  renderCard(at(0, 1))
  expect(screen.getByText('More help').props.maxFontSizeMultiplier).toBeLessThanOrEqual(1.3)
  expect(screen.getByText('Show answer').props.maxFontSizeMultiplier).toBeLessThanOrEqual(1.3)
  expect(screen.getByText('Step 1 of 2').props.maxFontSizeMultiplier).toBeLessThanOrEqual(1.3)
  expect(screen.getByText(textOf(pointing, 0, 1)).props.maxFontSizeMultiplier).toBeUndefined()
})

describe('Learn more', () => {
  it('opens the page of the technique from rung 2 on', () => {
    const onLearn = jest.fn()
    renderCard(at(0, 2), onLearn)
    const link = screen.getByRole('link', { name: 'Learn more' })
    // An inline link at the end of the text, not a button in the footer.
    expect(within(screen.getByTestId('hint-buttons')).queryByRole('link')).toBeNull()
    fireEvent.press(link)
    expect(onLearn).toHaveBeenCalledWith('pointing')
  })

  it('offers the page to VoiceOver as an action of the text, with the name of the technique', () => {
    const onLearn = jest.fn()
    renderCard(at(0, 2), onLearn)
    const text = screen.getByText(textOf(pointing, 0, 2), { exact: false })
    expect(text.props.accessibilityActions).toEqual([{ name: 'learnMore', label: 'Learn more about Pointing' }])
    fireEvent(text, 'accessibilityAction', { nativeEvent: { actionName: 'learnMore' } })
    expect(onLearn).toHaveBeenCalledWith('pointing')
  })

  it('shows neither on rung 1, nor on the mistake card, nor without a page to open', () => {
    renderCard(at(0, 1), jest.fn())
    expect(screen.queryByRole('link')).toBeNull()
    screen.unmount()
    renderCard(at(0, 1, { kind: 'mistake', cell: 2 }), jest.fn())
    expect(screen.queryByRole('link')).toBeNull()
    screen.unmount()
    renderCard(at(0, 3))
    expect(screen.queryByRole('link')).toBeNull()
  })
})

it('gives each button the test ID hint-<action> for the end-to-end flows', () => {
  const hintCard = renderCard(at(0, 1))
  fireEvent.press(screen.getByTestId('hint-more'))
  fireEvent.press(screen.getByTestId('hint-answer'))
  expect(hintCard.mock.calls).toEqual([['hintMore'], ['hintAnswer']])
  screen.unmount()
  const onLast = renderCard(at(1, 4))
  fireEvent.press(screen.getByTestId('hint-fill'))
  expect(onLast).toHaveBeenCalledWith('hintFill')
})
