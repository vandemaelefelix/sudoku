import { defineConfig } from 'eslint/config'
import expoConfig from 'eslint-config-expo/flat.js'

export default defineConfig([
  expoConfig,
  { settings: { react: { version: '19.2' } } },
  { ignores: ['**/dist/**', '**/.expo/**', 'ml/**', '**/node_modules/**', '.superpowers/**'] },
])
