// The English catalogue, the source of every message id (ADR-033). Ids are <feature>.<part>.<name>. Messages use ICU syntax.
export const en = {
  'settings.language.title': 'Language',
  'settings.language.system': 'System',
  // A language name is in its own language, so a player finds it in any language.
  'settings.language.en': 'English',
  'settings.language.nl': 'Nederlands',
}

export type MessageId = keyof typeof en
