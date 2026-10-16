// Unistyles rewrites the React Native imports under src/ so that a theme change updates styles without a render (ADR-015).
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [['react-native-unistyles/plugin', { root: 'src' }]],
  }
}
