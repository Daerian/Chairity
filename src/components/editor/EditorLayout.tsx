'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { createClient } from '@/lib/supabase/client'
import type { ChairityEvent, Guest, SeatingTable, SeatAssignment, DragData } from '@/types'
import GuestSidebar from './GuestSidebar'
import TableCanvas from './TableCanvas'
import EditorHeader from './EditorHeader'
import TableConfigModal from './TableConfigModal'
import CSVImport from './CSVImport'

interface Props {
  event: ChairityEvent
  initialGuests: Guest[]
  initialTables: SeatingTable[]
  initialAssignments: SeatAssignment[]
}

export default function EditorLayout({ event, initialGuests, initialTables, initialAssignments }: Props) {
  const supabase = createClient()

  const [eventName, setEventName] = useState(event.name)
  const [guests, setGuests] = useState<Guest[]>(initialGuests)
  const [tables, setTables] = useState<SeatingTable[]>(initialTables)
  const [assignments, setAssignments] = useState<SeatAssignment[]>(initialAssignments)
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null)
  const [showTableConfig, setShowTableConfig] = useState(false)
  const [showCSVImport, setShowCSVImport] = useState(false)
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const guestMap = useMemo(() => new Map(guests.map((g) => [g.id, g])), [guests])
  const assignmentByGuest = useMemo(() => new Map(assignments.map((a) => [a.guest_id, a])), [assignments])
  const assignmentBySeat = useMemo(
    () => new Map(assignments.map((a) => [`${a.table_id}::${a.seat_number}`, a.guest_id])),
    [assignments]
  )

  const unassignedGuests = useMemo(
    () => guests.filter((g) => !assignmentByGuest.has(g.id)),
    [guests, assignmentByGuest]
  )

  async function refetchAssignments() {
    const tableIds = tables.map((t) => t.id)
    if (tableIds.length === 0) return
    const { data } = await supabase.from('seat_assignments').select('*').in('table_id', tableIds)
    if (data) setAssignments(data as SeatAssignment[])
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveDrag(e.active.data.current as DragData)
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveDrag(null)
    const { active, over } = e
    if (!over) return

    const drag = active.data.current as DragData
    const drop = over.data.current as { type: string; tableId?: string; seatNumber?: number }
    if (!drag || !drop) return

    const guestId = drag.guestId

    if (drop.type === 'sidebar') {
      // Unassign: remove from seat
      const existing = assignmentByGuest.get(guestId)
      if (!existing) return
      setAssignments((prev) => prev.filter((a) => a.guest_id !== guestId))
      await supabase.from('seat_assignments').delete().eq('id', existing.id)
      return
    }

    if (drop.type !== 'seat' || !drop.tableId || drop.seatNumber == null) return

    const { tableId: toTableId, seatNumber: toSeat } = drop

    // No-op: dropped on own seat
    if (drag.type === 'seated' && drag.tableId === toTableId && drag.seatNumber === toSeat) return

    const targetGuestId = assignmentBySeat.get(`${toTableId}::${toSeat}`)
    const fromAssignment = assignmentByGuest.get(guestId)

    // Build the new assignments array optimistically
    setAssignments((prev) => {
      let next = prev.filter(
        (a) => a.guest_id !== guestId && !(a.table_id === toTableId && a.seat_number === toSeat)
      )
      next = [
        ...next,
        { id: 'opt-' + guestId, table_id: toTableId, guest_id: guestId, seat_number: toSeat, created_at: '' },
      ]
      // Swap: put the displaced guest in the source seat
      if (targetGuestId && drag.type === 'seated' && drag.tableId && drag.seatNumber != null) {
        next = next.filter((a) => a.guest_id !== targetGuestId)
        next = [
          ...next,
          { id: 'opt-' + targetGuestId, table_id: drag.tableId!, guest_id: targetGuestId, seat_number: drag.seatNumber!, created_at: '' },
        ]
      }
      return next
    })

    // Persist
    const persist = async () => {
      if (fromAssignment) {
        await supabase
          .from('seat_assignments')
          .update({ table_id: toTableId, seat_number: toSeat })
          .eq('id', fromAssignment.id)
      } else {
        await supabase
          .from('seat_assignments')
          .insert({ event_id: event.id, table_id: toTableId, guest_id: guestId, seat_number: toSeat })
      }

      if (targetGuestId && drag.type === 'seated' && drag.tableId && drag.seatNumber != null) {
        const targetAssignment = assignmentByGuest.get(targetGuestId)
        if (targetAssignment) {
          await supabase
            .from('seat_assignments')
            .update({ table_id: drag.tableId!, seat_number: drag.seatNumber! })
            .eq('id', targetAssignment.id)
        }
      } else if (targetGuestId) {
        const targetAssignment = assignmentByGuest.get(targetGuestId)
        if (targetAssignment) {
          await supabase.from('seat_assignments').delete().eq('id', targetAssignment.id)
        }
      }
    }

    await persist()
    await refetchAssignments()
  }

  async function handleUnassign(guestId: string) {
    const existing = assignmentByGuest.get(guestId)
    if (!existing) return
    setAssignments((prev) => prev.filter((a) => a.guest_id !== guestId))
    await supabase.from('seat_assignments').delete().eq('id', existing.id)
  }

  // Listen for dropdown-based assignments from SeatSlot
  useEffect(() => {
    async function onAssignEvent(e: Event) {
      const { guestId, tableId, seatNumber } = (e as CustomEvent).detail as {
        guestId: string; tableId: string; seatNumber: number
      }
      const existing = assignmentByGuest.get(guestId)
      setAssignments((prev) => [
        ...prev.filter((a) => a.guest_id !== guestId && !(a.table_id === tableId && a.seat_number === seatNumber)),
        { id: 'opt-' + guestId, table_id: tableId, guest_id: guestId, seat_number: seatNumber, created_at: '' },
      ])
      if (existing) {
        await supabase.from('seat_assignments').update({ table_id: tableId, seat_number: seatNumber }).eq('id', existing.id)
      } else {
        await supabase.from('seat_assignments').insert({ event_id: event.id, table_id: tableId, guest_id: guestId, seat_number: seatNumber })
      }
      await refetchAssignments()
    }
    document.addEventListener('chairity:assign', onAssignEvent)
    return () => document.removeEventListener('chairity:assign', onAssignEvent)
  })

  async function handleRenameEvent(name: string) {
    setEventName(name)
    setSaving(true)
    await supabase.from('events').update({ name, updated_at: new Date().toISOString() }).eq('id', event.id)
    setSaving(false)
  }

  async function handleGuestsImported(newGuests: Guest[]) {
    setGuests((prev) => [...prev, ...newGuests])
    setShowCSVImport(false)
  }

  function handleTablesUpdated(updated: SeatingTable[]) {
    setTables(updated)
    setShowTableConfig(false)
    refetchAssignments()
  }

  const activeDragGuest = activeDrag ? guestMap.get(activeDrag.guestId) : null

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-event-bg">
      <EditorHeader
        eventName={eventName}
        saving={saving}
        tables={tables}
        guests={guests}
        assignments={assignments}
        onRename={handleRenameEvent}
        onOpenTableConfig={() => setShowTableConfig(true)}
        onOpenCSVImport={() => setShowCSVImport(true)}
      />

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex flex-1 overflow-hidden">
          <GuestSidebar
            guests={unassignedGuests}
            totalGuests={guests.length}
            assignedCount={assignments.length}
            onOpenCSVImport={() => setShowCSVImport(true)}
          />
          <TableCanvas
            tables={tables}
            guestMap={guestMap}
            assignmentBySeat={assignmentBySeat}
            onUnassign={handleUnassign}
            onOpenTableConfig={() => setShowTableConfig(true)}
          />
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDragGuest ? (
            <div className="px-3 py-2 bg-white rounded-lg border-2 border-gold-400 shadow-card text-sm font-medium text-gray-800 pointer-events-none select-none">
              {activeDragGuest.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {showTableConfig && (
        <TableConfigModal
          eventId={event.id}
          tables={tables}
          onClose={() => setShowTableConfig(false)}
          onSave={handleTablesUpdated}
        />
      )}

      {showCSVImport && (
        <CSVImport
          eventId={event.id}
          existingNames={new Set(guests.map((g) => g.name.toLowerCase()))}
          onClose={() => setShowCSVImport(false)}
          onImport={handleGuestsImported}
        />
      )}
    </div>
  )
}
