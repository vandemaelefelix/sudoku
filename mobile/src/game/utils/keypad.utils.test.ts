import { KEY_DONE } from '@/game/constants/keypad.constants'
import { keyDoneLook } from './keypad.utils'

const DONE = 0.3

describe('keyDoneLook', () => {
  it('starts as an open key', () => {
    expect(keyDoneLook(0, false, DONE)).toEqual({ opacity: 1, scale: 1 })
  })

  it('grows to the peak scale at full opacity', () => {
    const look = keyDoneLook(KEY_DONE.peakAt, false, DONE)
    expect(look.opacity).toBe(1)
    expect(look.scale).toBeCloseTo(KEY_DONE.scale)
  })

  it('ends at its own size and faded', () => {
    const look = keyDoneLook(1, false, DONE)
    expect(look.scale).toBeCloseTo(1)
    expect(look.opacity).toBeCloseTo(DONE)
  })

  it('only fades with Reduce Motion', () => {
    expect(keyDoneLook(KEY_DONE.peakAt, true, DONE).scale).toBe(1)
    expect(keyDoneLook(KEY_DONE.peakAt, true, DONE).opacity).toBeLessThan(1)
    expect(keyDoneLook(1, true, DONE)).toEqual({ opacity: DONE, scale: 1 })
  })

  it('clamps a progress outside 0 to 1', () => {
    expect(keyDoneLook(-1, false, DONE)).toEqual(keyDoneLook(0, false, DONE))
    expect(keyDoneLook(2, false, DONE)).toEqual(keyDoneLook(1, false, DONE))
  })
})
