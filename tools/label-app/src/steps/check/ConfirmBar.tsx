interface Props {
  cells: number
  /** The open cells of the tab on the server: the page may show fewer. */
  left: number
  selected: number
  fixed: number
  disabled: boolean
  onConfirm: () => void
}

/** The footer of the step: what the page holds and the button that confirms it. */
export function ConfirmBar({ cells, left, selected, fixed, disabled, onConfirm }: Props) {
  return (
    <>
      <span className="summary">
        {selected ? `${selected} selected, ` : ''}
        {fixed ? `${fixed} fixed, ` : ''}
        {cells < left ? `${cells} of ${left} shown` : `${cells} on the page`}
      </span>
      <button type="button" className="primary" onClick={onConfirm} disabled={disabled}>
        Confirm {cells} cells <kbd>Enter</kbd>
      </button>
    </>
  )
}
