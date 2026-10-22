import type { Language } from '@/i18n/utils/locale.utils'
import { en, type MessageId } from './en'
import { nl } from './nl'

export const CATALOGUES: Readonly<Record<Language, Record<MessageId, string>>> = { en, nl }

// Types the id of every formatMessage call, so an unknown id fails the typecheck (ADR-033, point 3).
declare global {
  namespace FormatjsIntl {
    interface Message {
      ids: MessageId
    }
  }
}
