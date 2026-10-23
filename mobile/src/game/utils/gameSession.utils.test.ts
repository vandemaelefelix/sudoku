import type { Game } from '@sudoku/core'
import { MAX_ELAPSED_MS } from '@/game/constants/game.constants'
import { createGameSession, type GameSession } from './gameSession.utils'
import { OPEN } from '@/game/testing/sample.testing'
import { sampleStart } from './sample.utils'

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

const playedMs = (session: GameSession) => session.getSnapshot().game.playedMs
const status = (session: GameSession) => session.getSnapshot().game.status

function running() {
  const save = jest.fn<void, [Game]>()
  const session = createGameSession(sampleStart())
  const detach = session.attach(save)
  return { session, save, detach }
}

describe('the rules', () => {
  it('plays a number through its actions and records the move', () => {
    const session = createGameSession(sampleStart())
    session.actions.select(OPEN)
    session.actions.digit(4)
    const { board, move } = session.getSnapshot()
    expect(board.entries[OPEN]).toBe(4)
    expect(move).toMatchObject({ kind: 'number' })
  })

  it('keeps the same snapshot when an action changes nothing', () => {
    const session = createGameSession(sampleStart())
    const before = session.getSnapshot()
    session.actions.resume()
    expect(session.getSnapshot()).toBe(before)
  })

  it('tells a subscriber about each change, until it unsubscribes', () => {
    const session = createGameSession(sampleStart())
    const listener = jest.fn()
    const unsubscribe = session.subscribe(listener)
    session.actions.select(OPEN)
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    session.actions.select(40)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('has no clock until it is attached', () => {
    const session = createGameSession(sampleStart())
    jest.advanceTimersByTime(5000)
    expect(playedMs(session)).toBe(0)
  })
})

describe('the clock', () => {
  it('counts the time played once a second while playing', () => {
    const { session } = running()
    jest.advanceTimersByTime(3000)
    expect(playedMs(session)).toBe(3000)
  })

  it('does not count while paused', () => {
    const { session } = running()
    jest.advanceTimersByTime(2000)
    session.actions.pause()
    jest.advanceTimersByTime(5000)
    expect(playedMs(session)).toBe(2000)
  })

  it('counts the time since the last report when the player pauses', () => {
    const { session } = running()
    jest.advanceTimersByTime(2500)
    session.actions.pause()
    expect(playedMs(session)).toBe(2500)
  })

  it('counts from the resume, not from the pause', () => {
    const { session } = running()
    jest.advanceTimersByTime(1400)
    session.actions.pause()
    jest.advanceTimersByTime(5000)
    session.actions.resume()
    jest.advanceTimersByTime(1000)
    expect(playedMs(session)).toBe(2400)
  })

  it('keeps the play time over many short plays between pauses', () => {
    const { session } = running()
    for (let round = 0; round < 60; round += 1) {
      jest.advanceTimersByTime(900)
      session.actions.pause()
      jest.advanceTimersByTime(100)
      session.actions.resume()
    }
    expect(playedMs(session)).toBe(54_000)
  })

  it('counts at most MAX_ELAPSED_MS for one report that comes late', () => {
    const { session } = running()
    // The system clock jumps as it does when iOS suspends JavaScript in the background.
    jest.setSystemTime(Date.now() + 60_000)
    jest.advanceTimersByTime(1000)
    expect(playedMs(session)).toBe(MAX_ELAPSED_MS)
  })

  it('counts at most MAX_ELAPSED_MS for a pause that comes late', () => {
    const { session } = running()
    jest.setSystemTime(Date.now() + 60_000)
    session.actions.pause()
    expect(playedMs(session)).toBe(MAX_ELAPSED_MS)
  })

  it('stops when it detaches', () => {
    const { session, detach } = running()
    jest.advanceTimersByTime(1000)
    detach()
    jest.advanceTimersByTime(5000)
    expect(playedMs(session)).toBe(1000)
  })

  it('reports nothing on a pause while the clock does not run', () => {
    const session = createGameSession(sampleStart())
    session.attach(null)()
    jest.advanceTimersByTime(500)
    session.actions.pause()
    expect(playedMs(session)).toBe(0)
  })

  it('runs once after a detach and an attach again', () => {
    const { session, detach } = running()
    jest.advanceTimersByTime(1000)
    detach()
    session.attach(null)
    jest.advanceTimersByTime(2000)
    expect(playedMs(session)).toBe(3000)
  })

  it('runs without a save', () => {
    const session = createGameSession(sampleStart())
    session.attach(null)
    jest.advanceTimersByTime(2000)
    expect(playedMs(session)).toBe(2000)
  })
})

describe('the app leaves the foreground', () => {
  it('counts the last slice of time, pauses and saves the paused game once', () => {
    const { session, save } = running()
    jest.advanceTimersByTime(2500)
    session.background()
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'paused', playedMs: 2500 }))
  })

  it('saves the paused game after an earlier move, with the selection that the player made since', () => {
    const { session, save } = running()
    session.actions.select(OPEN)
    session.actions.digit(4)
    jest.advanceTimersByTime(1700)
    session.actions.select(40)
    session.background()
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'paused', playedMs: 1700, selected: 40 }))
  })

  it('counts the time once when it detaches after the pause', () => {
    const { session, save, detach } = running()
    jest.advanceTimersByTime(2500)
    session.background()
    detach()
    expect(save).toHaveBeenCalledTimes(1)
    expect(playedMs(session)).toBe(2500)
  })

  it('stays paused until the player resumes', () => {
    const { session } = running()
    session.background()
    jest.advanceTimersByTime(5000)
    expect(status(session)).toBe('paused')
    expect(playedMs(session)).toBe(0)
    session.actions.resume()
    jest.advanceTimersByTime(1000)
    expect(playedMs(session)).toBe(1000)
  })

  it('saves nothing more when the game is already paused and saved', () => {
    const { session, save } = running()
    session.actions.pause()
    session.background()
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('pauses without a save', () => {
    const session = createGameSession(sampleStart())
    session.attach(null)
    session.background()
    expect(status(session)).toBe('paused')
  })
})

describe('the saves', () => {
  it('does not save the game it starts with', () => {
    const { save } = running()
    expect(save).not.toHaveBeenCalled()
  })

  it('saves the game after a move', () => {
    const { session, save } = running()
    session.actions.select(OPEN)
    session.actions.digit(4)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.lastCall?.[0].entries[OPEN]).toBe(4)
  })

  it('saves a pause the player makes', () => {
    const { session, save } = running()
    session.actions.pause()
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'paused' }))
  })

  it('does not save a selection', () => {
    const { session, save } = running()
    session.actions.select(OPEN)
    session.actions.select(40)
    expect(save).not.toHaveBeenCalled()
  })

  it('does not save a clock tick', () => {
    const { save } = running()
    jest.advanceTimersByTime(3000)
    expect(save).not.toHaveBeenCalled()
  })

  it('saves the time played and the selection when it detaches', () => {
    const { session, save, detach } = running()
    session.actions.select(OPEN)
    jest.advanceTimersByTime(7400)
    detach()
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ selected: OPEN, playedMs: 7400 }))
  })

  it('does not save again when nothing changed since the last save', () => {
    const { session, save, detach } = running()
    session.actions.select(OPEN)
    session.actions.digit(4)
    detach()
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('saves once and counts the time once when an attach follows a detach', () => {
    const first = jest.fn<void, [Game]>()
    const second = jest.fn<void, [Game]>()
    const session = createGameSession(sampleStart())
    const detach = session.attach(first)
    jest.advanceTimersByTime(1000)
    detach()
    session.attach(second)
    jest.advanceTimersByTime(1000)
    session.actions.select(OPEN)
    session.actions.digit(4)
    expect(playedMs(session)).toBe(2000)
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('saves nothing without a save', () => {
    const session = createGameSession(sampleStart())
    const detach = session.attach(null)
    session.actions.select(OPEN)
    session.actions.digit(4)
    expect(() => detach()).not.toThrow()
  })
})
