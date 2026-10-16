import { useState } from 'react'
import { type GestureResponderEvent, Text, View } from 'react-native'
import { STEP } from './ThresholdSlider.constants'
import { styles } from './ThresholdSlider.styles'

type ThresholdSliderProps = {
  label: string
  value: number
  min: number
  max: number
  onChange(value: number): void
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** A slider for a value between min and max, rounded to STEP. VoiceOver moves it with swipe up and down. */
export function ThresholdSlider({ label, value, min, max, onChange }: ThresholdSliderProps) {
  const [width, setWidth] = useState(0)
  const share = (value - min) / (max - min)
  const set = (next: number) => onChange(Math.round(clamp(next, min, max) / STEP) * STEP)
  const follow = (event: GestureResponderEvent) => {
    if (width > 0) set(min + (event.nativeEvent.locationX / width) * (max - min))
  }
  const text = value.toFixed(2)
  return (
    <View style={styles.slider}>
      <View style={styles.head}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{text}</Text>
      </View>
      <View
        testID="threshold-slider"
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ text }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => set(value + (event.nativeEvent.actionName === 'increment' ? STEP : -STEP))}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={follow}
        onResponderMove={follow}
        style={styles.area}
      >
        <View pointerEvents="none" style={styles.track} />
        <View pointerEvents="none" style={[styles.fill, { width: share * width }]} />
        <View pointerEvents="none" style={[styles.knob, { left: share * width }]} />
      </View>
    </View>
  )
}
