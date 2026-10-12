import { Canvas, Group, Path } from '@shopify/react-native-skia'
import { useUnistyles } from 'react-native-unistyles'
import { ICON_PATHS, STROKE_WIDTH, VIEW_BOX } from './Icon.constants'

export type IconName = keyof typeof ICON_PATHS

export type IconTone = 'text' | 'accent'

type IconProps = { name: IconName; tone: IconTone; size?: 16 | 24 }

/** A stroke icon. Skia reads the colour as a value, so the icon reads the theme (ADR-015, point 10). */
export function Icon({ name, tone, size = 24 }: IconProps) {
  const { theme } = useUnistyles()
  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <Group transform={[{ scale: size / VIEW_BOX }]}>
        <Path
          path={ICON_PATHS[name]}
          style="stroke"
          strokeWidth={STROKE_WIDTH[size]}
          strokeCap="round"
          strokeJoin="round"
          color={theme.colors[tone]}
        />
      </Group>
    </Canvas>
  )
}
