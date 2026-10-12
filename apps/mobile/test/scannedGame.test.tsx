// This import comes first. expo-router/testing-library mocks Reanimated again with the library mock, which has no
// useReducedMotion. Jest keeps a module that is already loaded, so the mock of jest.setup.ts stays.
// oxlint-disable-next-line import/no-unassigned-import -- the import loads the jest.setup.ts mock before expo-router/testing-library.
import 'react-native-reanimated'
import { Stack } from 'expo-router'
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library'
import { generate } from '@sudoku/core'
import GameRoute from '@/app/game'
import type { CellResult, RecogniseResult } from '@/scanner'
import { useScannedStart } from '@/scan/hooks/useScannedStart'
import { CorrectionScreen } from '@/scan/screens/CorrectionScreen'
import { correctionLayout } from '@/scan/utils/correction.utils'
import { createMemoryStorage, type GameStorage } from '@/storage'
import { GameStorageContext } from '@/storage/hooks/useGameStorage'

const layout = correctionLayout({ width: 402, height: 874 }, { top: 62, bottom: 34, left: 0, right: 0 })
const { givens, solution } = generate('medium', 21)
const opens = givens.flatMap((digit, cell) => (digit === 0 ? [cell] : []))
const wrongCell = opens[0] ?? 0
const rightCell = opens[1] ?? 0
const wrongDigit = ((solution[wrongCell] ?? 0) % 9) + 1
const givenCell = givens.findIndex((digit) => digit !== 0)

function scanResult(): RecogniseResult {
  const cells: CellResult[] = givens.map((digit, cell) => {
    if (digit !== 0) return { digit, kind: 'printed', confidence: 1, validPair: true }
    if (cell === wrongCell) return { digit: wrongDigit, kind: 'handwritten', confidence: 1, validPair: true }
    if (cell === rightCell) return { digit: solution[cell] ?? 0, kind: 'handwritten', confidence: 1, validPair: true }
    return { digit: 0, kind: 'none', confidence: 1, validPair: true }
  })
  return {
    ok: true,
    cells,
    quad: [
      { x: 0.2, y: 0.2 },
      { x: 0.8, y: 0.2 },
      { x: 0.8, y: 0.8 },
      { x: 0.2, y: 0.8 },
    ],
    corners: 'redetected',
    cornerOffset: null,
    timings: { imageMs: 1, detectMs: 1, flattenMs: 1, classifyMs: 1 },
  }
}

function ScanReview() {
  const play = useScannedStart()
  return <CorrectionScreen result={scanResult()} layout={layout} onRetake={jest.fn()} onPlay={play} />
}

function renderScan(storage: GameStorage = createMemoryStorage()) {
  renderRouter(
    {
      _layout: () => (
        <GameStorageContext value={storage}>
          <Stack screenOptions={{ headerShown: false }} />
        </GameStorageContext>
      ),
      index: () => null,
      scan: ScanReview,
      game: GameRoute,
    },
    { initialUrl: '/scan' },
  )
  return storage
}

const place = (cell: number) => `Row ${Math.floor(cell / 9) + 1}, column ${(cell % 9) + 1}`
const labelOf = (cell: number) => screen.getByTestId(`cell-${cell}`).props.accessibilityLabel as string

async function playScan() {
  const storage = renderScan()
  fireEvent.press(await screen.findByTestId('play'))
  await waitFor(() => expect(screen).toHavePathname('/game'))
  // The board draws the grid after it knows its size.
  fireEvent(await screen.findByTestId('board'), 'layout', { nativeEvent: { layout: { width: 358, height: 358 } } })
  return storage
}

it('plays the scan: printed digits are givens, handwritten digits are entries', async () => {
  const storage = await playScan()
  expect(labelOf(givenCell)).toBe(`${place(givenCell)}, given ${givens[givenCell]}`)
  expect(labelOf(rightCell)).toBe(`${place(rightCell)}, ${solution[rightCell]}`)
  expect(await storage.puzzles.current()).toMatchObject({ source: 'scanned', level: 'medium' })
})

it('shows a wrong handwritten digit as wrong, without a mistake', async () => {
  await playScan()
  expect(labelOf(wrongCell)).toBe(`${place(wrongCell)}, wrong ${wrongDigit}`)
  expect(screen.getByLabelText('0 of 3 mistakes')).toBeTruthy()
})

it('keeps a given locked on the game screen', async () => {
  await playScan()
  const other = ((givens[givenCell] ?? 0) % 9) + 1
  fireEvent.press(screen.getByTestId(`cell-${givenCell}`))
  fireEvent.press(screen.getByLabelText(new RegExp(`^Enter ${other}`)))
  expect(labelOf(givenCell)).toBe(`${place(givenCell)}, given ${givens[givenCell]}`)
  expect(screen.getByLabelText('0 of 3 mistakes')).toBeTruthy()
})
