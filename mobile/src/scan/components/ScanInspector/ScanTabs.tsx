import { Pressable, Text, View } from 'react-native'
import { TABS } from './ScanInspector.constants'
import { styles } from './ScanInspector.styles'
import type { InspectorView } from '@/scan/utils/inspector.utils'

/** The tabs of the dev menu. */
export function ScanTabs({ view, onChange }: { view: InspectorView; onChange: (view: InspectorView) => void }) {
  return (
    <View testID="scan-tabs" style={styles.tabs}>
      {TABS.map((tab) => (
        <Pressable
          key={tab.view}
          testID={`tab-${tab.view}`}
          accessibilityRole="tab"
          accessibilityState={{ selected: view === tab.view }}
          onPress={() => onChange(tab.view)}
          style={[styles.tab, view === tab.view && styles.tabOn]}
        >
          <Text style={view === tab.view ? styles.tabTextOn : styles.tabText}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}
