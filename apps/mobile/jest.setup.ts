// Native modules do not exist in Jest. Each mock gives tests a stand-in they can override.

jest.mock('react-native-worklets', () => {
  const mock = jest.requireActual('react-native-worklets/lib/module/mock')
  return {
    ...mock,
    // The library mock returns the value itself. The camera screen needs a holder.
    createSynchronizable: <T>(initial: T) => {
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
    usePhotoOutput: jest.fn(() => ({ capturePhoto: jest.fn() })),
    CommonResolutions: { UHD_16_9: { width: 2160, height: 3840 } },
  }
})

jest.mock('react-native-fast-opencv', () => ({
  DataTypes: { CV_8U: 0 },
  Mat: {
    create: jest.fn((rows: number, cols: number) => ({ rows, cols, release: jest.fn() })),
  },
}))

jest.mock('react-native-fast-tflite', () => ({
  loadTensorflowModel: jest.fn(async () => ({
    inputs: [{ shape: [81, 32, 32, 1], dataType: 'float32' }],
    outputs: [{ shape: [81, 10] }, { shape: [81, 4] }],
    runSync: () => [new ArrayBuffer(81 * 10 * 4), new ArrayBuffer(81 * 4 * 4)],
  })),
}))

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light' },
}))

// The library ships its own mock: a provider with zero insets and a 320 × 640 frame.
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
)

jest.mock('react-native-vision-camera-resizer', () => ({
  useResizer: jest.fn(() => ({ state: 'loading', resizer: undefined, error: undefined })),
}))

// The key-value store of expo-sqlite is native. This stand-in keeps the values in memory for one test file.
jest.mock('expo-sqlite/kv-store', () => {
  const mockItems = new Map<string, string>()
  return {
    __esModule: true,
    default: {
      getItemAsync: jest.fn(async (key: string) => mockItems.get(key) ?? null),
      setItemAsync: jest.fn(async (key: string, value: string) => {
        mockItems.set(key, value)
      }),
    },
  }
})

jest.mock('react-native-reanimated', () => {
  const { useRef } = jest.requireActual('react')
  return {
    ...jest.requireActual('react-native-reanimated/mock'),
    // The library mock makes a new holder on every render and has no modify().
    useSharedValue: <T>(initial: T) => {
      const holder: { current: { value: T } | null } = useRef(null)
      if (holder.current == null) {
        const mockShared = {
          value: initial,
          get: () => mockShared.value,
          set: (next: T | ((mockPrevious: T) => T)) => {
            mockShared.value = typeof next === 'function' ? (next as (mockPrevious: T) => T)(mockShared.value) : next
          },
          modify: (modifier?: (mockPrevious: T) => T) => {
            if (modifier) mockShared.value = modifier(mockShared.value)
          },
        }
        holder.current = mockShared
      }
      return holder.current
    },
    useAnimatedReaction: jest.fn(),
    useFrameCallback: jest.fn(() => ({ setActive: jest.fn(), isActive: true, callbackId: 1 })),
    useReducedMotion: jest.fn(() => false),
  }
})

// A path stand-in that records its calls. The name starts with mock so the jest.mock factory may use it.
function mockPath() {
  const calls: unknown[][] = []
  const self = {
    calls,
    moveTo: (...args: unknown[]) => (calls.push(['moveTo', ...args]), self),
    lineTo: (...args: unknown[]) => (calls.push(['lineTo', ...args]), self),
    close: () => (calls.push(['close']), self),
    setFillType: (fill: unknown) => (calls.push(['setFillType', fill]), self),
  }
  return self
}

// Skia's own Jest setup needs CanvasKit. Views are enough for these tests.
jest.mock('@shopify/react-native-skia', () => {
  const { View } = jest.requireActual('react-native')
  const { createElement } = jest.requireActual('react')
  return {
    Canvas: ({ children, ...props }: { children?: unknown }) =>
      createElement(View, { testID: 'skia-canvas', ...props }, children),
    Picture: (props: object) => createElement(View, { testID: 'skia-picture', ...props }),
    createPicture: jest.fn(() => ({})),
    FillType: { Winding: 0, EvenOdd: 1 },
    PaintStyle: { Fill: 0, Stroke: 1 },
    StrokeCap: { Butt: 0, Round: 1, Square: 2 },
    StrokeJoin: { Miter: 0, Round: 1, Bevel: 2 },
    BlendMode: { Modulate: 13 },
    TileMode: { Clamp: 0 },
    ColorType: { RGBA_8888: 4, BGRA_8888: 6 },
    AlphaType: { Opaque: 1, Premul: 2 },
    Skia: {
      Data: { fromBytes: jest.fn((bytes: Uint8Array) => ({ bytes, dispose: jest.fn() })) },
      Image: { MakeImage: jest.fn(() => ({ dispose: jest.fn() })) },
      Color: (color: string) => color,
      Paint: () => ({
        setAntiAlias: jest.fn(),
        setColor: jest.fn(),
        setAlphaf: jest.fn(),
        setShader: jest.fn(),
        setStyle: jest.fn(),
        setStrokeWidth: jest.fn(),
        setStrokeCap: jest.fn(),
        setStrokeJoin: jest.fn(),
      }),
      Path: { Make: mockPath },
      RSXform: (scos: number, ssin: number, tx: number, ty: number) => ({ scos, ssin, tx, ty }),
      XYWHRect: (x: number, y: number, width: number, height: number) => ({ x, y, width, height }),
      Shader: { MakeRadialGradient: jest.fn(() => ({})) },
      RuntimeEffect: { Make: jest.fn(() => ({ makeShader: jest.fn(() => ({})) })) },
      Surface: {
        Make: jest.fn(() => ({
          getCanvas: () => ({ drawPaint: jest.fn() }),
          makeImageSnapshot: () => ({}),
        })),
      },
    },
  }
})
