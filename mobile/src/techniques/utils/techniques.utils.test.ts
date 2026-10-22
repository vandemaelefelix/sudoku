import { HINT_TECHNIQUES, HINT_ORDER, techniqueExample, valueAt } from '@sudoku/core'
import { exampleBoard, exampleSpeech, levelLine, techniqueIds, toTechniqueId } from './techniques.utils'

it('lists every technique with a page once, in hint order', () => {
  const ids = techniqueIds()
  expect(ids).toHaveLength(Object.keys(HINT_TECHNIQUES).length)
  expect(new Set(ids).size).toBe(ids.length)
  expect(ids[0]).toBe('fullHouse')
  expect(ids).toEqual([...new Set(HINT_ORDER.map((rank) => rank.technique))])
})

it('reads a route param as a technique id, or null', () => {
  expect(toTechniqueId('xWing')).toBe('xWing')
  expect(toTechniqueId('xChain')).toBeNull()
  expect(toTechniqueId('nothing')).toBeNull()
  expect(toTechniqueId(undefined)).toBeNull()
})

it('names the first level where the technique appears', () => {
  expect(levelLine('hiddenSingle')).toBe('First seen in Easy puzzles.')
  expect(levelLine('pointing')).toBe('First seen in Medium puzzles.')
  expect(levelLine('xWing')).toBe('First seen in Hard puzzles.')
})

describe('the example board', () => {
  const example = techniqueExample('pointing')!
  const board = exampleBoard(example)

  it('holds the digits of the example position', () => {
    expect(board.givens.map((_, cell) => valueAt(board, cell))).toEqual(example.board)
    expect(board.selected).toBeNull()
  })

  it('shows the candidates as notes on the pattern cells and the cells that lose one', () => {
    const { step } = example
    for (const cell of step.pattern) expect(board.notes[cell]?.length).toBeGreaterThan(0)
    for (const { cell, digit } of step.eliminations) expect(board.notes[cell]).toContain(digit)
    const marked = new Set([...step.pattern, ...step.eliminations.map((item) => item.cell)])
    expect(board.notes.filter((notes, cell) => !marked.has(cell) && notes.length > 0)).toEqual([])
  })
})

it('reads an example as the why and the answer of its step', () => {
  const example = techniqueExample('hiddenSingle')!
  const technique = HINT_TECHNIQUES.hiddenSingle!
  expect(exampleSpeech(example)).toBe(`${technique.why(example.step, false)} ${technique.answer(example.step)}`)
})
