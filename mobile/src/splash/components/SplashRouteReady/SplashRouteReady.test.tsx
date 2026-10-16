import { render } from '@testing-library/react-native'
import { usePathname } from 'expo-router'
import { SplashContext } from '@/splash/hooks/useSplash'
import { SplashRouteReady } from './SplashRouteReady'

jest.mock('expo-router', () => ({ usePathname: jest.fn() }))

function renderAt(pathname: string) {
  jest.mocked(usePathname).mockReturnValue(pathname)
  const markReady = jest.fn()
  render(
    <SplashContext value={{ phase: 'intro', markReady }}>
      <SplashRouteReady />
    </SplashContext>,
  )
  return markReady
}

it('waits for the home menu on the home route', () => {
  expect(renderAt('/')).not.toHaveBeenCalled()
})

it('signals ready at once on any other route, for example after a link to a game', () => {
  expect(renderAt('/game')).toHaveBeenCalledTimes(1)
})
