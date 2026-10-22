import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
  it('shows the one flow with its counts and opens the next step', async () => {
    fakeServer({ '/api/start': START })
    open('')
    expect(await screen.findByText('2 to check')).toBeInTheDocument()
    expect(screen.getByText('12 cells')).toBeInTheDocument()
    expect(screen.getByText('3 cells')).toBeInTheDocument()
    expect(screen.getAllByRole('region', { name: 'Label new scans' })).toHaveLength(1)
    expect(screen.queryByText(/Guess them now/)).not.toBeInTheDocument()
    await userEvent.keyboard('{Enter}')
    expect(window.location.hash).toBe('#/outlines')
  })

  it('opens the Digits step when no outline waits', async () => {
    fakeServer({ '/api/start': { ...START, outlines: 0 } })
    open('')
    await userEvent.click(await screen.findByRole('button', { name: /Next: Digits/ }))
    expect(window.location.hash).toBe('#/digits')
  })

  it('offers the older labels as a tool outside the flow', async () => {
    fakeServer({ '/api/start': START })
    open('')
    const tool = await screen.findByRole('link', { name: /Check older labels/ })
    expect(tool).toHaveAttribute('href', '#/doubtful')
    expect(screen.getByText('Not computed in this run')).toBeInTheDocument()
  })

  it('says when no model guessed and guesses the cells on a click', async () => {
    const server = fakeServer({
      '/api/start': { ...START, model: null, not_prelabelled: 40 },
      '/api/prelabel': 40,
    })
    open('')
    expect(await screen.findByText(/No model guessed the cells yet/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Guess them now' }))
    expect(await screen.findByText(/The model guessed 40 cells/)).toBeInTheDocument()
    expect(server.posts['/api/prelabel']).toHaveLength(1)
  })

  it('names the cells without a guess of the run', async () => {
    fakeServer({ '/api/start': { ...START, not_prelabelled: 7 } })
    open('')
    expect(await screen.findByText(/7 cells have no guess of the model run run-1/)).toBeInTheDocument()
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
    open('fetch')
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
    open('fetch')
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
    open('outlines')
    await userEvent.click(await screen.findByAltText('Scan aaaa'))
    expect(screen.getByRole('button', { name: /Approve 1 outline, then fix 2/ })).toBeInTheDocument()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(window.location.hash).toBe('#/outlines/aaaa'))
    expect(server.posts['/api/outlines/approve']).toEqual([{ photos: ['bbbb'] }])
  })

  it('says why the gallery is empty and what comes next', async () => {
    fakeServer({ '/api/outlines': { scans: [], open: 0, page: 0, pages: 1 } })
    open('outlines')
    expect(await screen.findByText('Every outline is checked.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next: Digits' }))
    expect(window.location.hash).toBe('#/digits')
  })
})

describe('The large outline view', () => {
  const ONE = { photo: 'aaaa', source: 'app', status: 'unchecked', width: 100, height: 80, corners: null }

  it('starts from an inset outline, turns it with T and saves it with Enter', async () => {
    const server = fakeServer({
      '/api/outline?photo=aaaa': ONE,
      '/api/outlines/fix': { cells: 81, kept: 0, discarded: 81 },
    })
    open('outlines/aaaa')
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
    await waitFor(() => expect(window.location.hash).toBe('#/outlines'))
  })

  it('rejects the photo with R', async () => {
    const server = fakeServer({ '/api/outline?photo=aaaa': ONE, '/api/outlines/reject': 1 })
    open('outlines/aaaa')
    await screen.findByRole('img', { name: 'The photo with its outline' })
    await userEvent.keyboard('r')
    await waitFor(() => expect(server.posts['/api/outlines/reject']).toEqual([{ photo: 'aaaa' }]))
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
    open('doubtful')
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
    open('doubtful')
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

const READY = { ...START, kind_cells: 0 }

describe('Finish', () => {
  it('finishes and says to commit the tables', async () => {
    const server = fakeServer({
      '/api/start': READY,
      '/api/finish': {
        report: {},
        text: 'cells: 120',
        removed: ['journal.jsonl'],
        review_closed: null,
        still_waiting: { cells: 0, photos: 0 },
      },
    })
    open('finish')
    await userEvent.click(await screen.findByRole('button', { name: /Finish 5 changes/ }))
    expect(await screen.findByText(/git add ml\/dataset/)).toBeInTheDocument()
    expect(screen.getByText('cells: 120')).toBeInTheDocument()
    expect(server.posts['/api/finish']).toHaveLength(1)
  })

  it('shows the reason when the data check stops Finish', async () => {
    fakeServer({
      '/api/start': READY,
      '/api/finish': new Refusal(400, { error: 'Finish stopped and deleted nothing.' }),
    })
    open('finish')
    await screen.findByRole('button', { name: /Finish 5 changes/ })
    await userEvent.keyboard('{Enter}')
    expect(await screen.findByText('Finish stopped and deleted nothing.')).toBeInTheDocument()
  })
})

describe('Finish with Kind cells waiting', () => {
  it('says how many wait, disables Finish and opens the Kind step', async () => {
    const server = fakeServer({ '/api/start': START, '/api/finish': {} })
    open('finish')
    expect(await screen.findByText(/3 cells wait in the Kind step/)).toBeInTheDocument()
    const finish = screen.getByRole('button', { name: /Finish 5 changes/ })
    expect(finish).toBeDisabled()
    await userEvent.keyboard('{Enter}')
    expect(server.posts['/api/finish']).toBeUndefined()
    await userEvent.click(screen.getByRole('button', { name: 'Open Kind' }))
    expect(window.location.hash).toBe('#/kinds')
  })
})

describe('Every step', () => {
  it('shows its keys with ?, and Z undoes the last change', async () => {
    const server = fakeServer({ '/api/start': READY, '/api/undo': { lines: 2, what: 'kinds' } })
    open('finish')
    await screen.findByRole('button', { name: /Finish 5 changes/ })
    await userEvent.keyboard('?')
    expect(screen.getByRole('dialog', { name: 'Keys of this step' })).toHaveTextContent('Undo the last change')
    await userEvent.keyboard('?z')
    expect(await screen.findByText('Undid the last change: a page of kinds.')).toBeInTheDocument()
    expect(server.posts['/api/undo']).toHaveLength(1)
  })

  it('goes back to the start with Escape', async () => {
    fakeServer({ '/api/start': READY })
    open('finish')
    await screen.findByRole('button', { name: /Finish 5 changes/ })
    await userEvent.keyboard('{Escape}')
    expect(window.location.hash).toBe('#/')
  })
})
