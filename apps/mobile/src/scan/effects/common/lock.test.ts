import { createScene } from '../scene'
import { lockProgress, lockTime } from './lock'

const scene = () => createScene({ width: 402, height: 874 })

describe('lockProgress', () => {
  it('grows as the corners slow down while a grid is found', () => {
    expect(lockProgress({ ...scene(), presence: 1, motion: 0.25 })).toBe(0.75)
  })

  it('is 0 without a grid', () => {
    expect(lockProgress({ ...scene(), presence: 0, motion: 0 })).toBe(0)
  })
})

describe('lockTime', () => {
  it('gives the seconds since the scene became steady', () => {
    expect(lockTime({ ...scene(), steady: true, t: 5, steadyAt: 3.5 })).toBe(1.5)
  })

  it('gives -1 while the scene is not steady', () => {
    expect(lockTime({ ...scene(), steady: false, t: 5, steadyAt: 3.5 })).toBe(-1)
  })
})
