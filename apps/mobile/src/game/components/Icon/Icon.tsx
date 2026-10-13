import { Canvas, Group, Path } from '@shopify/react-native-skia'
import { useUnistyles } from 'react-native-unistyles'
import { ICON_PATHS, STROKE_WIDTH, VIEW_BOX } from './Icon.constants'

export type IconName = keyof typeof ICON_PATHS

export type IconTone = 'text' | 'textMuted' | 'accent' | 'onAccent' | 'warningText'

type IconProps = {
  name: IconName
  tone: IconTone
  size?: 16 | 24
  /** Wins over tone. For a surface with its own component tokens, such as the finish card. */
  color?: string | undefined
}

/** A stroke icon. Skia reads the colour as a value, so the icon reads the theme (ADR-015, point 10). */
export function Icon({ name, tone, size = 24, color }: IconProps) {
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
          color={color ?? theme.colors[tone]}
        />
      </Group>
    </Canvas>
  )
}
