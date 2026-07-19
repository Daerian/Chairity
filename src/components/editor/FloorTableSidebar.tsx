'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { LayoutGrid, Circle, Square, GripVertical } from 'lucide-react'
import type { SeatingTable } from '@/types'

function TableChip({ table }: { table: SeatingTable }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `floor-table-${table.id}`,
    data: { type: 'floor-table', tableId: table.id },
  })
  const ShapeIcon = table.shape === 'round' ? Circle : Square
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...listeners}
      {...attributes}
      className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg border text-sm select-none ${
        isDragging
          ? 'opacity-40 border-gold-300 bg-gold-50'
          : 'bg-white border-gold-200 hover:border-gold-400 hover:shadow-sm cursor-grab active:cursor-grabbing'
      }`}
    >
      <GripVertical size={12} className="text-gray-300 shrink-0" />
      <ShapeIcon size={13} className="text-gold-500 shrink-0" />
      <span className="truncate font-medium text-gray-700 flex-1">{table.name}</span>
      <span className="text-[10px] text-event-muted shrink-0">{table.capacity} seats</span>
    </div>
  )
}

interface Props {
  tables: SeatingTable[]
  placedCount: number
  totalCount: number
}

export default function FloorTableSidebar({ tables, placedCount, totalCount }: Props) {
  return (
    <aside className="w-64 shrink-0 flex flex-col bg-white border-r border-event-border overflow-hidden">
      <div className="px-4 py-3 border-b border-event-border bg-gold-50">
        <div className="flex items-center gap-2 text-xs text-event-muted">
          <LayoutGrid size={13} />
          <span><strong className="text-gray-700">{placedCount}</strong> / {totalCount} placed</span>
          <span className="ml-auto font-medium text-gold-600">{tables.length} to place</span>
        </div>
        <div className="mt-2 h-1.5 bg-gold-100 rounded-full overflow-hidden">
          <div className="h-full bg-gold-400 rounded-full transition-all" style={{ width: totalCount ? `${(placedCount / totalCount) * 100}%` : '0%' }} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {tables.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
            <LayoutGrid size={32} className="text-gold-200" />
            <p className="text-sm text-event-muted">
              {totalCount === 0 ? 'No tables yet. Configure tables first.' : 'All tables are on the floor plan.'}
            </p>
          </div>
        ) : (
          <>
            <p className="text-[11px] text-event-muted px-1 pb-1">Drag a table onto the floor plan to place it.</p>
            {tables.map((t) => <TableChip key={t.id} table={t} />)}
          </>
        )}
      </div>
    </aside>
  )
}
