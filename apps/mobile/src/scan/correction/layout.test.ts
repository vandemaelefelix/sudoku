import { correctionLayout } from './layout'
import type { Rect } from '@/utils/geometry.utils'

const insets = { top: 62, bottom: 34, left: 0, right: 0 }
const bottom = (r: Rect) => r.y + r.height
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < bottom(b) && b.y < bottom(a)

describe('correctionLayout', () => {
  it('places title, grid and panel without overlap on a tall view', () => {
    const { title, grid, panel } = correctionLayout({ width: 402, height: 874 }, insets)
    expect(overlaps(title, grid)).toBe(false)
    expect(overlaps(grid, panel)).toBe(false)
    expect(overlaps(title, panel)).toBe(false)
    expect(title).toEqual({ x: 16, y: 70, width: 370, height: 52 })
    expect(grid.y).toBe(134)
  })

  it('makes the grid square and centred', () => {
    const { grid } = correctionLayout({ width: 402, height: 874 }, insets)
    expect(grid.width).toBe(grid.height)
    expect(grid.width).toBe(370)
    expect(grid.x).toBe((402 - grid.width) / 2)
  })

  it('puts the panel 12 points above the bottom inset', () => {
    const { panel } = correctionLayout({ width: 402, height: 874 }, insets)
    expect(bottom(panel)).toBe(874 - 34 - 12)
    expect(panel.height).toBe(168)
    expect(panel.x).toBe(10)
    expect(panel.width).toBe(382)
  })

  it('shrinks the grid on a short view', () => {
    const { grid, panel } = correctionLayout({ width: 402, height: 600 }, insets)
    expect(grid.width).toBeLessThan(370)
    expect(grid.width).toBe(grid.height)
    expect(bottom(grid)).toBe(panel.y - 12)
    expect(grid.x).toBe((402 - grid.width) / 2)
  })

  it('gives a grid side of 0, not below, when the view has no room for the grid', () => {
    const { grid } = correctionLayout({ width: 402, height: 200 }, insets)
    expect(grid.width).toBe(0)
    expect(grid.height).toBe(0)
  })

  it('adds the side insets to the margins', () => {
    const { title, panel } = correctionLayout({ width: 800, height: 400 }, { top: 0, bottom: 0, left: 20, right: 10 })
    expect(title.x).toBe(36)
    expect(title.width).toBe(800 - 32 - 30)
    expect(panel.x).toBe(30)
    expect(panel.width).toBe(800 - 20 - 30)
  })
})
