/**
 * @jest-environment node
 */
import { compileSkSL } from './common/compileSkSL'
import { EFFECTS } from './index'

describe('the runtime shaders in the registry', () => {
  it('compile as Skia runtime shaders', async () => {
    const errors: string[] = []
    for (const effect of EFFECTS) {
      if (effect.sksl == null) continue
      const result = await compileSkSL(effect.sksl)
      if (result.error !== '') errors.push(`${effect.id}: ${result.error}`)
    }
    expect(errors).toEqual([])
  })
})
