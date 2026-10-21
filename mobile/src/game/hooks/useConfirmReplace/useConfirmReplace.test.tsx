import { renderHook } from '@testing-library/react-native'
import { Alert, type AlertButton } from 'react-native'
import { useConfirmReplace } from './useConfirmReplace'

function answerAlert(text: string) {
  return jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons?: AlertButton[]) => {
    buttons?.find((button) => button.text === text)?.onPress?.()
  })
}

afterEach(() => jest.restoreAllMocks())

it('asks before the game in progress ends', async () => {
  const alert = answerAlert('New game')
  const { result } = renderHook(() => useConfirmReplace())
  await expect(result.current()).resolves.toBe(true)
  expect(alert).toHaveBeenCalledWith('Start a new game?', 'Your current game ends.', expect.any(Array))
})

it('resolves false on Cancel', async () => {
  answerAlert('Cancel')
  const { result } = renderHook(() => useConfirmReplace())
  await expect(result.current()).resolves.toBe(false)
})
