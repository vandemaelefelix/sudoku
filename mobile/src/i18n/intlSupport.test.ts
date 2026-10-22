import { missingIntl } from './intlSupport'

it('lists the Intl APIs that the runtime lacks, in the order the polyfills load', () => {
  expect(
    missingIntl({
      getCanonicalLocales: () => true,
      locale: () => false,
      pluralRules: (locale) => (locale === 'nl' ? 'nl' : undefined),
    }),
  ).toEqual(['getCanonicalLocales', 'PluralRules'])
})

it('lists nothing when the runtime has every API', () => {
  expect(missingIntl({ getCanonicalLocales: () => false, locale: () => false, pluralRules: () => undefined })).toEqual(
    [],
  )
})
