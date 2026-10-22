// oxlint-disable-next-line import/no-unassigned-import -- The import adds the jest-dom matchers to expect.
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest runs without globals, so Testing Library cannot register its own cleanup.
afterEach(cleanup)
