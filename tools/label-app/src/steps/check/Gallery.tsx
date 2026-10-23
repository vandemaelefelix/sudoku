import { useState, type MouseEvent } from 'react'

import type { CheckCell } from '../../api/types'
import { CellDetail } from '../../components/CellDetail'
import { CellTile } from '../../components/CellTile'
import { percent } from '../../format'
import type { CheckMode } from './modes'
import type { DragSelect } from './useDragSelect'
import type { Fixes } from './useFixes'

interface Props {
  mode: CheckMode
  cells: CheckCell[]
  selected: Set<string>
  fixes: Fixes
  drag: DragSelect
  onClick: (id: string, event: MouseEvent) => void
}

/** The tiles of the page, the box of a drag, and the detail of the cell under the pointer. */
export function Gallery({ mode, cells, selected, fixes, drag, onClick }: Props) {
  const [focus, setFocus] = useState<string | null>(null)
  const shown = cells.find((c) => c.id === focus) ?? cells[0]
  const fixOf = (cell: CheckCell): string | undefined => {
    const value = fixes.fixes[cell.id]
    return value === undefined ? undefined : mode.show(value)
  }
  return (
    <>
      <div className="check">
        <div className="check-cells">
          <div className="gallery" {...drag.bind}>
            {cells.map((c) => (
              <CellTile
                key={c.id}
                id={c.id}
                stem={c.stem}
                doubt={c.doubt}
                marked={selected.has(c.id)}
                changed={fixes.fixes[c.id] !== undefined}
                label={mode.show(fixes.valueOf(c))}
                title={`Doubt ${percent(c.doubt)}`}
                onClick={(event) => onClick(c.id, event)}
                onHover={() => setFocus(c.id)}
              />
            ))}
          </div>
        </div>
        {shown ? <CellDetail cell={shown} mode={mode.id} fix={fixOf(shown)} /> : null}
      </div>
      {drag.box ? <div className="drag-box" style={drag.box} aria-hidden="true" /> : null}
    </>
  )
}
