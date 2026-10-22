import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Scan, ScanCell } from '../api/types'
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
    await userEvent.click(screen.getByRole('button', { name: 'Next: Cells per scan' }))
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

function scanCell(n: number, extra: Partial<ScanCell> = {}): ScanCell {
  return {
    row: Math.floor(n / 9),
    col: n % 9,
    id: `id${n}`,
    stem: `stem${n}`,
    digit: 'empty',
    kind: null,
    suggested: false,
    edited: false,
    reviewed: false,
    shared: null,
    locked: false,
    ...extra,
  }
}

function scan(cells: Scan['cells']): Scan {
  return { photo: 'aaaa', source: 'app', status: 'accepted', width: 100, height: 80, corners: null, cells }
}

describe('Cells per scan', () => {
  it('opens the first scan that waits', async () => {
    fakeServer({ '/api/scans': { scans: [{ photo: 'aaaa', source: 'app', open: 2, edited: 0 }] } })
    open('a/cells')
    await waitFor(() => expect(window.location.hash).toBe('#/a/cells/aaaa'))
  })

  it('fixes the selected cell with keys and confirms the own cells of the scan', async () => {
    const cells = [
      scanCell(0, { digit: '7', kind: 'printed', edited: true }),
      scanCell(1),
      scanCell(2, { shared: 'bbbb' }),
      { row: 0, col: 3, missing: true as const },
    ]
    const server = fakeServer({
      '/api/scans': { scans: [{ photo: 'aaaa', source: 'app', open: 2, edited: 1 }] },
      '/api/scan?photo=aaaa': scan(cells),
      '/api/scans/confirm': 3,
    })
    open('a/cells/aaaa')
    await screen.findByText('7 P')
    expect(screen.getByTitle('The player corrected this cell')).toBeInTheDocument()
    await userEvent.keyboard('{ArrowRight}4h{Enter}')
    await waitFor(() => expect(server.posts['/api/scans/confirm']).toHaveLength(1))
    expect(server.posts['/api/scans/confirm']![0]).toEqual({
      photo: 'aaaa',
      cells: [
        { id: 'id0', digit: '7', kind: 'printed' },
        { id: 'id1', digit: '4', kind: 'handwritten' },
      ],
    })
  })

  it('refuses a confirm while a cell has no digit', async () => {
    const server = fakeServer({
      '/api/scans': { scans: [{ photo: 'aaaa', source: 'photo', open: 1, edited: 0 }] },
      '/api/scan?photo=aaaa': { ...scan([scanCell(0, { digit: null, suggested: true })]), source: 'photo' },
    })
    open('a/cells/aaaa')
    expect(await screen.findByText(/the model reads/)).toBeInTheDocument()
    await userEvent.keyboard('{Enter}')
    expect(await screen.findByText(/1 cells have no digit yet/)).toBeInTheDocument()
    expect(server.posts['/api/scans/confirm']).toBeUndefined()
  })

  it('says why the step is empty and what comes next', async () => {
    fakeServer({ '/api/scans': { scans: [] } })
    open('a/cells')
    expect(await screen.findByText('No approved scan waits for its cells.')).toBeInTheDocument()
  })
})
