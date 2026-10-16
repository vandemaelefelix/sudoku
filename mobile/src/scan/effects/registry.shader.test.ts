/**
 * @jest-environment node
 */
import { compileSkSL } from './common/compileSkSL'
import { EFFECTS } from './registry'

describe('the runtime shaders in the registry', () => {
  it('compile as Skia runtime shaders', async () => {
    const compiled = await Promise.all(
      EFFECTS.flatMap(({ id, sksl }) =>
        sksl == null ? [] : [compileSkSL(sksl).then((result: { error: string }) => ({ id, error: result.error }))],
      ),
    )
    const errors = compiled.filter(({ error }) => error !== '').map(({ id, error }) => `${id}: ${error}`)
    expect(errors).toEqual([])
  })
})
