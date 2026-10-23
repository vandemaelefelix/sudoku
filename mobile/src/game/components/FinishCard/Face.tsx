import { Text, View } from 'react-native'
import Animated, { type LayoutAnimation } from 'react-native-reanimated'
import type { Game } from '@sudoku/core'
import { Icon } from '@/components/Icon'
import { CardGrid } from '@/game/components/CardGrid'
import type { FinishView } from '@/game/utils/finish.utils'
import { useIntl } from '@/i18n/hooks/useIntl'
import { ThemeDecoration } from '@/theme/decorations/ThemeDecoration'
import { styles } from './FinishCard.styles'
import { Stat } from './Stat'

type FaceProps = {
  view: FinishView
  board: Game
  iconColor: string
  /** The entering animation of a part of the face. The parts count from 0 at the top: title, time, grid, stats, footer. */
  partIn(part: number): () => LayoutAnimation
}

export function Face({ view, board, iconColor, partIn }: FaceProps) {
  const intl = useIntl()
  return (
    <>
      <ThemeDecoration slot="cardEdge" style={styles.edge} />
      <Animated.View entering={partIn(0)} style={styles.top}>
        <Text style={styles.title}>{view.title}</Text>
        {view.newBest && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{intl.formatMessage({ id: 'finish.newBest' })}</Text>
          </View>
        )}
      </Animated.View>
      <Animated.View entering={partIn(1)}>
        <Text style={styles.time}>{view.time}</Text>
      </Animated.View>
      <Animated.View entering={partIn(2)}>
        <CardGrid board={board} />
      </Animated.View>
      <Animated.View entering={partIn(3)} style={styles.stats}>
        <Stat label={intl.formatMessage({ id: 'stats.games.mistakes' })} value={view.mistakes} />
        <Stat label={intl.formatMessage({ id: 'stats.games.hints' })} value={view.hints} />
        <Stat label={intl.formatMessage({ id: 'finish.stat.best' })} value={view.best} />
      </Animated.View>
      <Animated.View entering={partIn(4)} style={styles.footer}>
        {view.fromPaper && <Icon name="scan" tone="text" size={16} color={iconColor} />}
        <Text style={styles.source}>{view.source}</Text>
        <Text style={styles.date}>{view.date}</Text>
      </Animated.View>
    </>
  )
}
