import { useMemo } from 'react'
import { ScrollView, Text } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { HINT_TECHNIQUES, TECHNIQUE_PAGES, techniqueExample, type TechniqueId } from '@sudoku/core'
import { ThemeStatusBar } from '@/game/components/ThemeStatusBar'
import { TechniqueExample } from '@/techniques/components/TechniqueExample'
import { TechniquesHeader } from '@/techniques/components/TechniquesHeader'
import { capitalised, exampleSpeech, levelLine } from '@/techniques/utils/techniques.utils'
import { styles } from './TechniqueScreen.styles'

type TechniqueScreenProps = {
  /** Null: the route named no technique with a page. */
  technique: TechniqueId | null
  onBack(): void
}

/** The page of one technique: what it is, when it shows up, and one board where it applies. */
export function TechniqueScreen({ technique, onBack }: TechniqueScreenProps) {
  const { theme } = useUnistyles()
  const example = useMemo(() => (technique === null ? null : techniqueExample(technique)), [technique])
  const hint = technique === null ? undefined : HINT_TECHNIQUES[technique]
  const page = technique === null ? undefined : TECHNIQUE_PAGES[technique]
  return (
    <>
      <ThemeStatusBar />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} indicatorStyle={theme.scrollIndicator}>
        <TechniquesHeader title={hint?.name ?? 'Not found'} onBack={onBack} />
        {technique === null || hint === undefined || page === undefined ? (
          <Text style={styles.body}>This technique is not in the app.</Text>
        ) : (
          <>
            <Text style={styles.definition}>{capitalised(hint.definition)}</Text>
            <Text style={styles.level}>{levelLine(technique)}</Text>
            <Text style={styles.body}>{page.explanation}</Text>
            {example !== null && (
              <>
                <Text accessibilityRole="header" style={styles.section}>
                  Example
                </Text>
                <TechniqueExample example={example} />
                {/* VoiceOver reads this text as the label of the board. */}
                <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.caption}>
                  {exampleSpeech(example)}
                </Text>
              </>
            )}
          </>
        )}
      </ScrollView>
    </>
  )
}
