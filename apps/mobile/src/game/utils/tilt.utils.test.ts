import { MAX_ROTATE_X, MAX_ROTATE_Y, TILT_RANGE } from '@/game/constants/tilt.constants'
import { cardRotation, isReading, tiltOf } from './tilt.utils'

const REST = { pitch: 0.6, roll: -0.2 }

it('gives no tilt at the rest position', () => {
  const tilt = tiltOf(REST, REST)
  expect(tilt.x).toBeCloseTo(0)
  expect(tilt.y).toBeCloseTo(0)
})

it('tilts in proportion to the turn of the phone', () => {
  const tilt = tiltOf({ pitch: REST.pitch + TILT_RANGE / 2, roll: REST.roll - TILT_RANGE / 4 }, REST)
  expect(tilt.x).toBeCloseTo(-0.25)
  expect(tilt.y).toBeCloseTo(0.5)
})

it('stops at a full tilt', () => {
  expect(tiltOf({ pitch: REST.pitch + 3, roll: REST.roll - 3 }, REST)).toEqual({ x: -1, y: 1 })
})

it('turns a full tilt into the largest rotation of the canvas', () => {
  const rotation = cardRotation({ x: 1, y: 1 })
  expect(rotation.rotateX).toBeCloseTo(-MAX_ROTATE_X)
  expect(rotation.rotateY).toBeCloseTo(MAX_ROTATE_Y)
})

it('takes only a real reading: the sensor gives zeros before its first value', () => {
  expect(isReading({ qw: 0, qx: 0, qy: 0, qz: 0 })).toBe(false)
  expect(isReading({ qw: 1, qx: 0, qy: 0, qz: 0 })).toBe(true)
  expect(isReading({ qw: 0.5, qx: 0.5, qy: 0.5, qz: 0.5 })).toBe(true)
})
