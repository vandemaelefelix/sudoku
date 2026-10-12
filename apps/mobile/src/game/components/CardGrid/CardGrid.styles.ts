import { StyleSheet } from 'react-native-unistyles'
import { roleFont } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  grid: {
    width: theme.size.card.grid,
    height: theme.size.card.grid,
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 1.5,
    borderColor: theme.components.finishCard.boxLine,
    borderRadius: theme.shape.radius.sm,
    overflow: 'hidden',
  },
  cell: {
    width: `${100 / 9}%`,
    height: `${100 / 9}%`,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.components.finishCard.line,
  },
  boxRight: { borderRightWidth: 1.5, borderRightColor: theme.components.finishCard.boxLine },
  boxBottom: { borderBottomWidth: 1.5, borderBottomColor: theme.components.finishCard.boxLine },
  lastColumn: { borderRightWidth: 0 },
  lastRow: { borderBottomWidth: 0 },
  given: { ...roleFont(theme.type.given), fontSize: 15, color: theme.components.finishCard.given },
  entry: { ...roleFont(theme.type.entry), fontSize: 15, color: theme.components.finishCard.entry },
}))
