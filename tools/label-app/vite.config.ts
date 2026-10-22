import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// `pnpm dev` serves the app with hot reload. The label server answers the data routes. Start it with
// `uv run --directory ml python -m sudoku_ml.label_server --port <port>` and pass the same port here.
const server = `http://127.0.0.1:${process.env.LABEL_SERVER_PORT ?? '8765'}`
const DATA_ROUTES = ['/api', '/cell', '/photo', '/outline', '/flat']

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    proxy: Object.fromEntries(DATA_ROUTES.map((route) => [route, { target: server, changeOrigin: true }])),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
  },
})
