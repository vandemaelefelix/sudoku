import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser'
import { CATALOGUES } from './index'

/** The names of the arguments and tags of a message. A language may make a plain argument a plural, so the type does not count. */
function argumentsOf(elements: MessageFormatElement[], found = new Set<string>()): Set<string> {
  for (const element of elements) {
    if (element.type === TYPE.literal || element.type === TYPE.pound) continue
    found.add(element.value)
    if (element.type === TYPE.plural || element.type === TYPE.select) {
      for (const option of Object.values(element.options)) argumentsOf(option.value, found)
    }
    if (element.type === TYPE.tag) argumentsOf(element.children, found)
  }
  return found
}

const ids = Object.keys(CATALOGUES.en) as (keyof typeof CATALOGUES.en)[]

describe('the catalogues', () => {
  it.each(Object.keys(CATALOGUES))('parse as ICU messages in %s', (language) => {
    const catalogue = CATALOGUES[language as keyof typeof CATALOGUES]
    const broken = ids.filter((id) => {
      try {
        parse(catalogue[id])
        return false
      } catch {
        return true
      }
    })
    expect(broken).toEqual([])
  })

  it('give the Dutch message the same arguments and tags as the English one', () => {
    for (const id of ids) {
      const english = [...argumentsOf(parse(CATALOGUES.en[id]))].toSorted()
      const dutch = [...argumentsOf(parse(CATALOGUES.nl[id]))].toSorted()
      expect([id, dutch]).toEqual([id, english])
    }
  })

  it('have no empty message', () => {
    for (const catalogue of Object.values(CATALOGUES)) {
      for (const id of ids) expect([id, catalogue[id].trim().length > 0]).toEqual([id, true])
    }
  })
})
