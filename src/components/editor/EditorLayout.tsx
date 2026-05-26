'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { createClient } from '@/lib/supabase/client'
import type { ChairityEvent, Guest, SeatingTable, SeatAssignment, DragData, FloorLayout } from '@/types'
import GuestSidebar from './GuestSidebar'
import TableCanvas from './TableCanvas'
import FloorPlanCanvas from './FloorPlanCanvas'
import EditorHeader from './EditorHeader'
import TableConfigModal from './TableConfigModal'
import CSVImport from './CSVImport'
import ShareModal from './ShareModal'

interface Props {
  event: ChairityEvent
  initialGuests: Guest[]
  initialTables: SeatingTable[]
  initialAssignments: SeatAssignment[]
  isOwner: boolean
}

export default function EditorLayout({ event, initialGuests, initialTables, initialAssignments, isOwner }: Props) {
  const supabase = createClient()

  const [eventName, setEventName] = useState(event.name)
  const [inviteToken, setInviteToken] = useState(event.invite_token)
  const [guests, setGuests] = useState<Guest[]>(initialGuests)
  const [tables, setTables] = useState<SeatingTable[]>(initialTables)
  const [assignments, setAssignments] = useState<SeatAssignment[]>(initialAssignments)
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null)
  const [showTableConfig, setShowTableConfig] = useState(false)
  const [showCSVImport, setShowCSVImport] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'grid' | 'floor'>('grid')
  const [floorLayout, setFloorLayout] = useState<FloorLayout>(
    event.floor_layout ?? { room_width: 1200, room_height: 800, snap_grid: 40 }
  )

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

  const tablesRef = useRef(tables)
  useEffect(() => { tablesRef.current = tables }, [tables])

  async function refetchAssignments() {
    const tableIds = tablesRef.current.map((t) => t.id)
    if (!tableIds.length) return
    const { data } = await supabase.from('seat_assignments').select('*').in('table_id', tableIds)
    if (data) setAssignments(data as SeatAssignment[])
  }

  async function refetchGuests() {
    const { data } = await supabase.from('guests').select('*').eq('event_id', event.id).order('name')
    if (data) setGuests(data as Guest[])
  }

  async function refetchTables() {
    const { data } = await supabase.from('seating_tables').select('*').eq('event_id', event.id).order('sort_order')
    if (data) setTables(data as SeatingTable[])
  }

  useEffect(() => {
    const channel = supabase
      .channel(`event:${event.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seat_assignments' },
        () => refetchAssignments())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guests', filter: `event_id=eq.${event.id}` },
        () => refetchGuests())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seating_tables', filter: `event_id=eq.${event.id}` },
        () => refetchTables())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [event.id])

  useEffect(() => {
    async function onAssign(e: Event) {
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
        await supabase.from('seat_assignments').insert({ table_id: tableId, guest_id: guestId, seat_number: seatNumber })
      }
      await refetchAssignments()
    }
    document.addEventListener('chairity:assign', onAssign)
    return () => document.removeEventListener('chairity:assign', onAssign)
  })

  function handleDragStart(e: DragStartEvent) {
    setActiveDrag(e.active.data.current as DragData)
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveDrag(null)
    const { active, over } = e

    const drag = active.data.current as DragData
    if (!drag) return

    // Table reorder via drag handle
    if (drag.type === 'table') {
      if (!over || active.id === over.id) return
      const oldIdx = tables.findIndex((t) => t.id === active.id)
      const newIdx = tables.findIndex((t) => t.id === over.id)
      if (oldIdx === -1 || newIdx === -1) return
      const reordered = arrayMove(tables, oldIdx, newIdx).map((t, i) => ({ ...t, sort_order: i }))
      setTables(reordered)
      for (const t of reordered) {
        await supabase.from('seating_tables').update({ sort_order: t.sort_order }).eq('id', t.id)
      }
      return
    }

    // Guest assignment
    if (!over) return
    const guestId = drag.guestId
    if (!guestId) return

    const drop = over.data.current as { type: string; tableId?: string; seatNumber?: number }
    if (!drop) return

    if (drop.type === 'sidebar') {
      const existing = assignmentByGuest.get(guestId)
      if (!existing) return
      setAssignments((prev) => prev.filter((a) => a.guest_id !== guestId))
      await supabase.from('seat_assignments').delete().eq('id', existing.id)
      return
    }

    if (drop.type !== 'seat' || !drop.tableId || drop.seatNumber == null) return

    const { tableId: toTableId, seatNumber: toSeat } = drop
    if (drag.type === 'seated' && drag.tableId === toTableId && drag.seatNumber === toSeat) return

    const targetGuestId = assignmentBySeat.get(`${toTableId}::${toSeat}`)
    const fromAssignment = assignmentByGuest.get(guestId)

    setAssignments((prev) => {
      let next = prev.filter(
        (a) => a.guest_id !== guestId && !(a.table_id === toTableId && a.seat_number === toSeat)
      )
      next = [...next, { id: 'opt-' + guestId, table_id: toTableId, guest_id: guestId, seat_number: toSeat, created_at: '' }]
      if (targetGuestId && drag.type === 'seated' && drag.tableId && drag.seatNumber != null) {
        next = next.filter((a) => a.guest_id !== targetGuestId)
        next = [...next, { id: 'opt-' + targetGuestId, table_id: drag.tableId!, guest_id: targetGuestId, seat_number: drag.seatNumber!, created_at: '' }]
      }
      return next
    })

    const persist = async () => {
      if (fromAssignment) {
        await supabase.from('seat_assignments').update({ table_id: toTableId, seat_number: toSeat }).eq('id', fromAssignment.id)
      } else {
        await supabase.from('seat_assignments').insert({ table_id: toTableId, guest_id: guestId, seat_number: toSeat })
      }
      if (targetGuestId && drag.type === 'seated' && drag.tableId && drag.seatNumber != null) {
        const targetAssignment = assignmentByGuest.get(targetGuestId)
        if (targetAssignment) {
          await supabase.from('seat_assignments').update({ table_id: drag.tableId!, seat_number: drag.seatNumber! }).eq('id', targetAssignment.id)
        }
      } else if (targetGuestId) {
        const targetAssignment = assignmentByGuest.get(targetGuestId)
        if (targetAssignment) await supabase.from('seat_assignments').delete().eq('id', targetAssignment.id)
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

  async function handleRenameEvent(name: string) {
    setEventName(name)
    setSaving(true)
    await supabase.from('events').update({ name, updated_at: new Date().toISOString() }).eq('id', event.id)
    setSaving(false)
  }

  function handleGuestsImported(newGuests: Guest[]) {
    setGuests((prev) => [...prev, ...newGuests])
    setShowCSVImport(false)
  }

  function handleTablesUpdated(updated: SeatingTable[]) {
    setTables(updated)
    setShowTableConfig(false)
    refetchAssignments()
  }

  async function handleFloorPositionChange(tableId: string, x: number, y: number) {
    setTables((prev) => prev.map((t) => t.id === tableId ? { ...t, pos_x: x, pos_y: y } : t))
    await supabase.from('seating_tables').update({ pos_x: x, pos_y: y }).eq('id', tableId)
  }

  async function handleShapeChange(tableId: string, shape: 'rectangle' | 'round') {
    setTables((prev) => prev.map((t) => t.id === tableId ? { ...t, shape } : t))
    await supabase.from('seating_tables').update({ shape }).eq('id', tableId)
  }

  async function handleFloorLayoutChange(layout: FloorLayout) {
    setFloorLayout(layout)
    await supabase.from('events').update({ floor_layout: layout }).eq('id', event.id)
  }

  const activeDragGuest = activeDrag?.guestId ? guestMap.get(activeDrag.guestId) : null
  const activeDragTable = activeDrag?.type === 'table' ? tables.find((t) => t.id === activeDrag.tableId) : null

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-event-bg">
      <EditorHeader
        eventName={eventName}
        saving={saving}
        tables={tables}
        guests={guests}
        assignments={assignments}
        isOwner={isOwner}
        view={view}
        onViewChange={setView}
        onRename={handleRenameEvent}
        onOpenTableConfig={() => setShowTableConfig(true)}
        onOpenCSVImport={() => setShowCSVImport(true)}
        onOpenShare={() => setShowShare(true)}
      />

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {view === 'grid' ? (
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
        ) : (
          <FloorPlanCanvas
            tables={tables}
            floorLayout={floorLayout}
            guestMap={guestMap}
            assignmentBySeat={assignmentBySeat}
            onPositionChange={handleFloorPositionChange}
            onShapeChange={handleShapeChange}
            onFloorLayoutChange={handleFloorLayoutChange}
            onOpenTableConfig={() => setShowTableConfig(true)}
          />
        )}

        <DragOverlay dropAnimation={null}>
          {activeDragGuest ? (
            <div className="px-3 py-2 bg-white rounded-lg border-2 border-gold-400 shadow-card text-sm font-medium text-gray-800 pointer-events-none select-none">
              {activeDragGuest.name}
            </div>
          ) : activeDragTable ? (
            <div className="bg-white rounded-xl border-2 border-gold-400 shadow-card px-4 py-3 pointer-events-none select-none">
              <span className="font-semibold text-sm text-gray-800">{activeDragTable.name}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {showTableConfig && (
        <TableConfigModal eventId={event.id} tables={tables} onClose={() => setShowTableConfig(false)} onSave={handleTablesUpdated} />
      )}
      {showCSVImport && (
        <CSVImport eventId={event.id} existingNames={new Set(guests.map((g) => g.name.toLowerCase()))} onClose={() => setShowCSVImport(false)} onImport={handleGuestsImported} />
      )}
      {showShare && isOwner && (
        <ShareModal
          eventId={event.id}
          inviteToken={inviteToken}
          onClose={() => setShowShare(false)}
          onTokenRegenerated={setInviteToken}
        />
      )}
    </div>
  )
}
