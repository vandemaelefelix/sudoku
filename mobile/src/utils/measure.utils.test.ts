import { isDevelopmentVariant } from '@/utils/appVariant.utils'
import { createStartMeasures, measureLog } from './measure.utils'

jest.mock('@/utils/appVariant.utils', () => ({ isDevelopmentVariant: jest.fn(() => true) }))

describe('measureLog', () => {
  afterEach(() => jest.restoreAllMocks())

  it('logs a quality scenario in the development variant', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    measureLog('QR-05', 'first outline 240 ms')
    expect(log).toHaveBeenCalledWith('[measure] QR-05 first outline 240 ms')
  })

  it('logs nothing in the production variant', () => {
    jest.mocked(isDevelopmentVariant).mockReturnValue(false)
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    measureLog('QR-05', 'first outline 240 ms')
    expect(log).not.toHaveBeenCalled()
  })
})

function setup() {
  let now = 1_000
  const lines: string[] = []
  const measures = createStartMeasures(
    () => now,
    (_id, message) => lines.push(message),
  )
  return { measures, lines, advance: (ms: number) => (now += ms) }
}

describe('createStartMeasures', () => {
  it('logs the home screen once, from the load of the bundle', () => {
    const { measures, lines, advance } = setup()
    advance(800)
    measures.homeShown()
    advance(500)
    measures.homeShown()
    expect(lines).toEqual(['home shown 800 ms after the bundle loaded'])
  })

  it('logs the first board after a level tap, with the time since the bundle loaded', () => {
    const { measures, lines, advance } = setup()
    advance(900)
    measures.levelTapped('expert')
    advance(120)
    measures.generated('expert', 110)
    advance(80)
    measures.boardShown()
    expect(lines).toEqual([
      'expert generated in 110 ms',
      'expert board shown 200 ms after the tap, 1100 ms after the bundle loaded (first board)',
    ])
  })

  it('logs a later board without the time since the bundle loaded', () => {
    const { measures, lines, advance } = setup()
    measures.levelTapped('easy')
    measures.boardShown()
    measures.levelTapped('hard')
    advance(300)
    measures.boardShown()
    expect(lines.at(-1)).toBe('hard board shown 300 ms after the tap')
  })

  it('forgets a tap that started no game, so a later Continue logs nothing', () => {
    const { measures, lines } = setup()
    measures.levelTapped('easy')
    measures.tapCancelled()
    measures.boardShown()
    expect(lines).toEqual([])
  })

  it('leaves the wait for the replace question out of the board time', () => {
    const { measures, lines, advance } = setup()
    measures.levelTapped('easy')
    advance(4_000)
    measures.replaceConfirmed()
    advance(90)
    measures.boardShown()
    expect(lines.at(-1)).toMatch(/^easy board shown 90 ms after the tap/)
  })

  it('keeps the first tap while its start runs', () => {
    const { measures, lines, advance } = setup()
    measures.levelTapped('easy')
    advance(100)
    measures.levelTapped('hard')
    advance(50)
    measures.boardShown()
    expect(lines.at(-1)).toMatch(/^easy board shown 150 ms after the tap/)
  })

  it('logs no board without a tap, such as Continue', () => {
    const { measures, lines } = setup()
    measures.boardShown()
    expect(lines).toEqual([])
  })
})
