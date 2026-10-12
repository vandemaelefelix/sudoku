import { useCallback } from 'react'
import { Alert } from 'react-native'
import { REPLACE_CANCEL, REPLACE_CONFIRM, REPLACE_MESSAGE, REPLACE_TITLE } from './useConfirmReplace.constants'

/** The question before a new game ends the game in progress. The promise gives true for New game. */
export function useConfirmReplace(): () => Promise<boolean> {
  return useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        Alert.alert(REPLACE_TITLE, REPLACE_MESSAGE, [
          { text: REPLACE_CANCEL, style: 'cancel', onPress: () => resolve(false) },
          { text: REPLACE_CONFIRM, style: 'destructive', onPress: () => resolve(true) },
        ])
      }),
    [],
  )
}
