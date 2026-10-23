import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  panel: {
    position: 'absolute',
    bottom: 0,
    borderTopLeftRadius: theme.components.panel.radius,
    borderTopRightRadius: theme.components.panel.radius,
    borderTopWidth: theme.components.panel.borderWidth,
    borderTopColor: theme.components.panel.border,
    backgroundColor: theme.components.panel.fill,
    boxShadow: theme.elevation.panel,
  },
  panelBody: { gap: theme.space.lg },
}))
