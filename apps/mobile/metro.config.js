// Expo's Metro defaults, plus the model file type (docs/architecture/00-concepts/model-contract.md).
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)
config.resolver.assetExts.push('tflite')

module.exports = config
