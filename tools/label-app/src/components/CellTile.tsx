import type { CSSProperties, MouseEvent, ReactNode } from 'react'

import { cellImage } from '../api/client'
import type { Kind, Label } from '../api/types'

export const KIND_LETTER: Record<Kind, string> = { printed: 'P', handwritten: 'H', unsure: '?' }

export function labelText(digit: Label | null, kind?: Kind | null): string {
  if (digit === null) return '?'
  if (digit === 'empty') return 'Empty'
  if (digit === 'discarded') return '✕'
  return kind ? `${digit} ${KIND_LETTER[kind]}` : digit
}

interface Props {
  stem: string
  /** The label in the corner, for example `7 H`. */
  label?: string | undefined
  /** The person changed the label on this page. */
  changed?: boolean | undefined
  /** Marked by a click: the cell is wrong, or picked for a key. */
  marked?: boolean | undefined
  dim?: boolean | undefined
  title?: string | undefined
  onClick?: ((event: MouseEvent) => void) | undefined
  /** 0 sure to 1 doubtful: colours the edge from green to red. */
  doubt?: number | undefined
  /** The id that a drag selection reads from the tile. */
  id?: string | undefined
  /** The pointer or the keyboard focus came onto the tile. */
  onHover?: (() => void) | undefined
  children?: ReactNode
}

export function CellTile({ stem, label, changed, marked, dim, title, onClick, onHover, doubt, id, children }: Props) {
  const classes = ['tile', marked && 'marked', changed && 'changed', dim && 'dim'].filter(Boolean).join(' ')
  return (
    <button
      type="button"
      className={classes}
      title={title}
      onClick={onClick}
      onMouseEnter={onHover}
      onFocus={onHover}
      data-id={id}
      data-changed={changed ? 'true' : undefined}
      data-doubt={doubt === undefined ? undefined : doubt.toFixed(2)}
      style={doubt === undefined ? undefined : ({ '--doubt': doubt } as CSSProperties)}
      aria-pressed={marked ?? false}
      aria-label={label ? `Cell ${stem}, ${label}` : `Cell ${stem}`}
    >
      <img src={cellImage(stem)} alt="" width={64} height={64} draggable={false} />
      {label ? <span className="tile-label">{label}</span> : null}
      {children}
    </button>
  )
}
