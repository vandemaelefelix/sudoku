// Tests only. Loads CanvasKit, the WebAssembly build of Skia that React Native Skia depends on, so Jest can compile SkSL.
// Run it in a test file with the docblock `@jest-environment node`.
const { TextDecoder } = require('node:util')
const path = require('node:path')

let loading = null

/** Resolves to { error, floats }. error: '' when the source compiles. floats: the uniform float count, or -1. */
function compileSkSL(source) {
  if (loading == null) {
    const skia = path.dirname(require.resolve('@shopify/react-native-skia/package.json'))
    const init = require(require.resolve('canvaskit-wasm/bin/full/canvaskit', { paths: [skia] }))
    // The TextDecoder of the Expo runtime refuses the encoding label that CanvasKit asks for.
    globalThis.TextDecoder = TextDecoder
    loading = init({})
  }
  return loading.then((kit) => {
    let error = ''
    const effect = kit.RuntimeEffect.Make(source, (message) => {
      error = message
    })
    return { error, floats: effect == null ? -1 : effect.getUniformFloatCount() }
  })
}

module.exports = { compileSkSL }
