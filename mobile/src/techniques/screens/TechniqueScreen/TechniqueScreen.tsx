import { useMemo } from 'react'
import { Text } from 'react-native'
import {
  HINT_TECHNIQUES,
  TECHNIQUE_PAGES,
  techniqueExample,
  type HintTechniqueId,
  type TechniqueId,
} from '@sudoku/core'
import { Screen } from '@/components/Screen'
import { ScreenHeader } from '@/components/ScreenHeader'
import { TechniqueExample } from '@/techniques/components/TechniqueExample'
import { exampleSpeech, levelLine } from '@/techniques/utils/techniques.utils'
import { useIntl } from '@/i18n/hooks/useIntl'
import { capitalised, techniqueDefinition, techniqueExplanation, techniqueName } from '@/utils/hintText.utils'
import { styles } from './TechniqueScreen.styles'

type TechniqueScreenProps = {
  /** Null: the route named no technique with a page. */
  technique: TechniqueId | null
  onBack(): void
}

/** The page of one technique: what it is, when it shows up, and one board where it applies. */
export function TechniqueScreen({ technique, onBack }: TechniqueScreenProps) {
  const intl = useIntl()
  const example = useMemo(() => (technique === null ? null : techniqueExample(technique)), [technique])
  // A technique of HINT_TECHNIQUES has its name, definition and explanation in the catalogue.
  const hinted = technique !== null && HINT_TECHNIQUES[technique] !== undefined ? (technique as HintTechniqueId) : null
  const page = technique === null ? undefined : TECHNIQUE_PAGES[technique]
  return (
    <Screen>
      <ScreenHeader
        title={hinted === null ? intl.formatMessage({ id: 'techniques.notFound' }) : techniqueName(intl, hinted)}
        onBack={onBack}
      />
      {hinted === null || page === undefined ? (
        <Text style={styles.body}>{intl.formatMessage({ id: 'techniques.notInApp' })}</Text>
      ) : (
        <>
          <Text style={styles.definition}>{capitalised(techniqueDefinition(intl, hinted))}</Text>
          <Text style={styles.level}>{levelLine(intl, hinted)}</Text>
          <Text style={styles.body}>{techniqueExplanation(intl, hinted)}</Text>
          {example !== null && (
            <>
              <Text accessibilityRole="header" style={styles.section}>
                {intl.formatMessage({ id: 'techniques.example' })}
              </Text>
              <TechniqueExample example={example} />
              {/* VoiceOver reads this text as the label of the board. */}
              <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.caption}>
                {exampleSpeech(intl, example)}
              </Text>
            </>
          )}
        </>
      )}
    </Screen>
  )
}
