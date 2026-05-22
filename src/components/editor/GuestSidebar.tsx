'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { Search, Users, Upload } from 'lucide-react'
import type { Guest } from '@/types'
import GuestItem from './GuestItem'

interface Props {
  guests: Guest[]
  totalGuests: number
  assignedCount: number
  onOpenCSVImport: () => void
}

export default function GuestSidebar({ guests, totalGuests, assignedCount, onOpenCSVImport }: Props) {
  const [search, setSearch] = useState('')

  const { setNodeRef, isOver } = useDroppable({ id: 'sidebar', data: { type: 'sidebar' } })

  const filtered = search
    ? guests.filter((g) => g.name.toLowerCase().includes(search.toLowerCase()))
    : guests

  return (
    <aside className="w-64 shrink-0 flex flex-col bg-white border-r border-event-border overflow-hidden">
      <div className="px-4 py-3 border-b border-event-border bg-gold-50">
        <div className="flex items-center gap-2 text-xs text-event-muted">
          <Users size={13} />
          <span><strong className="text-gray-700">{assignedCount}</strong> / {totalGuests} seated</span>
          <span className="ml-auto font-medium text-gold-600">{guests.length} unassigned</span>
        </div>
        <div className="mt-2 h-1.5 bg-gold-100 rounded-full overflow-hidden">
          <div className="h-full bg-gold-400 rounded-full transition-all" style={{ width: totalGuests ? `${(assignedCount / totalGuests) * 100}%` : '0%' }} />
        </div>
      </div>

      <div className="px-3 py-2 border-b border-event-border">
        <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
          <Search size={13} className="text-gray-400 shrink-0" />
          <input type="text" placeholder="Search guests…" value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 text-sm bg-transparent outline-none placeholder:text-gray-400" />
        </div>
      </div>

      <div ref={setNodeRef} className={`flex-1 overflow-y-auto p-3 space-y-1.5 transition-colors ${isOver ? 'bg-amber-50' : ''}`}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
            {guests.length === 0 ? (
              <>
                <Users size={32} className="text-gold-200" />
                <p className="text-sm text-event-muted">No guests yet. Import a CSV to get started.</p>
                <button onClick={onOpenCSVImport} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-gold-500 text-white rounded-lg hover:bg-gold-600 transition-colors">
                  <Upload size={13} />Import CSV
                </button>
              </>
            ) : (
              <p className="text-sm text-event-muted">All guests seated!</p>
            )}
          </div>
        ) : (
          filtered.map((guest) => <GuestItem key={guest.id} guest={guest} />)
        )}
      </div>

      {guests.length > 0 && (
        <div className="p-3 border-t border-event-border">
          <button onClick={onOpenCSVImport} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm border border-dashed border-gold-300 text-gold-600 rounded-lg hover:bg-gold-50 transition-colors">
            <Upload size={13} />Import more guests
          </button>
        </div>
      )}
    </aside>
  )
}
