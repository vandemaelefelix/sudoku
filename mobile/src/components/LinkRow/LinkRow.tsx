import { CardRow } from '@/components/CardRow'

type LinkRowProps = {
  label: string
  description: string
  onPress(): void
}

/** A row of a framed card that opens another screen. VoiceOver reads the label as the name and the description as the hint. */
export function LinkRow({ label, description, onPress }: LinkRowProps) {
  return (
    <CardRow
      label={label}
      description={description}
      accessibilityLabel={label}
      accessibilityHint={description}
      chevron
      onPress={onPress}
    />
  )
}
