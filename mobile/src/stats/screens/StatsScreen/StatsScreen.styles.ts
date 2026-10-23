import { StyleSheet } from 'react-native-unistyles'
import { roleSized, roleText } from '@/theme/typography'

export const styles = StyleSheet.create((theme) => ({
  titleBlock: { height: theme.size.titleBlock, justifyContent: 'flex-end', marginBottom: theme.space.md },
  display: { ...roleText(theme.type.display), color: theme.colors.text },
  card: { marginBottom: theme.space.xl + theme.space.xs },
  message: { ...roleSized(theme.type.body), color: theme.colors.textMuted },
  stripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingTop: theme.space.md,
    paddingBottom: theme.space.sm,
  },
  stripTitle: { ...roleSized(theme.type.body), color: theme.colors.text },
  stripNote: { ...roleSized(theme.type.caption), color: theme.colors.textMuted },
  settings: {
    marginTop: theme.space.xxl + theme.space.sm,
    borderTopWidth: theme.shape.stroke.thin,
    borderTopColor: theme.colors.line,
  },
}))
