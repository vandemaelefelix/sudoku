import { render } from '@testing-library/react-native'
import { useRef } from 'react'
import { ScreenShowLayout, useRedrawOnShow, type ScreenEvents } from './ScreenShow'

type TransitionListener = (event: { data: { closing: boolean } }) => void

function fakeScreen() {
  const listeners = new Set<TransitionListener>()
  const events: ScreenEvents = {
    addListener: (_type, listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  const transition = (closing: boolean) => listeners.forEach((listener) => listener({ data: { closing } }))
  return { events, transition, listeners }
}

function Surface({ redraw }: { redraw: () => void }) {
  const canvas = useRef({ redraw })
  useRedrawOnShow(canvas)
  return null
}

function renderOnScreen(events: ScreenEvents, redraw: () => void) {
  return render(ScreenShowLayout({ navigation: events, children: <Surface redraw={redraw} /> }))
}

it('redraws the canvas when the screen starts to show', () => {
  const screen = fakeScreen()
  const redraw = jest.fn()
  renderOnScreen(screen.events, redraw)
  screen.transition(false)
  expect(redraw).toHaveBeenCalledTimes(1)
})

it('does not redraw the canvas when the screen starts to close', () => {
  const screen = fakeScreen()
  const redraw = jest.fn()
  renderOnScreen(screen.events, redraw)
  screen.transition(true)
  expect(redraw).not.toHaveBeenCalled()
})

it('stops listening when the surface unmounts', () => {
  const screen = fakeScreen()
  const { unmount } = renderOnScreen(screen.events, jest.fn())
  expect(screen.listeners.size).toBe(1)
  unmount()
  expect(screen.listeners.size).toBe(0)
})

it('does nothing outside a screen of the stack', () => {
  const redraw = jest.fn()
  expect(() => render(<Surface redraw={redraw} />)).not.toThrow()
  expect(redraw).not.toHaveBeenCalled()
})
