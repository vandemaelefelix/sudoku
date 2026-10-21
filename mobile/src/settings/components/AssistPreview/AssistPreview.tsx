import { memo } from 'react'
import { View } from 'react-native'
import { DisplayGameProvider } from '@/game/components/DisplayGameProvider'
import { Grid } from '@/game/components/Grid'
import { previewBoard } from '@/settings/utils/assistPreview.utils'
import { styles } from './AssistPreview.styles'

const PREVIEW_BOARD = previewBoard()

/** The real game grid at preview size. Grid reads the live assists itself, so the preview follows each switch. */
export const AssistPreview = memo(function AssistPreview() {
  return (
    <View style={styles.well}>
      <DisplayGameProvider board={PREVIEW_BOARD}>
        <View testID="assist-preview" style={styles.frame}>
          <Grid interactive={false} digitSize="small" />
        </View>
      </DisplayGameProvider>
    </View>
  )
})
