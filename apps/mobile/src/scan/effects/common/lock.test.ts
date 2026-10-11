import { createScene } from '@/scan/effects/scene'
import { lockTime } from './lock'

const scene = () => createScene({ width: 402, height: 874 })

describe('lockTime', () => {
  it('gives the seconds since lock-on', () => {
    expect(lockTime({ ...scene(), t: 5, lockedAt: 3.5 })).toBe(1.5)
  })

  it('gives -1 before lock-on', () => {
    expect(lockTime({ ...scene(), t: 5, lockedAt: -1 })).toBe(-1)
  })
})
