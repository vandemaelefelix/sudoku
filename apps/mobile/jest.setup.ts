// Native modules do not exist in Jest. Each mock gives tests a stand-in they can override.

jest.mock('react-native-worklets', () => {
  const mock = jest.requireActual('react-native-worklets/lib/module/mock')
  return {
    ...mock,
    // The library mock returns the value itself. The camera screen needs a holder.
    createSynchronizable: <T,>(initial: T) => {
      let value = initial
      return {
        getBlocking: () => value,
        getDirty: () => value,
        setBlocking: (next: T | ((mockPrevious: T) => T)) => {
          value = typeof next === 'function' ? (next as (mockPrevious: T) => T)(value) : next
        },
      }
    },
  }
})

jest.mock('react-native-vision-camera', () => {
  const { View } = jest.requireActual('react-native')
  const { createElement } = jest.requireActual('react')
  return {
    Camera: (props: object) => createElement(View, { testID: 'camera', ...props }),
    useCameraPermission: jest.fn(() => ({
      status: 'authorized',
      hasPermission: true,
      canRequestPermission: false,
      requestPermission: jest.fn(async () => true),
    })),
    useCameraDevice: jest.fn(() => ({ id: 'back' })),
    useFrameOutput: jest.fn(() => ({})),
  }
})

jest.mock('react-native-fast-opencv', () => ({
  DataTypes: { CV_8U: 0 },
  Mat: {
    create: jest.fn((rows: number, cols: number) => ({ rows, cols, release: jest.fn() })),
  },
}))

jest.mock('react-native-vision-camera-resizer', () => ({
  useResizer: jest.fn(() => ({ state: 'loading', resizer: undefined, error: undefined })),
}))

jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useAnimatedReaction: jest.fn(),
}))

// Skia's own Jest setup needs CanvasKit. Views are enough for these tests.
jest.mock('@shopify/react-native-skia', () => {
  const { View } = jest.requireActual('react-native')
  const { createElement } = jest.requireActual('react')
  return {
    Canvas: ({ children, ...props }: { children?: unknown }) =>
      createElement(View, { testID: 'skia-canvas', ...props }, children),
    Points: (props: object) => createElement(View, { testID: 'skia-points', ...props }),
  }
})
