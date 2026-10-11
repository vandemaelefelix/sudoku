import {
  advanceClock,
  type Channels,
  digitAlpha,
  GATE_PHOTO,
  GATE_RESULTS,
  panelAt,
  REDUCED_END,
  ringsAt,
  SPINNER_DELAY,
  TRANSITION_END,
  transitionAt,
  sweepShift,
  transitionEnd,
} from './timeline'

const open = { photo: true, results: true }
const smooth = (x: number) => x * x * (3 - 2 * x)
const ramp = (t: number, a: number, b: number) => smooth(Math.min(1, Math.max(0, (t - a) / (b - a))))

describe('constants', () => {
  it('match the timeline', () => {
    expect(TRANSITION_END).toBe(1.5)
    expect(REDUCED_END).toBe(0.3)
    expect(GATE_PHOTO).toBe(0.05)
    expect(GATE_RESULTS).toBe(0.7)
    expect(SPINNER_DELAY).toBe(1)
    expect(transitionEnd(false)).toBe(1.5)
    expect(transitionEnd(true)).toBe(0.3)
  })

  it('moves the end later by the shift, except with Reduce Motion', () => {
    expect(transitionEnd(false, 0.15)).toBeCloseTo(1.65, 12)
    expect(transitionEnd(true, 0.15)).toBe(0.3)
  })
})

describe('transitionAt', () => {
  it('starts with the flash up and everything else at rest', () => {
    const c = transitionAt(0, false)
    expect(c.flash).toBe(1)
    expect(c.pulse).toBe(0)
    expect(c.photo).toBe(1)
    for (const key of ['flatten', 'freeDrift', 'dim', 'ink', 'cells', 'lines', 'shrink', 'title', 'rings', 'panel'] as const) {
      expect(c[key]).toBe(0)
    }
  })

  it('has the flash gone and the pulse back at 0.25', () => {
    const c = transitionAt(0.25, false)
    expect(c.flash).toBe(0)
    expect(c.pulse).toBeCloseTo(0, 12)
    expect(transitionAt(0.125, false).pulse).toBeCloseTo(1, 12)
  })

  it('starts the flatten, the drift and the dim at 0.05', () => {
    const c = transitionAt(0.05, false)
    expect(c.flatten).toBe(0)
    expect(c.freeDrift).toBe(0)
    expect(c.dim).toBe(0)
    expect(c.ink).toBe(0)
  })

  it('matches the ramps at 0.5', () => {
    const c = transitionAt(0.5, false)
    expect(c.flatten).toBe(1)
    expect(c.dim).toBe(1)
    expect(c.freeDrift).toBe(1)
    expect(c.ink).toBe(1)
    expect(c.cells).toBeCloseTo(ramp(0.5, 0.3, 0.55), 12)
    expect(c.photo).toBe(1)
    expect(c.title).toBe(1)
    expect(c.lines).toBeCloseTo(ramp(0.5, 0.35, 0.7), 12)
  })

  it('has the lines done and the photo fading at 0.7', () => {
    const c = transitionAt(0.7, false)
    expect(c.lines).toBe(1)
    expect(c.photo).toBeCloseTo(1 - ramp(0.7, 0.5, 0.8), 12)
    expect(c.title).toBe(1)
    expect(c.shrink).toBeCloseTo(ramp(0.7, 0.65, 0.95), 12)
  })

  it('has the panel and rings still at rest at 1.0', () => {
    const c = transitionAt(1, false)
    expect(c.photo).toBe(0)
    expect(c.title).toBe(1)
    expect(c.shrink).toBe(1)
    expect(c.rings).toBe(0)
    expect(c.panel).toBe(0)
  })

  it('ends with every channel at its end value at 1.5', () => {
    const { pulse, ...c } = transitionAt(1.5, false)
    expect(pulse).toBeCloseTo(0, 12)
    expect(c).toEqual<Omit<Channels, 'pulse'>>({
      flash: 0,
      flatten: 1,
      freeDrift: 1,
      dim: 1,
      ink: 1,
      cells: 1,
      lines: 1,
      photo: 0,
      shrink: 1,
      title: 1,
      rings: 1,
      panel: 1,
    })
  })

  it('keeps every channel in 0..1 and clamps outside the range', () => {
    for (let t = -0.2; t <= 1.8; t += 0.01) {
      for (const value of Object.values(transitionAt(t, false))) {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
    }
  })

  it('fades the title in at 0.20 to 0.50', () => {
    expect(transitionAt(0.2, false).title).toBe(0)
    expect(transitionAt(0.35, false).title).toBeCloseTo(0.5, 12)
    expect(transitionAt(0.5, false).title).toBe(1)
  })

  it('moves the rings and the panel later by the shift, and nothing else', () => {
    const shifted = transitionAt(1.4, false, 0.1)
    expect(shifted.rings).toBeCloseTo(0.5, 12)
    expect(shifted.panel).toBeCloseTo(ramp(1.3, 1.2, 1.5), 12)
    const { rings, panel, ...rest } = shifted
    const { rings: _r, panel: _p, ...plain } = transitionAt(1.4, false)
    expect(rest).toEqual(plain)
    expect(rings).not.toBe(_r)
    expect(panel).not.toBe(_p)
  })

  it('moves the rings and the panel in their own windows', () => {
    expect(transitionAt(1.3, false).rings).toBeCloseTo(0.5, 12)
    expect(transitionAt(1.35, false).panel).toBeCloseTo(0.5, 12)
  })
})

describe('digitAlpha', () => {
  it('starts cell (0, 0) at 0.55 and ends it 0.15 s later', () => {
    expect(digitAlpha(0.55, 0, 0, false)).toBe(0)
    expect(digitAlpha(0.7, 0, 0, false)).toBe(1)
    expect(digitAlpha(0.625, 0, 0, false)).toBeCloseTo(0.5, 12)
  })

  it('delays each cell by 28 ms per row plus column', () => {
    expect(digitAlpha(0.55 + 0.028 * 3, 1, 2, false)).toBe(0)
    expect(digitAlpha(0.55 + 0.028 * 3 + 0.15, 1, 2, false)).toBe(1)
  })

  it('ends cell (8, 8) before 1.2', () => {
    expect(digitAlpha(1.2, 8, 8, false)).toBe(1)
    expect(digitAlpha(0.55 + 0.028 * 16, 8, 8, false)).toBe(0)
  })

  it('starts the sweep later by the shift', () => {
    expect(digitAlpha(0.65, 0, 0, false, 0.1)).toBe(0)
    expect(digitAlpha(0.725, 0, 0, false, 0.1)).toBeCloseTo(0.5, 12)
    expect(digitAlpha(1.3, 8, 8, false, 0.1)).toBe(1)
  })

  it('ignores the shift with Reduce Motion', () => {
    expect(digitAlpha(0.15, 3, 4, true, 0.1)).toBeCloseTo(0.5, 12)
  })

  it('follows one fade with Reduce Motion', () => {
    expect(digitAlpha(0, 8, 8, true)).toBe(0)
    expect(digitAlpha(0.15, 3, 4, true)).toBeCloseTo(0.5, 12)
    expect(digitAlpha(0.3, 8, 8, true)).toBe(1)
  })
})

describe('ringsAt and panelAt', () => {
  it('match the channels of transitionAt', () => {
    for (const reduceMotion of [false, true]) {
      for (let t = 0; t <= 1.7; t += 0.05) {
        const c = transitionAt(t, reduceMotion, 0.1)
        expect(ringsAt(t, reduceMotion, 0.1)).toBe(c.rings)
        expect(panelAt(t, reduceMotion, 0.1)).toBe(c.panel)
      }
    }
  })
})

describe('sweepShift', () => {
  it('is 0 when the results came before the sweep start', () => {
    expect(sweepShift(0.3, 1, false)).toBe(0)
    expect(sweepShift(0.55, 1, false)).toBe(0)
  })

  it('is the delay of the results after the sweep start', () => {
    expect(sweepShift(GATE_RESULTS, 1, false)).toBeCloseTo(0.15, 12)
    expect(sweepShift(0.6, 1, false)).toBeCloseTo(0.05, 12)
  })

  it('takes the clock as the arrival time while the arrival is not known (resultsAt below 0)', () => {
    expect(sweepShift(-1, 0.65, false)).toBeCloseTo(0.1, 12)
    expect(sweepShift(-1, 0.4, false)).toBe(0)
  })

  it('is 0 with Reduce Motion', () => {
    expect(sweepShift(GATE_RESULTS, 1, true)).toBe(0)
  })
})

describe('Reduce Motion', () => {
  it('fades once over 0.3 s', () => {
    const c = transitionAt(0.15, true)
    const f = ramp(0.15, 0, 0.3)
    expect(f).toBeCloseTo(0.5, 12)
    expect(c.flatten).toBe(1)
    expect(c.photo).toBeCloseTo(1 - f, 12)
    for (const key of ['dim', 'cells', 'lines', 'title', 'rings', 'panel', 'ink', 'shrink', 'freeDrift'] as const) {
      expect(c[key]).toBeCloseTo(f, 12)
    }
    expect(c.flash).toBe(0)
    expect(c.pulse).toBe(0)
  })

  it('starts at the frozen view and ends at the correction screen', () => {
    const start = transitionAt(0, true)
    expect(start.photo).toBe(1)
    expect(start.panel).toBe(0)
    const end = transitionAt(0.3, true)
    expect(end.photo).toBe(0)
    expect(end.panel).toBe(1)
    expect(end.cells).toBe(1)
  })
})

describe('advanceClock', () => {
  it('adds dt when the gates are open', () => {
    expect(advanceClock(0.2, 0.016, open, false)).toBeCloseTo(0.216, 12)
  })

  it('holds at 0.05 without the photo', () => {
    const gates = { photo: false, results: false }
    expect(advanceClock(0.04, 0.016, gates, false)).toBe(GATE_PHOTO)
    expect(advanceClock(GATE_PHOTO, 0.016, gates, false)).toBe(GATE_PHOTO)
  })

  it('passes the photo gate once the photo is ready and holds at 0.7 without the results', () => {
    const gates = { photo: true, results: false }
    expect(advanceClock(GATE_PHOTO, 0.1, gates, false)).toBeCloseTo(0.15, 12)
    expect(advanceClock(0.69, 0.1, gates, false)).toBe(GATE_RESULTS)
    expect(advanceClock(GATE_RESULTS, 0.1, gates, false)).toBe(GATE_RESULTS)
  })

  it('holds where it is when both gates are closed at 0.3 in the cross-fade', () => {
    expect(advanceClock(0.3, 0.1, { photo: false, results: false }, true)).toBe(0.3)
  })

  it('holds a closed results gate where the clock is in the cross-fade', () => {
    expect(advanceClock(GATE_PHOTO, 0.1, { photo: true, results: false }, true)).toBe(GATE_PHOTO)
    expect(advanceClock(0.2, 0.1, { photo: true, results: false }, true)).toBe(0.2)
  })

  it('ends later by the shift', () => {
    expect(advanceClock(1.49, 0.1, open, false, 0.15)).toBeCloseTo(1.59, 12)
    expect(advanceClock(1.6, 0.1, open, false, 0.15)).toBeCloseTo(1.65, 12)
  })

  it('does not go back on a negative dt', () => {
    expect(advanceClock(0.2, -0.1, open, false)).toBe(0.2)
  })

  it('does not hold at 0.7 for a photo gate that is closed earlier', () => {
    expect(advanceClock(0.3, 0.1, { photo: false, results: true }, false)).toBeCloseTo(0.4, 12)
  })

  it('never goes past the end', () => {
    expect(advanceClock(1.49, 0.1, open, false)).toBe(TRANSITION_END)
    expect(advanceClock(1.5, 0.1, open, false)).toBe(TRANSITION_END)
    expect(advanceClock(0.25, 0.1, open, true)).toBe(REDUCED_END)
  })

  it('puts both gates at 0 with Reduce Motion', () => {
    expect(advanceClock(0, 0.1, { photo: false, results: true }, true)).toBe(0)
    expect(advanceClock(0, 0.1, { photo: true, results: false }, true)).toBe(0)
    expect(advanceClock(0, 0.1, open, true)).toBeCloseTo(0.1, 12)
  })
})
