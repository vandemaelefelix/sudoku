import { createScene } from '../scene'
import { createClock, effectTime } from './clock'

const scene = () => createScene({ width: 402, height: 874 })

describe('effectTime', () => {
  it('counts the seconds from the creation of the effect', () => {
    const clock = createClock({ ...scene(), t: 100 })
    expect(effectTime(clock, { ...scene(), t: 102.5 })).toBe(2.5)
  })

  it('stops the time under Reduce Motion', () => {
    const clock = createClock({ ...scene(), t: 100 })
    expect(effectTime(clock, { ...scene(), t: 102.5, reduceMotion: true })).toBe(0)
  })
})
