import { render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { useSharedValue } from 'react-native-reanimated'
import { cobalt } from '@/theme/themes/cobalt'
import { WORD_SCALE } from '@/splash/constants/splash.constants'
import { SplashWord } from './SplashWord'

function Word() {
  const intro = useSharedValue(925)
  const exit = useSharedValue(0)
  return <SplashWord intro={intro} exit={exit} color={cobalt.colors.text} />
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
    fontFamily: cobalt.type.title.family,
    fontSize: cobalt.type.title.scale * WORD_SCALE,
  })
})
