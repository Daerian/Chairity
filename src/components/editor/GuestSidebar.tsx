'use client'

import { useState, useRef } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { Search, Users, Upload, Plus } from 'lucide-react'
import type { Guest } from '@/types'
import GuestItem from './GuestItem'

interface Props {
  guests: Guest[]
  totalGuests: number
  assignedCount: number
  onAddGuest: (name: string) => Promise<void>
  onDeleteGuest: (guestId: string) => void
  onOpenCSVImport: () => void
}

export default function GuestSidebar({ guests, totalGuests, assignedCount, onAddGuest, onDeleteGuest, onOpenCSVImport }: Props) {
  const [search, setSearch] = useState('')
  const [addName, setAddName] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleAdd() {
    const name = addName.trim()
    if (!name) return
    setIsAdding(true)
    await onAddGuest(name)
    setAddName('')
    setIsAdding(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleAdd()
  }

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
                <p className="text-sm text-event-muted">No guests yet. Type a name below or import a CSV.</p>
              </>
            ) : (
              <p className="text-sm text-event-muted">All guests seated!</p>
            )}
          </div>
        ) : (
          filtered.map((guest) => <GuestItem key={guest.id} guest={guest} onDelete={onDeleteGuest} />)
        )}
      </div>

      <div className="p-3 border-t border-event-border space-y-2">
        <div className="flex gap-1.5">
          <input
            ref={inputRef}
            type="text"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a guest…"
            disabled={isAdding}
            className="flex-1 min-w-0 px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-gold-400 placeholder:text-gray-400 disabled:opacity-50"
          />
          <button
            onClick={handleAdd}
            disabled={!addName.trim() || isAdding}
            className="flex items-center gap-1 px-2.5 py-1.5 text-sm bg-gold-500 text-white rounded-lg hover:bg-gold-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={14} />
          </button>
        </div>
        <button onClick={onOpenCSVImport} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm border border-dashed border-gold-300 text-gold-600 rounded-lg hover:bg-gold-50 transition-colors">
          <Upload size={13} />Import CSV
        </button>
      </div>
    </aside>
  )
}
