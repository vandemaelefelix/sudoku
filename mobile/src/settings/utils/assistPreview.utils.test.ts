import { DEFAULT_ASSISTS } from '@/game/constants/assists.constants'
import { cellViews } from '@/game/utils/cell.utils'
import { previewBoard } from './assistPreview.utils'

it('selects cell 39 of a game in play', () => {
  const board = previewBoard()
  expect(board.selected).toBe(39)
  expect(board.status).toBe('playing')
})

it('shows every shade of the canvas with all assists on', () => {
  const views = cellViews(previewBoard(), DEFAULT_ASSISTS)
  expect(views[39]).toMatchObject({ fill: 'peer', selected: true })
  expect(views[36]?.fill).toBe('peer')
  expect(views[5]).toMatchObject({ digit: 8, fill: 'same' })
  expect(views[54]).toMatchObject({ digit: 6, digitStyle: 'wrong', fill: 'conflict' })
  expect(views[0]?.fill).toBe('plain')
})
