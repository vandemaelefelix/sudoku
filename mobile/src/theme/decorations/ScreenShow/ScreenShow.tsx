import { createContext, useContext, useEffect, type ReactElement, type RefObject } from 'react'

/** The events of one screen of the native stack. `closing: false` comes from `onWillAppear`, before the first frame. */
export type ScreenEvents = {
  addListener: (type: 'transitionStart', listener: (event: { data: { closing: boolean } }) => void) => () => void
}

const ScreenShowContext = createContext<ScreenEvents | null>(null)

/** The `screenLayout` of the root stack: it gives each screen its own events. */
export function ScreenShowLayout({ navigation, children }: { navigation: ScreenEvents; children: ReactElement }) {
  return <ScreenShowContext value={navigation}>{children}</ScreenShowContext>
}

/**
 * Redraws a Skia canvas when its screen starts to show again (ADR-025). A screen out of the window draws into a layer
 * that the screen never shows, so the canvas keeps the old frame without this. Does nothing outside a stack screen.
 */
export function useRedrawOnShow(canvas: RefObject<{ redraw(): void } | null>) {
  const events = useContext(ScreenShowContext)
  useEffect(() => {
    if (events === null) return
    return events.addListener('transitionStart', ({ data }) => {
      if (!data.closing) canvas.current?.redraw()
    })
  }, [events, canvas])
}
