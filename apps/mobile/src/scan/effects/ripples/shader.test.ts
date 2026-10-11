/**
 * @jest-environment node
 */
import { compileSkSL } from '../common/compileSkSL'
import { IDENTITY } from '../common/shaderMatrix'
import { createScene } from '../scene'
import { RIPPLES_SKSL } from './shader'
import { rippleUniforms } from './uniforms'

describe('RIPPLES_SKSL', () => {
  it('compiles as a Skia runtime shader with one float for each uniform value', async () => {
    const result = await compileSkSL(RIPPLES_SKSL)
    expect(result.error).toBe('')
    expect(result.floats).toBe(rippleUniforms(createScene({ width: 402, height: 874 }), IDENTITY, 0).length)
  })
})
