'use client'

import { useState, useMemo } from 'react'
import { Search, Users, Calendar, X } from 'lucide-react'
import type { Guest, SeatingTable, SeatAssignment } from '@/types'
import { getGroupColor } from '@/lib/groups'

interface Props {
  event: { id: string; name: string; event_date: string | null }
  guests: Guest[]
  tables: SeatingTable[]
  assignments: SeatAssignment[]
}

export default function EventViewer({ event, guests, tables, assignments }: Props) {
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

  return (
    <div className="min-h-screen bg-event-bg">
      {/* Header */}
      <div className="bg-white border-b border-event-border shadow-sm">
        <div className="max-w-2xl mx-auto px-5 py-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">C</span>
            </div>
            <span className="text-xs text-event-muted font-medium">Chairity</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-gray-800">{event.name}</h1>
          {event.event_date && (
            <p className="mt-1 text-sm text-event-muted flex items-center gap-1.5">
              <Calendar size={13} />
              {new Date(event.event_date).toLocaleDateString('en-US', { dateStyle: 'long' })}
            </p>
          )}
          <p className="mt-1 text-xs text-event-muted flex items-center gap-1.5">
            <Users size={12} />
            {assignments.length} guests seated across {tables.length} tables
          </p>
        </div>
      </div>

      {/* Sticky search */}
      <div className="sticky top-0 z-10 bg-event-bg border-b border-event-border/60 px-5 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 px-4 py-2.5 bg-white rounded-xl border border-event-border shadow-sm focus-within:border-gold-400 transition-colors">
            <Search size={16} className="text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Search your name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="flex-1 text-base bg-transparent outline-none placeholder:text-gray-400"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-5 py-5 pb-12">
        {isSearching ? (
          <div>
            {searchResults.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-event-muted text-sm">No guests found matching &ldquo;{search}&rdquo;</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-event-muted mb-3">
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                </p>
                {searchResults.map(({ guest, table, seatNumber }) => (
                  <div key={guest.id} className="bg-white rounded-xl border border-event-border p-4 flex items-center gap-3 shadow-sm">
                    {guest.group_name && (
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: getGroupColor(guest.group_name) }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800">{guest.name}</p>
                      {table ? (
                        <p className="text-sm text-event-muted mt-0.5">
                          {seatNumber != null && `Seat ${seatNumber}`}
                        </p>
                      ) : (
                        <p className="text-sm text-event-muted mt-0.5">Not yet assigned</p>
                      )}
                    </div>
                    {table ? (
                      <span className="shrink-0 text-sm font-bold text-gold-700 bg-gold-50 border border-gold-200 px-3 py-1.5 rounded-lg">
                        {table.name}
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">
                        Unassigned
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {tables.map((table) => {
              const tableGuests = guestsByTable.get(table.id) ?? []
              return (
                <div key={table.id} className="bg-white rounded-xl border border-event-border overflow-hidden shadow-sm">
                  <div className="px-4 py-3 bg-gold-50 border-b border-gold-100 flex items-center justify-between">
                    <h2 className="font-display font-semibold text-gray-800">{table.name}</h2>
                    <span className="text-xs text-event-muted">
                      {tableGuests.length}/{table.capacity} seated
                    </span>
                  </div>
                  {tableGuests.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-event-muted italic">No guests assigned yet</p>
                  ) : (
                    <ul className="divide-y divide-event-border">
                      {tableGuests.map(({ guest, seatNumber }) => (
                        <li key={guest.id} className="flex items-center gap-2.5 px-4 py-2.5">
                          {guest.group_name && (
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ background: getGroupColor(guest.group_name) }}
                            />
                          )}
                          <span className="flex-1 text-sm text-gray-700">{guest.name}</span>
                          <span className="text-xs text-event-muted">Seat {seatNumber}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
