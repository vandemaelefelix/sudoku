import { ScrollView, Text, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { HINT_TECHNIQUES, type TechniqueId } from '@sudoku/core'
import { LinkRow } from '@/components/LinkRow'
import { ThemeStatusBar } from '@/game/components/ThemeStatusBar'
import { TechniquesHeader } from '@/techniques/components/TechniquesHeader'
import { TECHNIQUES_TITLE } from '@/techniques/constants/techniques.constants'
import { capitalised, techniqueIds } from '@/techniques/utils/techniques.utils'
import { styles } from './TechniquesScreen.styles'

const IDS = techniqueIds()

type TechniquesScreenProps = { onBack(): void; onOpen(technique: TechniqueId): void }

/** Every technique that a hint teaches, easiest first. Nothing on the screen is tracked or sent (SUD-02). */
export function TechniquesScreen({ onBack, onOpen }: TechniquesScreenProps) {
  const { theme } = useUnistyles()
  return (
    <>
      <ThemeStatusBar />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} indicatorStyle={theme.scrollIndicator}>
        <TechniquesHeader title={TECHNIQUES_TITLE} onBack={onBack} />
        <Text style={styles.intro}>The ways to find a digit that the hints use, from the easiest to the hardest.</Text>
        <View style={styles.card}>
          {IDS.map((id, index) => {
            const technique = HINT_TECHNIQUES[id]
            if (technique === undefined) return null
            return (
              <LinkRow
                key={id}
                label={technique.name}
                description={capitalised(technique.definition)}
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
