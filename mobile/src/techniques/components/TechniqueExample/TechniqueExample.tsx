import { memo, useMemo } from 'react'
import { View } from 'react-native'
import type { TechniqueExample as Example } from '@sudoku/core'
import { DisplayGameProvider } from '@/game/components/DisplayGameProvider'
import { Grid } from '@/game/components/Grid'
import { exampleBoard, exampleSpeech } from '@/techniques/utils/techniques.utils'
import { useIntl } from '@/i18n/hooks/useIntl'
import { styles } from './TechniqueExample.styles'

/** The example board of a technique page, with every highlight role of its step. VoiceOver reads it as one text. */
export const TechniqueExample = memo(function TechniqueExample({ example }: { example: Example }) {
  const intl = useIntl()
  const board = useMemo(() => exampleBoard(example), [example])
  return (
    <View
      testID="technique-example"
      accessible
      accessibilityRole="image"
      accessibilityLabel={exampleSpeech(intl, example)}
      style={styles.frame}
    >
      <DisplayGameProvider board={board}>
        <Grid interactive={false} highlight={example.step} />
      </DisplayGameProvider>
    </View>
  )
})
