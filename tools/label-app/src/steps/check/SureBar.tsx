import { useState } from 'react'

interface Props {
  /** The threshold in percent, 50 to 100. */
  percent: number
  onPercent: (percent: number) => void
  /** The cells that the button confirms. */
  sure: number
  loading: boolean
  busy: boolean
  onConfirm: () => void
}

/** The legend of the tile colours and the button that confirms every cell the model is sure of. */
export function SureBar({ percent, onPercent, sure, loading, busy, onConfirm }: Props) {
  // The draft is the text in the field: it can be empty or out of range while the person types.
  const [draft, setDraft] = useState(String(percent))
  return (
    <div className="check-tools">
      <div className="legend" aria-label="Legend">
        <span>Edge: sure</span>
        <span className="legend-bar" aria-hidden="true" />
        <span>doubtful</span>
        <span className="badge grey">as given</span>
        <span className="badge blue">your fix, tinted</span>
        <span className="badge selected">selected</span>
      </div>
      <div className="sure">
        <label>
          Threshold
          <input
            type="number"
            min={50}
            max={100}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              const n = Math.round(Number(e.target.value))
              if (e.target.value !== '' && n >= 50 && n <= 100) onPercent(n)
            }}
          />{' '}
          %
        </label>
        <button type="button" onClick={onConfirm} disabled={busy || loading || !sure}>
          {loading
            ? `Counting the cells the model is at least ${percent} % sure of…`
            : `Confirm ${sure} cells the model is at least ${percent} % sure of`}
        </button>
      </div>
    </div>
  )
}
