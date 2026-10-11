/**
 * @jest-environment node
 */
import { compileSkSL } from '../common/compileSkSL'
import { IDENTITY } from '../common/shaderMatrix'
import { createScene } from '../scene'
import { LATTICE_SKSL } from './shader'
import { latticeUniforms } from './uniforms'

describe('LATTICE_SKSL', () => {
  it('compiles as a Skia runtime shader with one float for each uniform value', async () => {
    const result = await compileSkSL(LATTICE_SKSL)
    expect(result.error).toBe('')
    expect(result.floats).toBe(latticeUniforms(createScene({ width: 402, height: 874 }), IDENTITY, 0).length)
  })

  it('has no fwidth, which runtime shaders do not support', async () => {
    expect(LATTICE_SKSL).not.toContain('fwidth')
    const result = await compileSkSL('half4 main(float2 p) { return fwidth(p).xyxy; }')
    expect(result.error).toContain('fwidth')
  })
})
