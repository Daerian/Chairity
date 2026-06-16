'use client'

import { useState, useMemo } from 'react'
import { Search, X } from 'lucide-react'
import type { Guest, SeatingTable, SeatAssignment } from '@/types'
import { getGroupColor } from '@/lib/groups'

interface Props {
  event: { id: string; name: string; event_date: string | null }
  guests: Guest[]
  tables: SeatingTable[]
  assignments: SeatAssignment[]
  /** True when rendered inside EditorLayout — removes the page header and uses an internal scroll container */
  embedded?: boolean
}

export default function EventViewer({ event, guests, tables, assignments, embedded = false }: Props) {
  const [search, setSearch] = useState('')

  const guestMap = useMemo(() => new Map(guests.map((g) => [g.id, g])), [guests])
  const tableMap = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables])
  const assignmentByGuest = useMemo(() => new Map(assignments.map((a) => [a.guest_id, a])), [assignments])

  const guestsByTable = useMemo(() => {
    const map = new Map<string, { guest: Guest; seatNumber: number }[]>()
    for (const table of tables) map.set(table.id, [])
    for (const a of assignments) {
      const guest = guestMap.get(a.guest_id)
      if (guest) {
        const list = map.get(a.table_id) ?? []
        list.push({ guest, seatNumber: a.seat_number })
        map.set(a.table_id, list)
      }
    }
    for (const [, list] of map) list.sort((a, b) => a.guest.name.localeCompare(b.guest.name))
    return map
  }, [tables, assignments, guestMap])

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return guests
      .filter((g) => g.name.toLowerCase().includes(q))
      .map((g) => {
        const assignment = assignmentByGuest.get(g.id)
        const table = assignment ? tableMap.get(assignment.table_id) : null
        return { guest: g, table: table ?? null, seatNumber: assignment?.seat_number ?? null }
      })
      .sort((a, b) => a.guest.name.localeCompare(b.guest.name))
  }, [guests, search, assignmentByGuest, tableMap])

  const isSearching = search.trim().length > 0
  const seatedTables = tables.filter((t) => (guestsByTable.get(t.id) ?? []).length > 0)

  // Sticky search bar — rendered identically in both modes, sticks to whatever
  // the nearest scroll ancestor is (viewport for standalone, overflow-y-auto div for embedded).
  const searchBar = (
    <div className="sticky top-0 z-10 bg-event-bg/95 backdrop-blur-sm px-4 py-3 border-b border-event-border/40">
      <label className="flex items-center gap-3 px-4 py-3 bg-white rounded-2xl border border-event-border shadow-sm focus-within:border-gold-400 transition-colors">
        <Search size={18} className="text-gold-500 shrink-0" />
        <input
          type="text"
          inputMode="search"
          placeholder="Search your name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 text-base bg-transparent outline-none placeholder:text-gray-400 text-gray-800"
        />
        {search && (
          <button onClick={() => setSearch('')} className="p-1 -mr-1 text-gray-400 active:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        )}
      </label>
    </div>
  )

  const content = (
    <div className="px-4 pt-4 pb-safe">
      {isSearching ? (
        <>
          {searchResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Search size={36} className="text-gold-200 mb-3" />
              <p className="text-gray-600 font-medium">No one found</p>
              <p className="text-sm text-event-muted mt-1">Try a different spelling</p>
            </div>
          ) : (
            <div className="space-y-3">
              {searchResults.map(({ guest, table, seatNumber }) => (
                <div key={guest.id} className="bg-white rounded-2xl border border-event-border shadow-sm overflow-hidden">
                  <div className="px-4 pt-4 pb-3 flex items-center gap-2">
                    {guest.group_name && (
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: getGroupColor(guest.group_name) }} />
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 text-base leading-tight">{guest.name}</p>
                      {guest.group_name && <p className="text-xs text-event-muted mt-0.5">{guest.group_name}</p>}
                    </div>
                  </div>
                  {table ? (
                    <div className="bg-gold-50 border-t border-gold-100 px-4 py-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-gold-500 mb-0.5">Your table</p>
                        <p className="font-display font-bold text-2xl text-gold-700 leading-none">{table.name}</p>
                      </div>
                      {seatNumber != null && (
                        <div className="text-right shrink-0">
                          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">Seat</p>
                          <p className="font-bold text-2xl text-gray-700 leading-none">{seatNumber}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-gray-50 border-t border-gray-100 px-4 py-3">
                      <p className="text-sm text-gray-500">Not yet assigned to a table</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-event-muted px-1 mb-1">
            {seatedTables.length} table{seatedTables.length !== 1 ? 's' : ''} · {assignments.length} guests seated
          </p>
          {seatedTables.map((table) => {
            const tableGuests = guestsByTable.get(table.id) ?? []
            return (
              <div key={table.id} className="bg-white rounded-2xl border border-event-border overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-gold-50 border-b border-gold-100 flex items-center justify-between">
                  <h2 className="font-display font-semibold text-gray-800">{table.name}</h2>
                  <span className="text-xs text-event-muted">{tableGuests.length} guests</span>
                </div>
                <ul>
                  {tableGuests.map(({ guest, seatNumber }, i) => (
                    <li key={guest.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-event-border' : ''}`}>
                      {guest.group_name && (
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: getGroupColor(guest.group_name) }} />
                      )}
                      <span className="flex-1 text-sm text-gray-700">{guest.name}</span>
                      <span className="text-xs text-event-muted shrink-0">Seat {seatNumber}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  // ─── Embedded mode ─────────────────────────────────────────────────────────
  // Fills the parent flex container. Sticky search sticks within the scroll div.
  if (embedded) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden bg-event-bg">
        <div className="flex-1 overflow-y-auto">
          {searchBar}
          {content}
        </div>
      </div>
    )
  }

  // ─── Standalone page mode ──────────────────────────────────────────────────
  // Page scrolls naturally; sticky search sticks to the viewport.
  return (
    <div className="min-h-screen bg-event-bg">
      <div className="bg-white border-b border-event-border shrink-0">
        <div className="px-5 pt-4 pb-4">
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-[10px]">C</span>
            </div>
            <span className="text-xs text-event-muted">Chairity</span>
          </div>
          <h1 className="font-display text-xl font-bold text-gray-800 leading-tight">{event.name}</h1>
          {event.event_date && (
            <p className="mt-0.5 text-sm text-event-muted">
              {new Date(event.event_date).toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric',
              })}
            </p>
          )}
        </div>
      </div>
      {searchBar}
      {content}
    </div>
  )
}
