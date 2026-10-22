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
const at = (step: number, rung: HintRung, plan: HintPlan = pointing): OpenHint => ({ plan, step, rung, view: 'card' })

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

const buttonLabels = () =>
  within(screen.getByTestId('hint-buttons'))
    .getAllByRole('button')
    .map((button) => within(button).getByText(/./).props.children as string)
const button = (name: string) => screen.getByRole('button', { name })

afterEach(() => jest.restoreAllMocks())

it('shows the look rung: the text, the rung dots, the step and three buttons', () => {
  const hintCard = renderCard(at(0, 1))
  expect(screen.getByText('Hint')).toBeTruthy()
  expect(screen.getByText(textOf(pointing, 0, 1))).toBeTruthy()
  expect(screen.getByText('Step 1 of 2')).toBeTruthy()
  expect(screen.getAllByTestId(/^hint-rung-/)).toHaveLength(4)
  expect(screen.getAllByTestId(/^hint-rung-\d-on$/)).toHaveLength(1)
  expect(buttonLabels()).toEqual(['More help', 'Show answer', 'Try it'])
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

it('offers Fill it and I will do it at the answer rung of the last step', () => {
  const hintCard = renderCard(at(1, 4))
  expect(screen.getByText('Step 2 of 2')).toBeTruthy()
  expect(buttonLabels()).toEqual(['Fill it', "I'll do it"])
  fireEvent.press(button("I'll do it"))
  expect(hintCard).toHaveBeenCalledWith('hintTry')
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
  expect(buttonLabels()).toEqual(['Fill it', "I'll do it"])
})

it('closes on every card', () => {
  const hintCard = renderCard(at(0, 3))
  fireEvent.press(screen.getByLabelText('Close the hint'))
  expect(hintCard).toHaveBeenCalledWith('hintClose')
})

it('reads the new text to VoiceOver', () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
  renderCard(at(0, 1))
  expect(announce).toHaveBeenCalledWith(`Step 1 of 2. ${textOf(pointing, 0, 1)}`)
})

it('takes the height of the keypad, with buttons of 44 pt or more', () => {
  renderCard(at(0, 1))
  const card = StyleSheet.flatten(screen.getByTestId('hint-card').props.style)
  const { key } = cobalt.size
  const keypad = cobalt.space.md + 2 * key.height + cobalt.space.sm
  expect(card.marginTop + card.height).toBe(keypad)
  for (const label of buttonLabels()) {
    expect(StyleSheet.flatten(button(label).props.style).minHeight).toBeGreaterThanOrEqual(44)
  }
})

it('caps the Dynamic Type of the buttons and the top row, so the rung text keeps its room', () => {
  renderCard(at(0, 1))
  expect(screen.getByText('More help').props.maxFontSizeMultiplier).toBeLessThanOrEqual(1.3)
  expect(screen.getByText('Step 1 of 2').props.maxFontSizeMultiplier).toBeLessThanOrEqual(1.3)
  expect(screen.getByText(textOf(pointing, 0, 1)).props.maxFontSizeMultiplier).toBeUndefined()
})

describe('Learn more', () => {
  it('opens the page of the technique from rung 2 on', () => {
    const onLearn = jest.fn()
    renderCard(at(0, 2), onLearn)
    fireEvent.press(screen.getByRole('link', { name: 'Learn more about Pointing' }))
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
  fireEvent.press(screen.getByTestId('hint-try'))
  expect(hintCard.mock.calls).toEqual([['hintMore'], ['hintAnswer'], ['hintTry']])
  screen.unmount()
  const onLast = renderCard(at(1, 4))
  fireEvent.press(screen.getByTestId('hint-fill'))
  expect(onLast).toHaveBeenCalledWith('hintFill')
})
