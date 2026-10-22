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

// nitro-image makes its native objects when it loads. A test that loads an image gives its own stand-in.
jest.mock('react-native-nitro-image', () => ({
  loadImage: jest.fn(async () => {
    throw new Error('Jest has no native images')
  }),
}))

// The picker is closed until a test gives a result.
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })),
  UIImagePickerPreferredAssetRepresentationMode: {
    Automatic: 'automatic',
    Compatible: 'compatible',
    Current: 'current',
  },
}))

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
  notificationAsync: jest.fn(async () => undefined),
  selectionAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy', Soft: 'soft', Rigid: 'rigid' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}))

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(async () => true),
  hide: jest.fn(),
  hideAsync: jest.fn(async () => undefined),
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
      getItemSync: jest.fn((key: string) => mockItems.get(key) ?? null),
      setItemAsync: jest.fn(async (key: string, value: string) => {
        mockItems.set(key, value)
      }),
    },
  }
})

// The Keychain is native. Each test sets what it needs. A new read gives no value.
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}))

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
    // The library mock has createAnimatedComponent only on its default export.
    createAnimatedComponent: <T>(component: T) => component,
    useAnimatedReaction: jest.fn(),
    useFrameCallback: jest.fn(() => ({ setActive: jest.fn(), isActive: true, callbackId: 1 })),
    useReducedMotion: jest.fn(() => false),
    // The library mock has no LayoutAnimationConfig. The tests do not run layout animations.
    LayoutAnimationConfig: ({ children }: { children?: unknown }) => children,
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
    Group: ({ children }: { children?: unknown }) => children,
    Path: (props: object) => createElement(View, { testID: 'skia-path', ...props }),
    Image: (props: object) => createElement(View, { testID: 'skia-image', ...props }),
    createPicture: jest.fn(() => ({})),
    matchFont: jest.fn(() => ({ measureText: () => ({ width: 10 }) })),
    FillType: { Winding: 0, EvenOdd: 1 },
    PaintStyle: { Fill: 0, Stroke: 1 },
    StrokeCap: { Butt: 0, Round: 1, Square: 2 },
    StrokeJoin: { Miter: 0, Round: 1, Bevel: 2 },
    BlendMode: { Modulate: 13, DstOut: 7 },
    makeImageFromView: jest.fn(() => Promise.resolve({ width: () => 780, height: () => 1688, dispose: jest.fn() })),
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
        setBlendMode: jest.fn(),
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

// Clerk talks to the network and the Keychain. Each test sets the hook results that it needs.
jest.mock('@clerk/expo', () => ({
  ClerkProvider: jest.fn(({ children }: { children?: unknown }) => children),
  useAuth: jest.fn(() => ({
    isLoaded: true,
    isSignedIn: false,
    userId: null,
    getToken: jest.fn(async () => null),
    signOut: jest.fn(async () => undefined),
  })),
  useUser: jest.fn(() => ({ isLoaded: true, isSignedIn: false, user: null })),
  useSignIn: jest.fn(),
  useSignUp: jest.fn(),
}))
jest.mock('@clerk/expo/token-cache', () => ({ tokenCache: { getToken: jest.fn(), saveToken: jest.fn() } }))
jest.mock('@clerk/expo/resource-cache', () => ({ resourceCache: jest.fn() }))
jest.mock('@clerk/expo/google', () => ({
  useSignInWithGoogle: jest.fn(() => ({ startGoogleAuthenticationFlow: jest.fn() })),
}))

// The Unistyles mock resolves every StyleSheet.create with the first registered theme, so configure must run before a styles file loads.
// oxlint-disable-next-line import/no-unassigned-import -- the module registers the themes as its side effect.
require('@/theme/unistyles')

// The network state is native. Tests call the listener that the code registers.
jest.mock('expo-network', () => ({
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
  getNetworkStateAsync: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })),
}))

// expo-crypto is native. Tests get a real v4 UUID from Node.
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }))
