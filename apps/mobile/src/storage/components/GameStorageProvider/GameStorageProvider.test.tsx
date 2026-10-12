import { render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import { useGameStorage } from '@/storage/hooks/useGameStorage'
import { createMemoryStorage, type GameStorage } from '@/storage'
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
