import { Pressable, Text, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { Icon } from '@/game/components/Icon'
import { useIntl } from '@/i18n/hooks/useIntl'
import type { useCorrectionMotion } from '@/scan/hooks/useCorrectionMotion'
import type { CorrectionLayout } from '@/scan/utils/correction.utils'
import { pressedStyles } from '@/theme/pressed.styles'
import { styles } from './CorrectionBar.styles'

type CorrectionBarProps = {
  bar: CorrectionLayout['bar']
  /** The large title block under the bar. A theme without one gives it no height, and the bar shows the title. */
  title: CorrectionLayout['title']
  heading: string
  titleStyle: ReturnType<typeof useCorrectionMotion>['titleStyle']
  /** The bar takes touches. False until the result arrives, so the transition stays inert. */
  interactive: boolean
  onRetake(): void
  /** Without it, the bar has no wrench. */
  onOpenDev?: (() => void) | undefined
}

/** Retake, the title and the wrench of the dev menu, with the large title of the themes that have one. */
export function CorrectionBar({
  bar,
  title,
  heading,
  titleStyle,
  interactive,
  onRetake,
  onOpenDev,
}: CorrectionBarProps) {
  const intl = useIntl()
  const largeTitle = title.height > 0
  return (
    <>
      <Animated.View
        pointerEvents={interactive ? 'box-none' : 'none'}
        style={[styles.bar, { left: bar.x, top: bar.y, width: bar.width, height: bar.height }, titleStyle]}
      >
        <Pressable
          testID="retake"
          accessibilityRole="button"
          accessibilityLabel={intl.formatMessage({ id: 'scan.correction.retakeLabel' })}
          onPress={onRetake}
          hitSlop={8}
          style={({ pressed }) => [styles.retake, pressed && pressedStyles.pressed]}
        >
          <Icon name="back" tone="text" />
          <Text style={styles.retakeText}>{intl.formatMessage({ id: 'scan.correction.retake' })}</Text>
        </Pressable>
        {!largeTitle && (
          <Text accessibilityRole="header" style={styles.barTitle}>
            {heading}
          </Text>
        )}
        <View style={styles.barEnd}>
          {onOpenDev && (
            <Pressable
              testID="dev-open"
              accessibilityRole="button"
              accessibilityLabel={intl.formatMessage({ id: 'scan.correction.devMenu' })}
              onPress={onOpenDev}
              style={({ pressed }) => [styles.wrench, pressed && pressedStyles.pressed]}
            >
              <Icon name="wrench" tone="textMuted" />
            </Pressable>
          )}
        </View>
      </Animated.View>
      {largeTitle && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.titleBlock,
            { left: title.x, top: title.y, width: title.width, height: title.height },
            titleStyle,
          ]}
        >
          <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit style={styles.display}>
            {heading}
          </Text>
        </Animated.View>
      )}
    </>
  )
}
