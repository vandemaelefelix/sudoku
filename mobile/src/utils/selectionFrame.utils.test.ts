import { selectionFrame } from './selectionFrame.utils'

it('centres the stroke on each line around the cell', () => {
  const lines = { left: 40, right: 80, top: 120, bottom: 160 }
  expect(selectionFrame(lines, 3, 360)).toEqual({ left: 38.5, top: 118.5, width: 43, height: 43 })
})

it('stays inside the grid at its outer edge, so nothing clips the frame', () => {
  const corner = { left: 1, right: 40, top: 1, bottom: 40 }
  expect(selectionFrame(corner, 3, 360)).toMatchObject({ left: 0, top: 0 })
  const far = { left: 320, right: 359, top: 320, bottom: 359 }
  const frame = selectionFrame(far, 3, 360)
  expect(frame.left + frame.width).toBe(360)
  expect(frame.top + frame.height).toBe(360)
})
