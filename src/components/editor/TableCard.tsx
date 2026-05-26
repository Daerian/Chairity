'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createClient } from '@/lib/supabase/client'
import { Pencil, Check, X, GripVertical } from 'lucide-react'
import type { Guest, SeatingTable } from '@/types'
import SeatSlot from './SeatSlot'

interface Props {
  table: SeatingTable
  guestMap: Map<string, Guest>
  assignmentBySeat: Map<string, string>
  onUnassign: (guestId: string) => void
}

export default function TableCard({ table, guestMap, assignmentBySeat, onUnassign }: Props) {
  const supabase = createClient()

  // Name editing
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(table.name)
  const [displayName, setDisplayName] = useState(table.name)

  // Capacity editing
  const [editingCapacity, setEditingCapacity] = useState(false)
  const [capacityDraft, setCapacityDraft] = useState(table.capacity)
  const [displayCapacity, setDisplayCapacity] = useState(table.capacity)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: table.id,
    data: { type: 'table', tableId: table.id },
  })

  const occupancy = Array.from({ length: displayCapacity }, (_, i) => i + 1)
    .filter((s) => assignmentBySeat.has(`${table.id}::${s}`)).length

  async function commitName() {
    const trimmed = nameDraft.trim()
    if (trimmed && trimmed !== displayName) {
      setDisplayName(trimmed)
      await supabase.from('seating_tables').update({ name: trimmed }).eq('id', table.id)
    } else {
      setNameDraft(displayName)
    }
    setEditingName(false)
  }

  async function commitCapacity() {
    const newCap = Math.max(1, Math.min(50, capacityDraft))
    if (newCap === displayCapacity) { setEditingCapacity(false); return }

    const toRemove: string[] = []
    for (let s = newCap + 1; s <= displayCapacity; s++) {
      const guestId = assignmentBySeat.get(`${table.id}::${s}`)
      if (guestId) toRemove.push(guestId)
    }

    if (toRemove.length > 0) {
      const ok = window.confirm(
        `Reducing capacity will unassign ${toRemove.length} guest${toRemove.length > 1 ? 's' : ''}. Continue?`
      )
      if (!ok) { setCapacityDraft(displayCapacity); setEditingCapacity(false); return }
      toRemove.forEach((guestId) => onUnassign(guestId))
    }

    setDisplayCapacity(newCap)
    setEditingCapacity(false)
    await supabase.from('seating_tables').update({ capacity: newCap }).eq('id', table.id)
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : undefined }}
      className="bg-white rounded-xl border border-event-border shadow-card hover:shadow-card-hover transition-shadow flex flex-col"
    >
      <div className="flex items-center gap-1.5 px-2 py-2.5 border-b border-event-border bg-gold-50 rounded-t-xl">
        {/* Drag handle */}
        <button
          {...listeners}
          {...attributes}
          className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0 touch-none"
          tabIndex={-1}
        >
          <GripVertical size={13} />
        </button>

        {editingName ? (
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitName()
                if (e.key === 'Escape') { setNameDraft(displayName); setEditingName(false) }
              }}
              className="flex-1 min-w-0 text-sm font-semibold bg-white border border-gold-300 rounded px-1.5 py-0.5 outline-none"
            />
            <button onClick={commitName} className="text-green-500 hover:text-green-600"><Check size={13} /></button>
            <button onClick={() => { setNameDraft(displayName); setEditingName(false) }} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>
          </div>
        ) : (
          <>
            <span className="font-semibold text-sm text-gray-800 truncate flex-1">{displayName}</span>
            <button onClick={() => setEditingName(true)} className="text-gray-400 hover:text-gold-600 transition-colors shrink-0">
              <Pencil size={12} />
            </button>
          </>
        )}

        {/* Capacity badge — click to edit */}
        {editingCapacity ? (
          <input
            autoFocus
            type="number"
            min={1}
            max={50}
            value={capacityDraft}
            onChange={(e) => setCapacityDraft(Math.max(1, parseInt(e.target.value) || 1))}
            onBlur={commitCapacity}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitCapacity()
              if (e.key === 'Escape') { setCapacityDraft(displayCapacity); setEditingCapacity(false) }
            }}
            className="w-12 text-xs text-center bg-white border border-gold-300 rounded px-1 py-0.5 outline-none shrink-0 ml-1"
          />
        ) : (
          <button
            onClick={() => { setCapacityDraft(displayCapacity); setEditingCapacity(true) }}
            className="text-xs text-event-muted shrink-0 ml-1 hover:text-gold-600 transition-colors"
            title="Click to change capacity"
          >
            {occupancy}/{displayCapacity}
          </button>
        )}
      </div>

      <div className="p-3 grid gap-1.5 overflow-hidden" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        {Array.from({ length: displayCapacity }, (_, i) => i + 1).map((seatNum) => {
          const guestId = assignmentBySeat.get(`${table.id}::${seatNum}`)
          const guest = guestId ? guestMap.get(guestId) ?? null : null
          return (
            <SeatSlot
              key={seatNum}
              tableId={table.id}
              seatNumber={seatNum}
              assignedGuest={guest}
              guestMap={guestMap}
              assignmentBySeat={assignmentBySeat}
              onUnassign={() => guestId && onUnassign(guestId)}
            />
          )
        })}
      </div>
    </div>
  )
}
