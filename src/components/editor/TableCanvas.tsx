'use client'

import { LayoutGrid } from 'lucide-react'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import type { Guest, SeatingTable } from '@/types'
import TableCard from './TableCard'

interface Props {
  tables: SeatingTable[]
  guestMap: Map<string, Guest>
  assignmentBySeat: Map<string, string>
  onUnassign: (guestId: string) => void
  onOpenTableConfig: () => void
}

export default function TableCanvas({ tables, guestMap, assignmentBySeat, onUnassign, onOpenTableConfig }: Props) {
  if (tables.length === 0) {
    return (
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <LayoutGrid size={48} className="text-gold-200 mx-auto" />
          <h2 className="font-display text-xl font-semibold text-gray-600">No tables yet</h2>
          <p className="text-event-muted text-sm max-w-xs">Configure your tables to start building the seating arrangement.</p>
          <button onClick={onOpenTableConfig} className="px-5 py-2.5 bg-gold-500 text-white rounded-lg hover:bg-gold-600 transition-colors text-sm font-medium">
            Set up tables
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 overflow-auto p-6">
      <SortableContext items={tables.map((t) => t.id)} strategy={rectSortingStrategy}>
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {tables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              guestMap={guestMap}
              assignmentBySeat={assignmentBySeat}
              onUnassign={onUnassign}
            />
          ))}
        </div>
      </SortableContext>
    </main>
  )
}
