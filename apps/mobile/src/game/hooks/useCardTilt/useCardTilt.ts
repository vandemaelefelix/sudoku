import {
  SensorType,
  useAnimatedReaction,
  useAnimatedSensor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated'
import { NO_TILT, PERSPECTIVE } from '@/game/constants/tilt.constants'
import { cardRotation, isReading, tiltOf, type Attitude } from '@/game/utils/tilt.utils'

/**
 * The card and shine styles that follow the phone (ADR-017). The first real reading is the rest position.
 * shineTravel is the move of the shine at a full tilt, in points. Do not call it with Reduce Motion on.
 */
export function useCardTilt(shineTravel: number) {
  const { sensor } = useAnimatedSensor(SensorType.ROTATION, { interval: 'auto' })
  const rest = useSharedValue<Attitude | null>(null)

  useAnimatedReaction(
    () => sensor.value,
    (reading) => {
      if (rest.get() === null && isReading(reading)) rest.set({ pitch: reading.pitch, roll: reading.roll })
    },
  )

  const tilt = useDerivedValue(() => (rest.value === null ? NO_TILT : tiltOf(sensor.value, rest.value)))

  const cardStyle = useAnimatedStyle(() => {
    const { rotateX, rotateY } = cardRotation(tilt.value)
    return {
      transform: [
        { perspective: PERSPECTIVE },
        // + 0 turns -0 into 0, so a still card gives "0.00deg", not "-0.00deg".
        { rotateX: `${(rotateX + 0).toFixed(2)}deg` },
        { rotateY: `${(rotateY + 0).toFixed(2)}deg` },
      ],
    }
  })

  const shineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tilt.value.x * shineTravel }, { translateY: tilt.value.y * shineTravel }],
  }))

  return { cardStyle, shineStyle }
}
