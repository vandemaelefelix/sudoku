import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import type { SettingsRepository } from '../../settings/SettingsRepository'
import { DEFAULT_INDEX, EFFECTS, effectIndex } from './index'
import type { EffectFamily } from './types'

/** The settings key of the saved effect id. */
export const EFFECT_KEY = 'lab.effect'

const FAMILIES: { family: EffectFamily; title: string }[] = [
  { family: 'simulation', title: 'Simulation' },
  { family: 'path', title: 'Path' },
  { family: 'shader', title: 'Shader' },
  { family: 'screen', title: 'Screen' },
]

function logSettingsError(error: unknown) {
  if (__DEV__) console.log(`[fx] settings failed: ${error instanceof Error ? error.message : String(error)}`)
}

/** The dev pill and the list of effects. Render it only in a development build. effect: the index that EffectCanvas reads. */
export function EffectPicker({ effect, settings }: { effect: SharedValue<number>; settings: SettingsRepository }) {
  const [index, setIndex] = useState(DEFAULT_INDEX)
  const [open, setOpen] = useState(false)
  // A pick before the saved choice loads wins, so a slow store does not undo it.
  const picked = useRef(false)

  useEffect(() => {
    let alive = true
    settings.get(EFFECT_KEY).then((id) => {
      if (!alive || picked.current) return
      const saved = effectIndex(id)
      effect.set(saved)
      setIndex(saved)
    }, logSettingsError)
    return () => {
      alive = false
    }
  }, [effect, settings])

  function pick(next: number) {
    picked.current = true
    effect.set(next)
    setIndex(next)
    setOpen(false)
    settings.set(EFFECT_KEY, EFFECTS[next].id).catch(logSettingsError)
  }

  return (
    <View style={styles.layer} pointerEvents="box-none">
      <Pressable
        testID="effect-pill"
        accessibilityRole="button"
        accessibilityLabel={`Effect: ${EFFECTS[index].name}`}
        style={styles.pill}
        onPress={() => setOpen(!open)}
      >
        <Text style={styles.pillText}>{EFFECTS[index].name}</Text>
      </Pressable>
      {open ? (
        <View testID="effect-list" style={styles.list}>
          {FAMILIES.filter(({ family }) => EFFECTS.some((fx) => fx.family === family)).map(({ family, title }) => (
            <View key={family}>
              <Text style={styles.family}>{title}</Text>
              {EFFECTS.map((fx, i) =>
                fx.family !== family ? null : (
                  <Pressable
                    key={fx.id}
                    testID={`effect-${fx.id}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: i === index }}
                    style={styles.row}
                    onPress={() => pick(i)}
                  >
                    <Text style={i === index ? styles.rowActive : styles.rowText}>{fx.name}</Text>
                  </Pressable>
                ),
              )}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, alignItems: 'center', paddingTop: 70 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.6)' },
  pillText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  list: { marginTop: 8, padding: 12, minWidth: 240, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.8)' },
  family: { marginTop: 8, color: 'rgba(255,255,255,0.6)', fontSize: 12, textTransform: 'uppercase' },
  row: { paddingVertical: 8 },
  rowText: { color: '#ffffff', fontSize: 16 },
  rowActive: { color: '#ffd60a', fontSize: 16, fontWeight: '600' },
})
