import { describe, expect, it } from 'vitest'

import type { Corners } from '../../api/types'
import { inset, moveCorner, roundCorners, turn } from './geometry'

const SQUARE: Corners = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
]

describe('geometry', () => {
  it('insets the middle 80 % of the photo', () => {
    expect(inset(100, 50)).toEqual([
      [10, 5],
      [90, 5],
      [90, 45],
      [10, 45],
    ])
  })

  it('turns the corners a quarter', () => {
    expect(turn(SQUARE)).toEqual([SQUARE[3], SQUARE[0], SQUARE[1], SQUARE[2]])
  })

  it('turns four times back to the start', () => {
    expect(turn(turn(turn(turn(SQUARE))))).toEqual(SQUARE)
  })

  it('rounds the corners to one decimal', () => {
    expect(roundCorners([[1.26, 2.24], ...SQUARE.slice(1)] as Corners)[0]).toEqual([1.3, 2.2])
  })

  it('moves one corner and keeps the others', () => {
    expect(moveCorner(SQUARE, 2, [7, 8], 20, 20)).toEqual([SQUARE[0], SQUARE[1], [7, 8], SQUARE[3]])
  })

  it('keeps a moved corner inside the photo', () => {
    expect(moveCorner(SQUARE, 0, [-5, 99], 20, 30)[0]).toEqual([0, 30])
  })
})
