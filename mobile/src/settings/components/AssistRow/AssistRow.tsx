import { CardRow } from '@/components/CardRow'
import { Toggle } from '@/components/Toggle'

type AssistRowProps = {
  label: string
  description: string
  value: boolean
  onChange(on: boolean): void
}

export function AssistRow({ label, description, value, onChange }: AssistRowProps) {
  return (
    <CardRow
      testID={`assist-row-${label}`}
      label={label}
      description={description}
      trailing={<Toggle label={label} hint={description} value={value} onChange={onChange} />}
    />
  )
}
