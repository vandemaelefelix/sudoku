import { StyleSheet } from 'react-native-unistyles'

/** 46 pt, from the design canvas. */
const DISC = 46

export const styles = StyleSheet.create((theme) => ({
  disc: { width: DISC, height: DISC, borderRadius: DISC / 2, backgroundColor: theme.colors.text },
}))
