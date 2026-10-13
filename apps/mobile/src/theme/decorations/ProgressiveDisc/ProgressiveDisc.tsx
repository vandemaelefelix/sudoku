import { View } from 'react-native'
import { styles } from './ProgressiveDisc.styles'

/** The Progressive title mark: a solid disc in the text colour. */
export function ProgressiveDisc() {
  return <View testID="decoration-progressive-disc" pointerEvents="none" style={styles.disc} />
}
