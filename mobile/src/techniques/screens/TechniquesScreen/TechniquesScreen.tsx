import { ScrollView, Text, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { HINT_TECHNIQUES, type HintTechniqueId, type TechniqueId } from '@sudoku/core'
import { LinkRow } from '@/components/LinkRow'
import { ThemeStatusBar } from '@/game/components/ThemeStatusBar'
import { TechniquesHeader } from '@/techniques/components/TechniquesHeader'
import { techniqueIds } from '@/techniques/utils/techniques.utils'
import { useIntl } from '@/i18n/hooks/useIntl'
import { capitalised, techniqueDefinition, techniqueName } from '@/utils/hintText.utils'
import { styles } from './TechniquesScreen.styles'

const IDS = techniqueIds()

type TechniquesScreenProps = { onBack(): void; onOpen(technique: TechniqueId): void }

/** Every technique that a hint teaches, easiest first. Nothing on the screen is tracked or sent (SUD-02). */
export function TechniquesScreen({ onBack, onOpen }: TechniquesScreenProps) {
  const { theme } = useUnistyles()
  const intl = useIntl()
  return (
    <>
      <ThemeStatusBar />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} indicatorStyle={theme.scrollIndicator}>
        <TechniquesHeader title={intl.formatMessage({ id: 'techniques.title' })} onBack={onBack} />
        <Text style={styles.intro}>{intl.formatMessage({ id: 'techniques.intro' })}</Text>
        <View style={styles.card}>
          {IDS.map((id, index) => {
            if (HINT_TECHNIQUES[id] === undefined) return null
            // A technique of HINT_TECHNIQUES has its name and definition in the catalogue.
            const hinted = id as HintTechniqueId
            return (
              <LinkRow
                key={id}
                label={techniqueName(intl, hinted)}
                description={capitalised(techniqueDefinition(intl, hinted))}
                divider={index > 0}
                onPress={() => onOpen(id)}
              />
            )
          })}
        </View>
      </ScrollView>
    </>
  )
}
