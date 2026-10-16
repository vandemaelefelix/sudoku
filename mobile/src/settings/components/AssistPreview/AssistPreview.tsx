import { memo } from 'react'
import { View } from 'react-native'
import { LayoutAnimationConfig } from 'react-native-reanimated'
import { DisplayGameProvider } from '@/game/components/DisplayGameProvider'
import { Grid } from '@/game/components/Grid'
import { previewBoard } from '@/settings/utils/assistPreview.utils'
import { styles } from './AssistPreview.styles'

const PREVIEW_BOARD = previewBoard()

/**
 * The real game grid at preview size. Grid reads the live assists itself, so the preview follows each switch.
 * skipEntering: the fills crossfade on a change, not when the screen opens.
 */
export const AssistPreview = memo(function AssistPreview() {
  return (
    <View style={styles.well}>
      <DisplayGameProvider board={PREVIEW_BOARD}>
        <View testID="assist-preview" style={styles.frame}>
          <LayoutAnimationConfig skipEntering>
            <Grid interactive={false} digitSize="small" />
          </LayoutAnimationConfig>
        </View>
      </DisplayGameProvider>
    </View>
  )
})
