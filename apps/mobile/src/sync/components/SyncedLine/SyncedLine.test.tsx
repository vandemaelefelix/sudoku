import { act, render, screen } from '@testing-library/react-native'
import { AccountContext, type Account } from '@/account/hooks/useAccount'
import { SyncContext } from '@/sync/hooks/useSync'
import { SyncedLine } from './SyncedLine'

function accountOf(status: Account['status']): Account {
  return { status, email: null, signOut: async () => true, getApiToken: async () => null }
}

function line(status: Account['status'], lastSyncedAt: string | null) {
  return (
    <AccountContext value={accountOf(status)}>
      <SyncContext value={{ lastSyncedAt, revision: 0 }}>
        <SyncedLine />
      </SyncContext>
    </AccountContext>
  )
}

afterEach(() => {
  jest.useRealTimers()
})

it('shows the time of the last sync for a signed-in player', () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-15T12:05:00.000Z'))
  render(line('signedIn', '2026-10-15T12:00:00.000Z'))
  expect(screen.getByText('Synced 5 min ago')).toBeTruthy()
})

it.each<Account['status']>(['signedOut', 'loading', 'unconfigured'])('shows nothing when %s', (status) => {
  render(line(status, '2026-10-15T12:00:00.000Z'))
  expect(screen.toJSON()).toBeNull()
})

it('shows nothing before the first sync', () => {
  render(line('signedIn', null))
  expect(screen.toJSON()).toBeNull()
})

it('refreshes the text every minute', () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-15T12:00:30.000Z'))
  render(line('signedIn', '2026-10-15T12:00:00.000Z'))
  expect(screen.getByText('Synced just now')).toBeTruthy()
  act(() => {
    jest.advanceTimersByTime(60_000)
  })
  expect(screen.getByText('Synced 1 min ago')).toBeTruthy()
})
