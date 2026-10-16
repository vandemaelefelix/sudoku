import { useEffect } from 'react'
import { render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import { useGameStorage } from '@/storage/hooks/useGameStorage'
import { createMemoryStorage, type GameStorage } from '@/storage'
import { newGame, wonGame } from '@/storage/repositories.contract'
import { GameStorageProvider } from './GameStorageProvider'

function Probe({ expected }: { expected?: GameStorage }) {
  const storage = useGameStorage()
  return <Text>{expected === undefined || storage === expected ? 'storage ready' : 'other storage'}</Text>
}

it('renders nothing while the storage opens, then shares it', async () => {
  const storage = createMemoryStorage()
  render(
    <GameStorageProvider open={async () => storage}>
      <Probe expected={storage} />
    </GameStorageProvider>,
  )
  expect(screen.queryByText('storage ready')).toBeNull()
  expect(await screen.findByText('storage ready')).toBeTruthy()
})

it('falls back to the in-memory storage when the database does not open', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  render(
    <GameStorageProvider open={async () => Promise.reject(new RangeError('newer schema'))}>
      <Probe />
    </GameStorageProvider>,
  )
  expect(await screen.findByText('storage ready')).toBeTruthy()
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('[storage] The game storage does not open'))
  warn.mockRestore()
})

it('refuses useGameStorage outside the provider', () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  expect(() => render(<Probe />)).toThrow('useGameStorage needs a GameStorageProvider')
  error.mockRestore()
})

it('gives the in-memory fallback the real clock, so the streak counts from today', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  let fallback: GameStorage | null = null
  function Grab() {
    const storage = useGameStorage()
    useEffect(() => {
      fallback = storage
    }, [storage])
    return <Text>grabbed</Text>
  }
  render(
    <GameStorageProvider open={async () => Promise.reject(new RangeError('newer schema'))}>
      <Grab />
    </GameStorageProvider>,
  )
  await screen.findByText('grabbed')
  const { puzzles, history } = fallback as unknown as GameStorage
  const { id } = await puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
  await puzzles.save(id, wonGame(1_000), null)
  const [entry] = await history.list(null)
  expect(entry?.finishedAt.slice(0, 10)).toBe(new Date().toISOString().slice(0, 10))
  warn.mockRestore()
})
