import { render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { useSharedValue } from 'react-native-reanimated'
import { SPLASH_COLORS } from '@/theme/splash.colors'
import { daylight } from '@/theme/themes/daylight'
import { WORD_SCALE } from '@/splash/constants/splash.constants'
import { SplashWord } from './SplashWord'

function Word() {
  const intro = useSharedValue(925)
  const exit = useSharedValue(0)
  return <SplashWord intro={intro} exit={exit} color={SPLASH_COLORS.light.word} />
}

it('draws the six letters of the word', () => {
  render(<Word />)
  for (const letter of ['S', 'd', 'o', 'k']) expect(screen.getAllByText(letter)).toHaveLength(1)
  expect(screen.getAllByText('u')).toHaveLength(2)
})

it('sets each letter in the title font at twice the size, so scaling down keeps it sharp', () => {
  render(<Word />)
  const style = StyleSheet.flatten(screen.getByText('S').props.style)
  expect(style).toMatchObject({
    fontFamily: daylight.type.title.family,
    fontSize: daylight.type.title.scale * WORD_SCALE,
  })
})
