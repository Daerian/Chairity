'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Pencil, Check, X } from 'lucide-react'
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
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(table.name)
  const [displayName, setDisplayName] = useState(table.name)

  const occupancy = Array.from({ length: table.capacity }, (_, i) => i + 1)
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

  return (
    <div className="bg-white rounded-xl border border-event-border shadow-card hover:shadow-card-hover transition-shadow flex flex-col">
      {/* Table header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-event-border bg-gold-50 rounded-t-xl">
        {editingName ? (
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setNameDraft(displayName); setEditingName(false) } }}
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
        <span className="text-xs text-event-muted shrink-0 ml-1">{occupancy}/{table.capacity}</span>
      </div>

      {/* Seats grid */}
      <div className="p-3 grid gap-1.5" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {Array.from({ length: table.capacity }, (_, i) => i + 1).map((seatNum) => {
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
