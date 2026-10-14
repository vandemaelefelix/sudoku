import * as Haptics from 'expo-haptics'
import { playHaptic } from './haptics.utils'

beforeEach(() => jest.clearAllMocks())

describe('playHaptic', () => {
  it.each([
    ['tap', Haptics.ImpactFeedbackStyle.Light],
    ['thud', Haptics.ImpactFeedbackStyle.Medium],
    ['soft', Haptics.ImpactFeedbackStyle.Soft],
  ] as const)('plays %s as an impact', (name, style) => {
    playHaptic(name)
    expect(Haptics.impactAsync).toHaveBeenCalledWith(style)
  })

  it.each([
    ['success', Haptics.NotificationFeedbackType.Success],
    ['warning', Haptics.NotificationFeedbackType.Warning],
    ['error', Haptics.NotificationFeedbackType.Error],
  ] as const)('plays %s as a notification', (name, type) => {
    playHaptic(name)
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(type)
  })

  it('plays tick as a selection change', () => {
    playHaptic('tick')
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1)
  })

  it('does not throw when the phone has no haptic engine', async () => {
    jest.mocked(Haptics.selectionAsync).mockRejectedValueOnce(new Error('no engine'))
    expect(() => playHaptic('tick')).not.toThrow()
    await Promise.resolve()
  })
})
