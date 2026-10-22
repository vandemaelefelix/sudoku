import { act, renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { DEFAULT_ASSISTS, type AssistName } from '@/game/constants/assists.constants'
import { GameProvider } from '@/game/components/GameProvider'
import { useAssists } from '@/game/hooks/useAssists'
import { useGameActions } from '@/game/hooks/useGameActions'
import { sampleStart } from '@/game/utils/sample.utils'
import { useCellViews } from './useCellViews'

const wrapper = ({ children }: { children: ReactNode }) => <GameProvider start={sampleStart()}>{children}</GameProvider>

const useGameAndAssists = () => ({ views: useCellViews(), actions: useGameActions(), ...useAssists() })

afterEach(async () => {
  const { result, unmount } = renderHook(() => useAssists())
  const names = Object.keys(DEFAULT_ASSISTS) as AssistName[]
  await act(async () => {
    names.forEach((name) => result.current.setAssist(name, true))
  })
  unmount()
})

it('follows a switch at once, without a new game', async () => {
  const { result } = renderHook(useGameAndAssists, { wrapper })
  act(() => result.current.actions.select(40))
  expect(result.current.views[36]?.fill).toBe('peer')

  await act(async () => result.current.setAssist('rowColumn', false))
  expect(result.current.views[36]?.fill).toBe('plain')

  await act(async () => result.current.setAssist('selectedCell', false))
  expect(result.current.views[40]).toMatchObject({ fill: 'peer', selected: false })
})
