import { useEffect, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import type { SettingsRepository } from '@/preferences/SettingsRepository'
import { DEFAULT_INDEX, EFFECTS, effectIndex } from '@/scan/effects/registry'
import { devLog, errorMessage } from '@/utils/log.utils'
import { EFFECT_KEY, FAMILIES } from './EffectPicker.constants'
import { styles } from './EffectPicker.styles'

function logSettingsError(error: unknown) {
  devLog('fx', `settings failed: ${errorMessage(error)}`)
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

  function pick(next: number, id: string) {
    picked.current = true
    effect.set(next)
    setIndex(next)
    setOpen(false)
    settings.set(EFFECT_KEY, id).catch(logSettingsError)
  }

  const current = EFFECTS[index] ?? EFFECTS[DEFAULT_INDEX]

  return (
    <View style={styles.layer} pointerEvents="box-none">
      <Pressable
        testID="effect-pill"
        accessibilityRole="button"
        accessibilityLabel={`Effect: ${current.name}`}
        style={styles.pill}
        onPress={() => setOpen(!open)}
      >
        <Text style={styles.pillText}>{current.name}</Text>
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
                    onPress={() => pick(i, fx.id)}
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
