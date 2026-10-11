export type Colors = {
  background: string
  surface: string
  text: string
  muted: string
  line: string
  ink: string
  accent: string
  warning: string
  warningText: string
  warningSurface: string
  onAccent: string
  shadow: string
}

export const LIGHT: Colors = {
  background: '#f4f5f8',
  surface: '#ffffff',
  text: '#141821',
  muted: '#5c6475',
  line: '#cfd4de',
  ink: '#1d2330',
  accent: '#2f5bd3',
  warning: '#d98a1c',
  warningText: '#9a5c0a',
  warningSurface: '#fbefd9',
  onAccent: '#ffffff',
  shadow: '#000000',
}

export const DARK: Colors = {
  background: '#0f1116',
  surface: '#171a22',
  text: '#e7e9ef',
  muted: '#9aa1b2',
  line: '#272b35',
  ink: '#e7e9ef',
  accent: '#84a0ff',
  warning: '#f0aa4a',
  warningText: '#f0aa4a',
  warningSurface: '#3a2a12',
  onAccent: '#0f1116',
  shadow: '#000000',
}

/** app.json is light only, so this returns LIGHT until the developer decides on dark mode. */
export function useColors(): Colors {
  return LIGHT
}
