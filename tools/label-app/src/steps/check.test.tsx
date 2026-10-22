import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CheckCell, CheckPage } from '../api/types'
import { App } from '../App'
import { signalText } from '../components/CellDetail'
import { fakeServer } from '../test/fakeServer'

beforeEach(() => {
  window.location.hash = ''
})
afterEach(() => vi.unstubAllGlobals())

function open(route: string) {
  window.location.hash = `#/${route}`
  return render(<App />)
}

const ZERO = { empty: 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0, unknown: 0 }

function cell(n: number, extra: Partial<CheckCell> = {}): CheckCell {
  const digit = Array.from<number>({ length: 10 }).fill(0.01)
  digit[7] = 0.9
  return {
    id: `id${n}`,
    stem: `stem${n}`,
    photo: 'aaaa',
    source: 'app',
    row: Math.floor(n / 9),
    col: n % 9,
    digit: '7',
    kind: 'printed',
    edited: false,
    probs: { digit, kind: [0.01, 0.9, 0.08, 0.01] },
    doubt: 0.5,
    reasons: [],
    ...extra,
  }
}

function page(cells: CheckCell[], extra: Partial<CheckPage> = {}): CheckPage {
  return {
    digit: '7',
    cells,
    left: cells.length,
    counts: { ...ZERO, '7': cells.length },
    done: {},
    sure: 0,
    threshold: 0.98,
    ...extra,
  }
}

const D7 = '/api/check/digits?digit=7&threshold=0.98'
const K7 = '/api/check/kinds?digit=7&threshold=0.95'
const KC = { all: 5, printed: 3, handwritten: 2, unsure: 0 }
const KP7 = `${K7}&kind=printed`
const kindPage = (cells: CheckCell[], kind_counts = KC, extra: Partial<CheckPage> = {}) =>
  page(cells, { threshold: 0.95, kind_counts, ...extra })
const tiles = () => screen.findAllByRole('button', { name: /^Cell / })

describe('Digits', () => {
  it('opens the first tab with cells', async () => {
    fakeServer({
      '/api/check/digits?digit=empty&threshold=0.98': page([], { digit: 'empty', counts: { ...ZERO, '7': 1 } }),
      [D7]: page([cell(0)]),
    })
    open('digits')
    await waitFor(() => expect(window.location.hash).toBe('#/digits/7'))
  })

  it('moves on to the next tab with cells when this tab has none left', async () => {
    fakeServer({
      '/api/check/digits?digit=3&threshold=0.98': page([], { digit: '3', counts: { ...ZERO, '7': 1 } }),
      [D7]: page([cell(0)]),
    })
    open('digits/3')
    await waitFor(() => expect(window.location.hash).toBe('#/digits/7'))
  })

  it('keeps the server order and colours the edge by doubt', async () => {
    fakeServer({ [D7]: page([cell(0, { doubt: 1 }), cell(1, { doubt: 0.4 }), cell(2, { doubt: 0 })]) })
    open('digits/7')
    const all = await tiles()
    expect(all.map((t) => t.getAttribute('aria-label'))).toEqual(
      ['Cell stem0, 7', 'Cell stem1, 7', 'Cell stem2, 7'].map((l) => l.replace(/, 7$/, ', 7')),
    )
    expect(all.map((t) => t.dataset.doubt)).toEqual(['1.00', '0.40', '0.00'])
    expect(all[0]!.style.getPropertyValue('--doubt')).toBe('1')
    expect(screen.getByLabelText('Legend')).toBeInTheDocument()
  })

  it('shows the open count and the progress of each tab', async () => {
    fakeServer({
      [D7]: page([cell(0)], { counts: { ...ZERO, '7': 30, empty: 4 }, done: { '7': 4, empty: 0 } }),
    })
    open('digits/7')
    const tab = await screen.findByRole('button', { name: /^7 30 open/ })
    expect(tab).toHaveTextContent('4 of 34 done')
    expect(screen.getByRole('button', { name: /^Empty 4 open/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /No guess/ })).not.toBeInTheDocument()
  })

  it('selects with click, shift-click and ⌘A and applies one key to all', async () => {
    const server = fakeServer({
      [D7]: page([cell(0), cell(1), cell(2), cell(3), cell(4)]),
      '/api/check/digits/confirm': 5,
    })
    const user = userEvent.setup()
    open('digits/7')
    const all = await tiles()
    await user.click(all[0]!)
    await user.keyboard('{Shift>}')
    await user.click(all[2]!)
    await user.keyboard('{/Shift}')
    expect(all.map((t) => t.getAttribute('aria-pressed'))).toEqual(['true', 'true', 'true', 'false', 'false'])
    await userEvent.keyboard('1')
    expect(await screen.findByText('Set 3 cells to 1. Enter confirms the page.')).toBeInTheDocument()
    expect(all.map((t) => t.getAttribute('aria-pressed'))).toEqual(Array.from({ length: 5 }, () => 'false'))
    await userEvent.keyboard('{Meta>}a{/Meta}')
    expect(all.every((t) => t.getAttribute('aria-pressed') === 'true')).toBe(true)
    await userEvent.keyboard('x')
    expect(await screen.findByText('Set 5 cells to discarded. Enter confirms the page.')).toBeInTheDocument()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(server.posts['/api/check/digits/confirm']).toHaveLength(1))
    expect(server.posts['/api/check/digits/confirm']![0]).toEqual({
      cells: [0, 1, 2, 3, 4].map((n) => ({ id: `id${n}`, digit: 'discarded' })),
    })
  })

  it('confirms the fixes and the current label for the rest', async () => {
    const server = fakeServer({
      [D7]: page([cell(0), cell(1), cell(2)]),
      '/api/check/digits/confirm': 3,
    })
    open('digits/7')
    const all = await tiles()
    await userEvent.click(all[0]!)
    await userEvent.keyboard('0')
    await userEvent.click(all[1]!)
    await userEvent.keyboard('1{Enter}')
    await waitFor(() => expect(server.posts['/api/check/digits/confirm']).toHaveLength(1))
    expect(server.posts['/api/check/digits/confirm']![0]).toEqual({
      cells: [
        { id: 'id0', digit: 'empty' },
        { id: 'id1', digit: '1' },
        { id: 'id2', digit: '7' },
      ],
    })
    expect(
      await screen.findByText(/Confirmed 3 cells, 2 with a fix\. Every tab is done\. Next: Kind/),
    ).toBeInTheDocument()
  })

  it('marks a cell that the person fixed to empty, and shows Empty on a cell the model left empty', async () => {
    fakeServer({ [D7]: page([cell(0), cell(1, { digit: 'empty' })]) })
    open('digits/7')
    const all = await tiles()
    expect(all[1]).not.toHaveAttribute('data-changed')
    expect(within(all[1]!).getByText('Empty')).toBeInTheDocument()
    await userEvent.click(all[0]!)
    await userEvent.keyboard('0')
    const fixed = (await tiles())[0]!
    expect(fixed).toHaveAttribute('data-changed', 'true')
    expect(fixed).toHaveClass('changed')
    expect(within(fixed).getByText('Empty')).toBeInTheDocument()
    expect(all[1]).not.toHaveAttribute('data-changed')
  })

  it('clears the selection with Escape, and goes back to the start with none', async () => {
    fakeServer({ [D7]: page([cell(0), cell(1)]) })
    open('digits/7')
    const all = await tiles()
    await userEvent.click(all[0]!)
    await userEvent.keyboard('{Escape}')
    expect(all[0]).toHaveAttribute('aria-pressed', 'false')
    expect(window.location.hash).toBe('#/digits/7')
    await userEvent.keyboard('{Escape}')
    expect(window.location.hash).toBe('#/')
  })

  it('asks for a selection before a key applies', async () => {
    fakeServer({ [D7]: page([cell(0)]) })
    open('digits/7')
    await tiles()
    await userEvent.keyboard('3')
    expect(screen.getByRole('alert')).toHaveTextContent('Select cells first.')
  })

  it('selects the cells that a drag box touches', async () => {
    fakeServer({ [D7]: page([cell(0), cell(1), cell(2)]) })
    open('digits/7')
    const all = await tiles()
    all.forEach((t, n) => vi.spyOn(t, 'getBoundingClientRect').mockReturnValue(new DOMRect(n * 70, 0, 64, 64)))
    fireEvent.mouseDown(all[0]!, { button: 0, clientX: 5, clientY: 5 })
    fireEvent.mouseMove(window, { clientX: 100, clientY: 40 })
    fireEvent.mouseUp(window, { clientX: 100, clientY: 40 })
    expect(all.map((t) => t.getAttribute('aria-pressed'))).toEqual(['true', 'true', 'false'])
    // The click that ends a drag does not toggle the tile under the pointer.
    fireEvent.click(all[1]!)
    expect(all[1]).toHaveAttribute('aria-pressed', 'true')
  })

  it('confirms the sure cells and refetches with a new threshold', async () => {
    const server = fakeServer({
      [D7]: page([cell(0)], { sure: 182 }),
      '/api/check/digits?digit=7&threshold=0.9': page([cell(0)], { sure: 240, threshold: 0.9 }),
      '/api/check/digits/sure': { cells: 240 },
    })
    open('digits/7')
    expect(
      await screen.findByRole('button', { name: 'Confirm 182 cells the model is at least 98 % sure of' }),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Threshold/), { target: { value: '90' } })
    const button = await screen.findByRole('button', { name: 'Confirm 240 cells the model is at least 90 % sure of' })
    await userEvent.click(button)
    await waitFor(() => expect(server.posts['/api/check/digits/sure']).toEqual([{ digit: '7', threshold: 0.9 }]))
    expect(await screen.findByText(/Confirmed 240 sure cells of this tab/)).toBeInTheDocument()
  })

  it('shows the sure button as counting until the count of the new threshold arrives', async () => {
    let release: (() => void) | undefined
    fakeServer({
      [D7]: page([cell(0)], { sure: 182 }),
      '/api/check/digits?digit=7&threshold=0.9': () =>
        new Promise((resolve) => {
          release = () => resolve(page([cell(0)], { sure: 240, threshold: 0.9 }))
        }),
    })
    open('digits/7')
    await screen.findByRole('button', { name: 'Confirm 182 cells the model is at least 98 % sure of' })
    fireEvent.change(screen.getByLabelText(/Threshold/), { target: { value: '90' } })
    const counting = await screen.findByRole('button', {
      name: /Counting the cells the model is at least 90 % sure of/,
    })
    expect(counting).toBeDisabled()
    expect(screen.queryByRole('button', { name: /Confirm 182 cells/ })).toBeNull()
    release?.()
    expect(
      await screen.findByRole('button', { name: 'Confirm 240 cells the model is at least 90 % sure of' }),
    ).toBeEnabled()
  })

  it('ignores Enter and the sure button while the reload after a confirm runs', async () => {
    let loads = 0
    let release: (() => void) | undefined
    const server = fakeServer({
      [D7]: () =>
        ++loads === 1
          ? page([cell(0)], { sure: 4 })
          : new Promise((resolve) => {
              release = () => resolve(page([cell(0)], { sure: 4 }))
            }),
      '/api/check/digits/confirm': 1,
      '/api/check/digits/sure': { cells: 4 },
    })
    open('digits/7')
    await tiles()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(loads).toBe(2))
    await userEvent.keyboard('{Enter}')
    const sure = screen.getByRole('button', { name: /Counting the cells/ })
    expect(sure).toBeDisabled()
    expect(server.posts['/api/check/digits/confirm']).toHaveLength(1)
    release?.()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Confirm 4 cells the model is at least 98 % sure of' }),
    )
    await waitFor(() => expect(server.posts['/api/check/digits/sure']).toHaveLength(1))
  })

  it('blocks Enter for a cell without a digit on the No guess tab', async () => {
    const server = fakeServer({
      '/api/check/digits?digit=unknown&threshold=0.98': page(
        [cell(0, { digit: null, kind: null, source: 'loose', photo: null, row: null, col: null, probs: null })],
        { digit: 'unknown', counts: { ...ZERO, unknown: 1 } },
      ),
      '/api/check/digits/confirm': 1,
    })
    open('digits/unknown')
    expect(await screen.findByRole('button', { name: /^No guess/ })).toBeInTheDocument()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('1 cell has no digit yet. Select each one and type its digit.')
    expect(server.posts['/api/check/digits/confirm']).toBeUndefined()
    await userEvent.click((await tiles())[0]!)
    await userEvent.keyboard('4{Enter}')
    await waitFor(() =>
      expect(server.posts['/api/check/digits/confirm']).toEqual([{ cells: [{ id: 'id0', digit: '4' }] }]),
    )
  })

  it('refuses P, H and U, which belong to the Kind step', async () => {
    fakeServer({ [D7]: page([cell(0)]) })
    open('digits/7')
    await userEvent.click((await tiles())[0]!)
    await userEvent.keyboard('p')
    expect(screen.getByRole('alert')).toHaveTextContent('The Digits step has no kind.')
  })

  it('says why the step is empty and what comes next', async () => {
    fakeServer({ '/api/check/digits?digit=empty&threshold=0.98': page([], { digit: 'empty', counts: ZERO }) })
    open('digits')
    expect(await screen.findByText(/No cell waits for a digit/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next: Kind' }))
    expect(window.location.hash).toBe('#/kinds')
  })
})

describe('The panel', () => {
  it('shows the sudoku, the top 3 digits, the fix, the reasons and the source', async () => {
    const digit = Array.from<number>({ length: 10 }).fill(0)
    digit[1] = 0.55
    digit[7] = 0.41
    digit[4] = 0.03
    const doubtful = cell(0, {
      doubt: 0.83,
      probs: { digit, kind: [0, 1, 0, 0] },
      reasons: [
        { signal: 'low-p', p: 0.41 },
        { signal: 'model-differs', predicted: '1', p: 0.55 },
        { signal: 'edited' },
        { signal: 'rule-break', unit: 'row', index: 3 },
        { signal: 'not-unique' },
      ],
    })
    fakeServer({ [D7]: page([doubtful, cell(40)]) })
    open('digits/7')
    const all = await tiles()
    const panel = screen.getByRole('complementary', { name: 'The cell in its sudoku' })
    expect(within(panel).getByAltText('The sudoku of aaaa')).toHaveAttribute('src', '/flat/aaaa.png')
    expect(panel).toHaveTextContent('1 55 %, 7 41 %, 4 3 %')
    expect(panel).toHaveTextContent('Doubt 83 %')
    expect(panel).toHaveTextContent('The model gives the label only 41 %')
    expect(panel).toHaveTextContent('The model reads 1 (55 %), not the label')
    expect(panel).toHaveTextContent('The player changed this label on the phone')
    expect(panel).toHaveTextContent('Breaks row 4: the digit shows twice')
    expect(panel).toHaveTextContent('The givens of this grid have more than one solution')
    expect(panel).toHaveTextContent('Uploaded scan aaaa, row 1, column 1')
    await userEvent.click(all[0]!)
    await userEvent.keyboard('9')
    expect(panel).toHaveTextContent('Your fix9')
    await userEvent.hover(all[1]!)
    expect(panel).toHaveTextContent('row 5, column 5')
  })

  it('says no photo for a loose cell', async () => {
    fakeServer({ [D7]: page([cell(0, { source: 'loose', photo: null, row: null, col: null })]) })
    open('digits/7')
    await tiles()
    expect(screen.getByText('No photo: a loose cell')).toBeInTheDocument()
    expect(screen.getByRole('complementary')).toHaveTextContent('A loose cell: no scan holds it')
  })

  it('writes one plain sentence per signal', () => {
    expect(signalText({ signal: 'rule-break', unit: 'col', index: 0 })).toBe('Breaks column 1: the digit shows twice')
    expect(signalText({ signal: 'rule-break', unit: 'box', index: 8 })).toBe('Breaks box 9: the digit shows twice')
    expect(signalText({ signal: 'model-differs', predicted: 'empty', p: 0.9 })).toBe(
      'The model reads an empty cell (90 %), not the label',
    )
    expect(signalText({ signal: 'no-guess' })).toBe('The model has no guess for this cell')
  })
})

describe('Kind', () => {
  it('shows tabs 1 to 9 only, with the kind probabilities in the panel', async () => {
    fakeServer({ [K7]: page([cell(0)], { threshold: 0.95 }) })
    open('kinds/7')
    await tiles()
    expect(screen.queryByRole('button', { name: /^Empty/ })).not.toBeInTheDocument()
    expect(screen.getByRole('complementary')).toHaveTextContent('printed 90 %, handwritten 8 %')
    expect(screen.getByRole('button', { name: /Confirm 0 cells the model is at least 95 % sure of/ })).toBeDisabled()
  })

  it('applies P, H and U to the selected cells and confirms the kinds', async () => {
    const server = fakeServer({
      [K7]: page([cell(0), cell(1), cell(2)], { threshold: 0.95 }),
      '/api/check/kinds/confirm': 3,
    })
    open('kinds/7')
    const all = await tiles()
    await userEvent.click(all[0]!)
    await userEvent.click(all[1]!)
    await userEvent.keyboard('h')
    await userEvent.click(all[2]!)
    await userEvent.keyboard('u{Enter}')
    await waitFor(() => expect(server.posts['/api/check/kinds/confirm']).toHaveLength(1))
    expect(server.posts['/api/check/kinds/confirm']![0]).toEqual({
      cells: [
        { id: 'id0', kind: 'handwritten' },
        { id: 'id1', kind: 'handwritten' },
        { id: 'id2', kind: 'unsure' },
      ],
    })
  })

  it('refuses a digit key and posts the sure route with the kind threshold', async () => {
    const server = fakeServer({
      [K7]: page([cell(0)], { sure: 12, threshold: 0.95 }),
      '/api/check/kinds/sure': { cells: 12 },
    })
    open('kinds/7')
    await userEvent.click((await tiles())[0]!)
    await userEvent.keyboard('3')
    expect(screen.getByRole('alert')).toHaveTextContent('The Kind step does not change digits.')
    await userEvent.click(screen.getByRole('button', { name: /Confirm 12 cells the model is at least 95 % sure of/ }))
    await waitFor(() => expect(server.posts['/api/check/kinds/sure']).toEqual([{ digit: '7', threshold: 0.95 }]))
  })

  it('blocks Enter for a cell without a kind', async () => {
    fakeServer({ [K7]: page([cell(0, { kind: null })], { threshold: 0.95 }) })
    open('kinds/7')
    await tiles()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('1 cell has no kind yet.')
  })

  it('says why the step is empty and what comes next', async () => {
    fakeServer({ '/api/check/kinds?digit=1&threshold=0.95': page([], { digit: '1', counts: ZERO }) })
    open('kinds')
    expect(await screen.findByText(/No cell waits for a kind/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next: Finish' }))
    expect(window.location.hash).toBe('#/finish')
  })
})

describe('Kind tabs', () => {
  it('shows the count of each kind and no kind tabs in the Digits step', async () => {
    fakeServer({ [K7]: kindPage([cell(0)]), [D7]: page([cell(0)]) })
    const { unmount } = open('kinds/7')
    await tiles()
    expect(screen.getByRole('button', { name: 'All 5' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Printed 3' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Handwritten 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unsure 0' })).toBeInTheDocument()
    unmount()
    open('digits/7')
    await tiles()
    expect(screen.queryByRole('navigation', { name: 'Kinds' })).not.toBeInTheDocument()
  })

  it('puts the kind in the route and in the request', async () => {
    const server = fakeServer({
      [K7]: kindPage([cell(0)]),
      [KP7]: kindPage([cell(1)]),
      [`${K7}&kind=handwritten`]: kindPage([cell(2, { kind: 'handwritten' })]),
    })
    open('kinds/7/printed')
    expect((await tiles())[0]).toHaveAttribute('aria-label', 'Cell stem1, P')
    expect(screen.getByRole('button', { name: 'Printed 3' })).toHaveAttribute('aria-current', 'page')
    await userEvent.click(screen.getByRole('button', { name: 'Handwritten 2' }))
    expect(window.location.hash).toBe('#/kinds/7/handwritten')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cell stem2, H' })).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'All 5' }))
    expect(window.location.hash).toBe('#/kinds/7')
    expect(server.posts).toEqual({})
  })

  it('keeps the kind when the digit tab changes', async () => {
    fakeServer({
      [KP7]: kindPage([cell(1)]),
      '/api/check/kinds?digit=3&threshold=0.95&kind=printed': kindPage([cell(4, { digit: '3' })], KC, {
        digit: '3',
        counts: { ...ZERO, '7': 5, '3': 5 },
      }),
    })
    open('kinds/7/printed')
    await tiles()
    await userEvent.click(screen.getByRole('button', { name: /^3 / }))
    expect(window.location.hash).toBe('#/kinds/3/printed')
  })

  it('confirms the sure cells of the shown kind only', async () => {
    const server = fakeServer({
      [KP7]: kindPage([cell(1)], KC, { sure: 2 }),
      '/api/check/kinds/sure': { cells: 2 },
    })
    open('kinds/7/printed')
    await tiles()
    await userEvent.click(screen.getByRole('button', { name: /Confirm 2 cells the model is at least 95 % sure of/ }))
    await waitFor(() =>
      expect(server.posts['/api/check/kinds/sure']).toEqual([{ digit: '7', threshold: 0.95, kind: 'printed' }]),
    )
  })

  it('confirms the cells of the shown kind with Enter and moves on when the kind tab empties', async () => {
    let confirmed = false
    const server = fakeServer({
      [KP7]: () =>
        confirmed
          ? kindPage([], { all: 2, printed: 0, handwritten: 2, unsure: 0 }, { counts: { ...ZERO, '7': 2 } })
          : kindPage([cell(1)], { all: 3, printed: 1, handwritten: 2, unsure: 0 }, { counts: { ...ZERO, '7': 3 } }),
      [`${K7}&kind=handwritten`]: kindPage([cell(2, { kind: 'handwritten' })], {
        all: 2,
        printed: 0,
        handwritten: 2,
        unsure: 0,
      }),
      '/api/check/kinds/confirm': () => {
        confirmed = true
        return 1
      },
    })
    open('kinds/7/printed')
    await tiles()
    await userEvent.keyboard('{Enter}')
    await waitFor(() =>
      expect(server.posts['/api/check/kinds/confirm']).toEqual([{ cells: [{ id: 'id1', kind: 'printed' }] }]),
    )
    await waitFor(() => expect(window.location.hash).toBe('#/kinds/7/handwritten'))
  })

  it('keeps a fixed cell in view and says what is next for an empty kind tab', async () => {
    fakeServer({
      [KP7]: kindPage([cell(1)]),
      [`${K7}&kind=unsure`]: kindPage([], KC, { counts: { ...ZERO, '7': 5 } }),
    })
    open('kinds/7/printed')
    await userEvent.click((await tiles())[0]!)
    await userEvent.keyboard('h')
    expect(await tiles()).toHaveLength(1)
    window.location.hash = '#/kinds/7/unsure'
    expect(await screen.findByText(/No unsure cell of the digit 7 is open/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next: All' }))
    expect(window.location.hash).toBe('#/kinds/7')
  })
})
