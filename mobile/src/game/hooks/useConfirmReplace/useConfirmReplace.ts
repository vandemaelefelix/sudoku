import { useCallback } from 'react'
import { Alert } from 'react-native'
import { useIntl } from '@/i18n/hooks/useIntl'

/** The question before a new game ends the game in progress. The promise gives true for New game. */
export function useConfirmReplace(): () => Promise<boolean> {
  const intl = useIntl()
  return useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        Alert.alert(
          intl.formatMessage({ id: 'game.replace.title' }),
          intl.formatMessage({ id: 'game.replace.message' }),
          [
            { text: intl.formatMessage({ id: 'common.cancel' }), style: 'cancel', onPress: () => resolve(false) },
            {
              text: intl.formatMessage({ id: 'game.replace.confirm' }),
              style: 'destructive',
              onPress: () => resolve(true),
            },
          ],
        )
      }),
    [intl],
  )
}
