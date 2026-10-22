import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from '../App'
import { fakeServer, Refusal, START } from '../test/fakeServer'

beforeEach(() => {
  window.location.hash = ''
})
afterEach(() => vi.unstubAllGlobals())

function open(route: string) {
  window.location.hash = `#/${route}`
  return render(<App />)
}

const COUNTS = { empty: 0, '1': 0, '2': 3, '3': 0, '4': 0, '5': 0, '6': 0, '7': 1, '8': 0, '9': 0 }
const TWOS = {
  digit: '2',
  kinds: 'all',
  cells: [
    { id: 'a', stem: 'sa', p: 0.41 },
    { id: 'b', stem: 'sb', p: 0.7 },
    { id: 'c', stem: 'sc', p: 0.99 },
  ],
  left: 3,
  counts: COUNTS,
  not_prelabelled: 0,
}

describe('Pre-label', () => {
  it('guesses the cells without a guess', async () => {
    const server = fakeServer({ '/api/start': { ...START, not_prelabelled: 4 }, '/api/prelabel': 4 })
    open('b/prelabel')
    await userEvent.click(await screen.findByRole('button', { name: /Guess 4 cells/ }))
    expect(await screen.findByText('The model guessed 4 cells. Next: Digits.')).toBeInTheDocument()
    expect(server.posts['/api/prelabel']).toHaveLength(1)
  })

  it('says when every loose cell has a guess', async () => {
    fakeServer({ '/api/start': START })
    open('b/prelabel')
    expect(await screen.findByText('Every loose cell has a guess of the model.')).toBeInTheDocument()
  })
})

describe('Digits', () => {
  it('opens the first digit with cells, the least sure first', async () => {
    fakeServer({ '/api/digits?digit=empty': { ...TWOS, digit: 'empty', cells: [] }, '/api/digits?digit=2': TWOS })
    open('b/digits')
    await waitFor(() => expect(window.location.hash).toBe('#/b/digits/2'))
    expect(await screen.findByText('41 %')).toBeInTheDocument()
  })

  it('confirms the page with the fixes and the gallery digit for the rest', async () => {
    const server = fakeServer({ '/api/digits?digit=2': TWOS, '/api/digits/assign': 3 })
    open('b/digits/2')
    const tiles = await screen.findAllByRole('button', { name: /^Cell / })
    await userEvent.click(tiles[0]!)
    await userEvent.keyboard('7')
    await userEvent.click(tiles[1]!)
    await userEvent.keyboard('x')
    expect(screen.getByText('2 fixed, 1 stay 2')).toBeInTheDocument()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(server.posts['/api/digits/assign']).toHaveLength(1))
    expect(server.posts['/api/digits/assign']![0]).toEqual({
      cells: [
        { id: 'a', digit: '7' },
        { id: 'b', digit: 'discarded' },
        { id: 'c', digit: '2' },
      ],
    })
    expect(await screen.findByText('Confirmed 3 cells, 2 with a fix.')).toBeInTheDocument()
  })

  it('refuses a page with a marked cell that has no digit', async () => {
    const server = fakeServer({ '/api/digits?digit=2': TWOS })
    open('b/digits/2')
    const tiles = await screen.findAllByRole('button', { name: /^Cell / })
    await userEvent.click(tiles[0]!)
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('One cell is marked without a digit.')
    expect(server.posts['/api/digits/assign']).toBeUndefined()
  })

  it('says why the step is empty and what comes next', async () => {
    fakeServer({
      '/api/digits?digit=empty': { ...TWOS, digit: 'empty', cells: [], counts: { ...COUNTS, '2': 0, '7': 0 } },
    })
    open('b/digits')
    expect(await screen.findByText('Every loose cell has a digit.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next: Kind' })).toBeInTheDocument()
  })
})

const KIND_PAGE = {
  folder: '7',
  group: 0,
  groups: 1,
  page: 0,
  pages: 1,
  ungrouped: true,
  predicted: 'printed',
  cells: [
    { id: 'a', stem: 'sa', kind: null, start: 'printed', least_sure: true, kp: 0.6, model_kind: 'printed' },
    { id: 'b', stem: 'sb', kind: null, start: 'printed', least_sure: false, kp: 0.9, model_kind: 'printed' },
  ],
  progress: { cells: 2, labelled: 0 },
}

describe('Kind', () => {
  it('sets the page with H, flips one cell and saves the page', async () => {
    const server = fakeServer({
      '/api/kinds': KIND_PAGE,
      '/api/kinds/save': 2,
      '/api/kinds?folder=7&group=0&page=0': null,
    })
    open('b/kinds')
    expect(await screen.findByText(/The model reads these cells as printed. The page is printed./)).toBeInTheDocument()
    await userEvent.keyboard('h')
    await userEvent.click(screen.getAllByRole('button', { name: /^Cell / })[0]!)
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(server.posts['/api/kinds/save']).toHaveLength(1))
    expect(server.posts['/api/kinds/save']![0]).toEqual({
      cells: [
        { id: 'a', kind: 'printed' },
        { id: 'b', kind: 'handwritten' },
      ],
    })
    expect(await screen.findByText('Every digit cell has a kind.')).toBeInTheDocument()
  })
})

describe('Doubtful labels', () => {
  it('finds the doubtful labels when the check never ran', async () => {
    let ran = false
    fakeServer({
      '/api/doubtful': () =>
        ran
          ? {
              items: [
                {
                  id: 'a',
                  stem: 'sa',
                  field: 'digit',
                  folder: '7',
                  kind: 'printed',
                  reasons: [{ reason: 'digit-model', predicted: '1', p_predicted: 0.95 }],
                },
              ],
              open: 1,
              suspects: true,
            }
          : { items: [], open: 0, suspects: false },
      '/api/suspects': () => {
        ran = true
        return { open: 1 }
      },
    })
    open('b/doubtful')
    await userEvent.click(await screen.findByRole('button', { name: 'Find doubtful labels' }))
    expect(await screen.findByText('The model reads 1 (95 %)')).toBeInTheDocument()
    expect(screen.getByText('Found 1 doubtful labels.')).toBeInTheDocument()
  })

  it('settles the page with a fix', async () => {
    const page = {
      items: [
        {
          id: 'a',
          stem: 'sa',
          field: 'digit',
          folder: '7',
          kind: 'printed',
          reasons: [{ reason: 'digit-model', predicted: '1' }],
        },
        { id: 'b', stem: 'sb', field: 'kind', folder: '4', kind: 'printed', reasons: [{ reason: 'near-duplicate' }] },
      ],
      open: 2,
      suspects: true,
    }
    const server = fakeServer({ '/api/doubtful': page, '/api/doubtful/save': 4 })
    open('b/doubtful')
    await userEvent.click((await screen.findAllByRole('button', { name: /^Cell / }))[0]!)
    await userEvent.keyboard('1h{Enter}')
    await waitFor(() => expect(server.posts['/api/doubtful/save']).toHaveLength(1))
    expect(server.posts['/api/doubtful/save']![0]).toEqual({
      cells: [
        { id: 'a', digit: '1', kind: 'handwritten' },
        { id: 'b', digit: '4', kind: 'printed' },
      ],
    })
  })
})

describe('Finish', () => {
  it('finishes and says to commit the tables', async () => {
    const server = fakeServer({
      '/api/start': START,
      '/api/finish': {
        text: 'cells: 120',
        removed: ['journal.jsonl'],
        review_closed: null,
        still_waiting: { cells: 0, photos: 0 },
      },
    })
    open('b/finish')
    await userEvent.click(await screen.findByRole('button', { name: /Finish 5 changes/ }))
    expect(await screen.findByText(/git add ml\/dataset/)).toBeInTheDocument()
    expect(screen.getByText('cells: 120')).toBeInTheDocument()
    expect(server.posts['/api/finish']).toHaveLength(1)
  })

  it('shows the reason when the data check stops Finish', async () => {
    fakeServer({
      '/api/start': START,
      '/api/finish': new Refusal(400, { error: 'Finish stopped and deleted nothing.' }),
    })
    open('a/finish')
    await userEvent.keyboard('{Enter}')
    await screen.findByRole('button', { name: /Finish 5 changes/ })
    await userEvent.keyboard('{Enter}')
    expect(await screen.findByText('Finish stopped and deleted nothing.')).toBeInTheDocument()
  })
})

describe('Every step', () => {
  it('shows its keys with ?, and Z undoes the last change', async () => {
    const server = fakeServer({ '/api/start': START, '/api/undo': 2 })
    open('b/finish')
    await screen.findByRole('button', { name: /Finish 5 changes/ })
    await userEvent.keyboard('?')
    expect(screen.getByRole('dialog', { name: 'Keys of this step' })).toHaveTextContent('Undo the last change')
    await userEvent.keyboard('?z')
    expect(await screen.findByText('Undid the last change.')).toBeInTheDocument()
    expect(server.posts['/api/undo']).toHaveLength(1)
  })

  it('goes back to the start with Escape', async () => {
    fakeServer({ '/api/start': START })
    open('b/finish')
    await screen.findByRole('button', { name: /Finish 5 changes/ })
    await userEvent.keyboard('{Escape}')
    expect(window.location.hash).toBe('#/')
  })
})
