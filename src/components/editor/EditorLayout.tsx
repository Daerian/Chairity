'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ChairityEvent, Guest, SeatingTable, SeatAssignment, DragData, FloorLayout, FloorArea } from '@/types'
import { useIsMobile } from '@/hooks/useIsMobile'
import GuestSidebar from './GuestSidebar'
import TableCanvas from './TableCanvas'
import FloorPlanCanvas, { type FloorSaveStatus, TABLE_DIMS } from './FloorPlanCanvas'
import FloorTableSidebar from './FloorTableSidebar'
import EditorHeader from './EditorHeader'
import TableConfigModal from './TableConfigModal'
import CSVImport from './CSVImport'
import ShareModal from './ShareModal'
import { exportFloorPlanToPDF } from '@/lib/export'

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
  const [showSeatNumbers, setShowSeatNumbers] = useState(event.show_seat_numbers)
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
  const [floorAreas, setFloorAreas] = useState<FloorArea[]>(event.floor_areas ?? [])
  const [floorSaveStatus, setFloorSaveStatus] = useState<FloorSaveStatus>('idle')

  function reportSaveDone(error: unknown) {
    if (error) {
      console.error('floor plan save failed:', error)
      setFloorSaveStatus('error')
    } else {
      setFloorSaveStatus('saved')
    }
  }

  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const didInitSidebar = useRef(false)
  useEffect(() => {
    if (isMobile !== null && !didInitSidebar.current) {
      setSidebarOpen(!isMobile)
      didInitSidebar.current = true
    }
  }, [isMobile])
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
  const placedTables = useMemo(() => tables.filter((t) => t.pos_x != null && t.pos_y != null), [tables])
  const unplacedTables = useMemo(() => tables.filter((t) => t.pos_x == null || t.pos_y == null), [tables])

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
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${event.id}` },
        (payload) => {
          const row = payload.new as { floor_areas?: FloorArea[] | null; floor_layout?: FloorLayout | null }
          if (row.floor_areas != null) {
            setFloorAreas((prev) => JSON.stringify(prev) === JSON.stringify(row.floor_areas) ? prev : row.floor_areas!)
          }
          if (row.floor_layout != null) {
            setFloorLayout((prev) => JSON.stringify(prev) === JSON.stringify(row.floor_layout) ? prev : row.floor_layout!)
          }
        })
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

    // Place a table from the floor-plan sidebar onto the canvas
    if (drag.type === 'floor-table') {
      const tableId = drag.tableId
      if (!over || over.id !== 'floor-canvas' || !tableId) return
      const table = tables.find((t) => t.id === tableId)
      if (!table) return
      const pe = e.activatorEvent as PointerEvent
      const canvasRect = over.rect
      const dims = TABLE_DIMS[table.shape]
      const g = floorLayout.snap_grid
      const snapFn = (v: number) => (g > 0 ? Math.round(v / g) * g : v)
      const rawX = pe.clientX + e.delta.x - canvasRect.left - dims.w / 2
      const rawY = pe.clientY + e.delta.y - canvasRect.top - dims.h / 2
      const x = Math.max(0, Math.min(Math.max(0, floorLayout.room_width - dims.w), snapFn(rawX)))
      const y = Math.max(0, Math.min(Math.max(0, floorLayout.room_height - dims.h), snapFn(rawY)))
      await handleSaveFloorPositions([{ tableId, x, y }])
      return
    }

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

  async function handleAddGuest(name: string) {
    const { data } = await supabase.from('guests').insert({ event_id: event.id, name }).select().single()
    if (data) setGuests((prev) => [...prev, data as Guest])
  }

  async function handleDeleteGuest(guestId: string) {
    const guest = guests.find((g) => g.id === guestId)
    if (!confirm(`Remove ${guest?.name ?? 'this guest'}? This cannot be undone.`)) return
    const existing = assignmentByGuest.get(guestId)
    if (existing) {
      setAssignments((prev) => prev.filter((a) => a.guest_id !== guestId))
      await supabase.from('seat_assignments').delete().eq('id', existing.id)
    }
    setGuests((prev) => prev.filter((g) => g.id !== guestId))
    await supabase.from('guests').delete().eq('id', guestId)
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

  async function handleSaveFloorPositions(positions: { tableId: string; x: number; y: number }[]) {
    setTables((prev) => prev.map((t) => {
      const upd = positions.find((p) => p.tableId === t.id)
      return upd ? { ...t, pos_x: upd.x, pos_y: upd.y } : t
    }))
    setFloorSaveStatus('saving')
    const results = await Promise.all(
      positions.map(({ tableId, x, y }) =>
        supabase.from('seating_tables').update({ pos_x: x, pos_y: y }).eq('id', tableId)
      )
    )
    reportSaveDone(results.find((r) => r.error)?.error ?? null)
  }

  async function handleShapeChange(tableId: string, shape: 'rectangle' | 'round') {
    setTables((prev) => prev.map((t) => t.id === tableId ? { ...t, shape } : t))
    setFloorSaveStatus('saving')
    const { error } = await supabase.from('seating_tables').update({ shape }).eq('id', tableId)
    reportSaveDone(error)
  }

  async function handleUnplaceTable(tableId: string) {
    setTables((prev) => prev.map((t) => t.id === tableId ? { ...t, pos_x: null, pos_y: null } : t))
    setFloorSaveStatus('saving')
    const { error } = await supabase.from('seating_tables').update({ pos_x: null, pos_y: null }).eq('id', tableId)
    reportSaveDone(error)
  }

  async function handleFloorLayoutChange(layout: FloorLayout) {
    setFloorLayout(layout)
    setFloorSaveStatus('saving')
    const { error } = await supabase.from('events').update({ floor_layout: layout }).eq('id', event.id)
    reportSaveDone(error)
  }

  async function handleAreasChange(areas: FloorArea[]) {
    setFloorAreas(areas)
    setFloorSaveStatus('saving')
    const { error } = await supabase.from('events').update({ floor_areas: areas }).eq('id', event.id)
    reportSaveDone(error)
  }

  const activeDragGuest = activeDrag?.guestId ? guestMap.get(activeDrag.guestId) : null
  const activeDragTable = activeDrag?.type === 'table' ? tables.find((t) => t.id === activeDrag.tableId) : null
  const activeFloorTable = activeDrag?.type === 'floor-table' ? tables.find((t) => t.id === activeDrag.tableId) : null

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
        onDeleteGuest={handleDeleteGuest}
      />

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {view === 'grid' ? (
          <div className="flex flex-1 overflow-hidden">
            <div className={`transition-all duration-300 overflow-hidden shrink-0 ${sidebarOpen ? 'w-64' : 'w-0'}`}>
              <GuestSidebar
                guests={unassignedGuests}
                totalGuests={guests.length}
                assignedCount={assignments.length}
                onAddGuest={handleAddGuest}
                onDeleteGuest={handleDeleteGuest}
                onOpenCSVImport={() => setShowCSVImport(true)}
              />
            </div>
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              title={sidebarOpen ? 'Hide guest panel' : 'Show guest panel'}
              className="shrink-0 self-center -ml-px w-5 h-14 flex items-center justify-center bg-white border border-event-border border-l-0 rounded-r-md shadow-sm hover:bg-gold-50 hover:text-gold-600 text-gray-400 transition-colors z-10"
            >
              {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>
            <TableCanvas
              tables={tables}
              guestMap={guestMap}
              assignmentBySeat={assignmentBySeat}
              onUnassign={handleUnassign}
              onOpenTableConfig={() => setShowTableConfig(true)}
            />
          </div>

        ) : (
          <div className="flex flex-1 overflow-hidden">
            <div className={`transition-all duration-300 overflow-hidden shrink-0 ${sidebarOpen ? 'w-64' : 'w-0'}`}>
              <FloorTableSidebar
                tables={unplacedTables}
                placedCount={placedTables.length}
                totalCount={tables.length}
              />
            </div>
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              title={sidebarOpen ? 'Hide table list' : 'Show table list'}
              className="shrink-0 self-center -ml-px w-5 h-14 flex items-center justify-center bg-white border border-event-border border-l-0 rounded-r-md shadow-sm hover:bg-gold-50 hover:text-gold-600 text-gray-400 transition-colors z-10"
            >
              {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>
            <FloorPlanCanvas
              tables={placedTables}
              totalTableCount={tables.length}
              floorLayout={floorLayout}
              floorAreas={floorAreas}
              guestMap={guestMap}
              assignmentBySeat={assignmentBySeat}
              saveStatus={floorSaveStatus}
              onSavePositions={handleSaveFloorPositions}
              onShapeChange={handleShapeChange}
              onUnplaceTable={handleUnplaceTable}
              onFloorLayoutChange={handleFloorLayoutChange}
              onAreasChange={handleAreasChange}
              onOpenTableConfig={() => setShowTableConfig(true)}
              onExportPDF={() => exportFloorPlanToPDF({ eventName, tables: placedTables, floorLayout, floorAreas })}
            />
          </div>
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
          ) : activeFloorTable ? (
            <div className="bg-white rounded-xl border-2 border-gold-400 shadow-card px-4 py-3 pointer-events-none select-none">
              <span className="font-semibold text-sm text-gray-800">{activeFloorTable.name}</span>
              <span className="ml-2 text-xs text-event-muted">{activeFloorTable.capacity} seats</span>
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
          showSeatNumbers={showSeatNumbers}
          onClose={() => setShowShare(false)}
          onTokenRegenerated={setInviteToken}
          onShowSeatNumbersChange={setShowSeatNumbers}
        />
      )}
    </div>
  )
}
