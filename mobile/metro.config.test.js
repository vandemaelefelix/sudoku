/** @jest-environment node */
const config = require('./metro.config')

describe('metro config', () => {
  it('bundles TFLite models as assets (model contract)', () => {
    expect(config.resolver.assetExts).toContain('tflite')
  })

  it('keeps the default image assets', () => {
    expect(config.resolver.assetExts).toContain('png')
  })
})
