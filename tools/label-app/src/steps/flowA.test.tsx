import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CheckCell } from '../api/types'
import { App } from '../App'
import { fakeServer, Refusal, START } from '../test/fakeServer'
import { fixQueue } from './Outlines'

beforeEach(() => {
  window.location.hash = ''
  fixQueue.length = 0
})
afterEach(() => vi.unstubAllGlobals())

function open(route: string) {
  window.location.hash = `#/${route}`
  return render(<App />)
}

describe('Start', () => {
  it('shows both flows with their counts and opens the next step of a flow', async () => {
    fakeServer({ '/api/start': START })
    open('')
    expect(await screen.findByText('2 to check')).toBeInTheDocument()
    expect(screen.getByText('12 cells')).toBeInTheDocument()
    expect(screen.getByText('Not computed in this run')).toBeInTheDocument()
    await userEvent.keyboard('a')
    expect(window.location.hash).toBe('#/a/outlines')
  })
})

describe('Fetch', () => {
  it('fetches the stage and says what comes next', async () => {
    const server = fakeServer({
      '/api/fetch': {
        pulled: 2,
        already_pulled: 0,
        cells: 160,
        invalid: [],
        fixture: [],
        missing_photo: ['x'],
        stage: 'dev',
        table: 't',
        bucket: 'b',
      },
    })
    open('a/fetch')
    await userEvent.click(screen.getByLabelText('dev'))
    await userEvent.click(screen.getByRole('button', { name: /Fetch new scans/ }))
    expect(await screen.findByText('Fetched 2 new scans with 160 cells from dev.')).toBeInTheDocument()
    expect(screen.getByText(/1 without a photo yet/)).toBeInTheDocument()
    expect(server.posts['/api/fetch']).toEqual([{ stage: 'dev' }])
  })

  it('offers the AWS sign-in when the session expired', async () => {
    const server = fakeServer({
      '/api/fetch': new Refusal(401, { error: 'The AWS session expired.', sign_in: true }),
      '/api/aws-login': null,
    })
    open('a/fetch')
    await userEvent.keyboard('{Enter}')
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in to AWS' }))
    expect(server.posts['/api/aws-login']).toHaveLength(1)
    expect(await screen.findByText(/A browser window opens for the sign-in/)).toBeInTheDocument()
  })
})

const OUTLINES = {
  scans: [
    {
      photo: 'aaaa',
      source: 'app',
      fit: 0.2,
      corners: [
        [0, 0],
        [9, 0],
        [9, 9],
        [0, 9],
      ],
    },
    {
      photo: 'bbbb',
      source: 'photo',
      fit: 0.9,
      corners: [
        [0, 0],
        [9, 0],
        [9, 9],
        [0, 9],
      ],
    },
    { photo: 'cccc', source: 'photo', fit: -1, corners: null },
  ],
  open: 3,
  page: 0,
  pages: 1,
}

describe('Outlines', () => {
  it('approves the unmarked outlines and opens the marked ones large', async () => {
    const server = fakeServer({ '/api/outlines': OUTLINES, '/api/outlines/approve': 1 })
    open('a/outlines')
    await userEvent.click(await screen.findByAltText('Scan aaaa'))
    expect(screen.getByRole('button', { name: /Approve 1 outline, then fix 2/ })).toBeInTheDocument()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(window.location.hash).toBe('#/a/outlines/aaaa'))
    expect(server.posts['/api/outlines/approve']).toEqual([{ photos: ['bbbb'] }])
  })

  it('says why the gallery is empty and what comes next', async () => {
    fakeServer({ '/api/outlines': { scans: [], open: 0, page: 0, pages: 1 } })
    open('a/outlines')
    expect(await screen.findByText('Every outline is checked.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next: Cells per digit' }))
    expect(window.location.hash).toBe('#/a/cells')
  })
})

describe('The large outline view', () => {
  const ONE = { photo: 'aaaa', source: 'app', status: 'unchecked', width: 100, height: 80, corners: null }

  it('starts from an inset outline, turns it with T and saves it with Enter', async () => {
    const server = fakeServer({
      '/api/outline?photo=aaaa': ONE,
      '/api/outlines/fix': { cells: 81, kept: 0, discarded: 81 },
    })
    open('a/outlines/aaaa')
    await screen.findByRole('img', { name: 'The photo with its outline' })
    await userEvent.keyboard('t{Enter}')
    await waitFor(() => expect(server.posts['/api/outlines/fix']).toHaveLength(1))
    expect(server.posts['/api/outlines/fix']![0]).toEqual({
      photo: 'aaaa',
      corners: [
        [10, 72],
        [10, 8],
        [90, 8],
        [90, 72],
      ],
    })
    await waitFor(() => expect(window.location.hash).toBe('#/a/outlines'))
  })

  it('rejects the photo with R', async () => {
    const server = fakeServer({ '/api/outline?photo=aaaa': ONE, '/api/outlines/reject': 1 })
    open('a/outlines/aaaa')
    await screen.findByRole('img', { name: 'The photo with its outline' })
    await userEvent.keyboard('r')
    await waitFor(() => expect(server.posts['/api/outlines/reject']).toEqual([{ photo: 'aaaa' }]))
  })
})

function checkCell(n: number, extra: Partial<CheckCell> = {}): CheckCell {
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
    model: { digit: '7', p: 0.9, kind: 'printed' },
    ...extra,
  }
}

const COUNTS = { empty: 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 3, '8': 0, '9': 0, unknown: 0 }

function sevens(cells: CheckCell[]) {
  return { digit: '7', cells, left: cells.length, counts: COUNTS }
}

describe('Cells per digit', () => {
  it('opens the first digit with cells', async () => {
    fakeServer({ '/api/cells?digit=empty': { ...sevens([]), digit: 'empty' }, '/api/cells?digit=7': sevens([]) })
    open('a/cells')
    await waitFor(() => expect(window.location.hash).toBe('#/a/cells/7'))
  })

  it('moves on to the next digit with cells when this digit has none left', async () => {
    fakeServer({ '/api/cells?digit=3': { ...sevens([]), digit: '3' }, '/api/cells?digit=7': sevens([checkCell(0)]) })
    open('a/cells/3')
    await waitFor(() => expect(window.location.hash).toBe('#/a/cells/7'))
  })

  it('shows the pointed cell in its sudoku with the model guess and the fix', async () => {
    const cells = [checkCell(0, { edited: true, model: { digit: '1', p: 0.62, kind: 'handwritten' } }), checkCell(40)]
    fakeServer({ '/api/cells?digit=7': sevens(cells) })
    open('a/cells/7')
    const tiles = await screen.findAllByRole('button', { name: /^Cell / })
    const detail = screen.getByRole('complementary', { name: 'The cell in its sudoku' })
    expect(detail).toHaveTextContent('7 P, corrected by the player')
    expect(detail).toHaveTextContent('1 H, 62 %')
    await userEvent.hover(tiles[1]!)
    expect(detail).toHaveTextContent('row 5, column 5')
    await userEvent.click(tiles[0]!)
    await userEvent.keyboard('1h')
    expect(detail).toHaveTextContent('Your fix1 H')
  })

  it('confirms the page with the digit and kind fixes', async () => {
    const server = fakeServer({
      '/api/cells?digit=7': sevens([checkCell(0), checkCell(1), checkCell(2)]),
      '/api/cells/verify': 4,
    })
    open('a/cells/7')
    const tiles = await screen.findAllByRole('button', { name: /^Cell / })
    await userEvent.click(tiles[0]!)
    await userEvent.keyboard('1h')
    await userEvent.click(tiles[1]!)
    await userEvent.keyboard('x{Enter}')
    await waitFor(() => expect(server.posts['/api/cells/verify']).toHaveLength(1))
    expect(server.posts['/api/cells/verify']![0]).toEqual({
      cells: [
        { id: 'id0', digit: '1', kind: 'handwritten' },
        { id: 'id1', digit: 'discarded', kind: null },
        { id: 'id2', digit: '7', kind: 'printed' },
      ],
    })
    expect(await screen.findByText('Confirmed 3 cells, 2 with a fix.')).toBeInTheDocument()
  })

  it('refuses cells without a digit on the No guess tab', async () => {
    const server = fakeServer({
      '/api/cells?digit=unknown': {
        digit: 'unknown',
        cells: [checkCell(0, { digit: null, kind: null, source: 'photo', model: null })],
        left: 1,
        counts: { ...COUNTS, unknown: 1 },
      },
    })
    open('a/cells/unknown')
    expect(await screen.findByRole('button', { name: /No guess/ })).toBeInTheDocument()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('1 cells have no digit yet.')
    expect(server.posts['/api/cells/verify']).toBeUndefined()
  })

  it('says why the step is empty and what comes next', async () => {
    fakeServer({ '/api/cells?digit=empty': { ...sevens([]), digit: 'empty', counts: { ...COUNTS, '7': 0 } } })
    open('a/cells')
    expect(await screen.findByText('No cell of an approved scan waits for a check.')).toBeInTheDocument()
  })
})
