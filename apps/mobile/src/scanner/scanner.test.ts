import type { Photo } from 'react-native-vision-camera'
import { createWorkletRuntime } from 'react-native-worklets'
import { loadClassifier } from './model'
import { recognise } from './recognise'
import type { Quad } from '@/utils/geometry.utils'

jest.mock('./model', () => ({ loadClassifier: jest.fn() }))
jest.mock('./recognise', () => ({ recognise: jest.fn() }))
jest.mock('react-native-worklets', () => ({
  createWorkletRuntime: jest.fn(() => ({ name: 'scanner' })),
  runOnRuntimeAsync: jest.fn(async (_runtime: unknown, worklet: (...args: unknown[]) => unknown, ...args: unknown[]) =>
    worklet(...args),
  ),
}))

const QUAD: Quad = [
  { x: 0.2, y: 0.3 },
  { x: 0.8, y: 0.3 },
  { x: 0.8, y: 0.65 },
  { x: 0.2, y: 0.65 },
]
const MODEL = { runSync: jest.fn() }
const photo = {} as Photo

// createScanner keeps one promise per module, so each test loads a fresh module.
function freshScanner(): Promise<import('./scanner').Scanner> {
  let module: typeof import('./scanner') | undefined
  jest.isolateModules(() => {
    module = require('./scanner')
  })
  return module!.createScanner()
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(loadClassifier).mockResolvedValue({
    model: MODEL,
    manifest: { outputs: { digit: 0, kind: 1 } },
  } as unknown as Awaited<ReturnType<typeof loadClassifier>>)
})

it('runs recognise with the photo, the quad, the model and the output index', async () => {
  jest.mocked(recognise).mockReturnValue({ ok: false, reason: 'no grid in the photo' })
  const scanner = await freshScanner()
  await scanner.recognise(photo, QUAD)
  expect(recognise).toHaveBeenCalledWith(photo, QUAD, MODEL, { digit: 0, kind: 1 })
})

it('makes one scanner runtime for many calls', async () => {
  jest.mocked(recognise).mockReturnValue({ ok: false, reason: 'no grid in the photo' })
  const scanner = await freshScanner()
  await scanner.recognise(photo, QUAD)
  await scanner.recognise(photo, null)
  expect(createWorkletRuntime).toHaveBeenCalledTimes(1)
})

it('turns a rejected run into a failure', async () => {
  const { runOnRuntimeAsync } = jest.requireMock('react-native-worklets')
  runOnRuntimeAsync.mockRejectedValueOnce(new Error('runtime crashed'))
  const scanner = await freshScanner()
  await expect(scanner.recognise(photo, QUAD)).resolves.toEqual({ ok: false, reason: 'runtime crashed' })
})

it('rejects when the model does not load', async () => {
  jest.mocked(loadClassifier).mockRejectedValue(new Error('the scanner does not implement model contract 2.0'))
  await expect(freshScanner()).rejects.toThrow('model contract 2.0')
})

// The scanner and its error class come from the same isolated module registry, so instanceof holds.
function freshModules() {
  let modules: { scanner: typeof import('./scanner'); classifier: typeof import('./classifier') } | undefined
  jest.isolateModules(() => {
    modules = { scanner: require('./scanner'), classifier: require('./classifier') }
  })
  return modules!
}

it('loads the model again after a failure that is not a contract error', async () => {
  const { scanner } = freshModules()
  jest.mocked(loadClassifier).mockRejectedValueOnce(new Error('file not ready'))
  await expect(scanner.createScanner()).rejects.toThrow('file not ready')
  await expect(scanner.createScanner()).resolves.toBeDefined()
  expect(loadClassifier).toHaveBeenCalledTimes(2)
})

it('keeps the contract error for every later call', async () => {
  const { scanner, classifier } = freshModules()
  jest.mocked(loadClassifier).mockRejectedValueOnce(new classifier.ModelContractError('contract 2.0'))
  await expect(scanner.createScanner()).rejects.toThrow('contract 2.0')
  await expect(scanner.createScanner()).rejects.toThrow('contract 2.0')
  expect(loadClassifier).toHaveBeenCalledTimes(1)
})
