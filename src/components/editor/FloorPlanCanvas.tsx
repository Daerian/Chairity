'use client'

import { useState, useRef, useEffect } from 'react'
import { useDroppable } from '@dnd-kit/core'
import {
  Settings, Circle, Square, Printer, Plus, Check, AlertTriangle, Loader2, Trash2, Copy, Eraser, X, Download,
} from 'lucide-react'
import type { Guest, SeatingTable, FloorLayout, FloorArea, FloorAreaType } from '@/types'
import { AREA_PRESETS, AREA_TYPE_LIST, newArea } from '@/lib/floorAreas'

const RECT_W = 160
const RECT_H = 110
const ROUND_SIZE = 130
const MIN_AREA = 40

/** Footprint of a table by shape — shared with EditorLayout's drop placement math. */
export const TABLE_DIMS = {
  rectangle: { w: RECT_W, h: RECT_H },
  round: { w: ROUND_SIZE, h: ROUND_SIZE },
} as const

export type FloorSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface FloorPos { x: number; y: number }
interface Rect { x: number; y: number; w: number; h: number }

function defaultPos(index: number): FloorPos {
  const cols = 5
  return {
    x: 40 + (index % cols) * (RECT_W + 30),
    y: 40 + Math.floor(index / cols) * (RECT_H + 30),
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(Math.max(min, max), v))
}

type Drag =
  | { type: 'table'; id: string; offX: number; offY: number }
  | { type: 'areaMove'; id: string; offX: number; offY: number }
  | { type: 'areaResize'; id: string; px: number; py: number; w0: number; h0: number }

interface Props {
  tables: SeatingTable[]
  totalTableCount: number
  floorLayout: FloorLayout
  floorAreas: FloorArea[]
  guestMap: Map<string, Guest>
  assignmentBySeat: Map<string, string>
  saveStatus: FloorSaveStatus
  onSavePositions: (positions: { tableId: string; x: number; y: number }[]) => void
  onShapeChange: (tableId: string, shape: 'rectangle' | 'round') => void
  onUnplaceTable: (tableId: string) => void
  onFloorLayoutChange: (layout: FloorLayout) => void
  onAreasChange: (areas: FloorArea[]) => void
  onOpenTableConfig: () => void
  onExportPDF: () => void
}

export default function FloorPlanCanvas({
  tables, totalTableCount, floorLayout, floorAreas, guestMap, assignmentBySeat, saveStatus,
  onSavePositions, onShapeChange, onUnplaceTable, onFloorLayoutChange, onAreasChange, onOpenTableConfig,
  onExportPDF,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: 'floor-canvas', data: { type: 'floor-canvas' } })
  const setCanvasRef = (el: HTMLDivElement | null) => { canvasRef.current = el; setDroppableRef(el) }
  const [drag, setDrag] = useState<Drag | null>(null)
  const [live, setLive] = useState<Rect | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showAreaMenu, setShowAreaMenu] = useState(false)
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')
  const [roomW, setRoomW] = useState(floorLayout.room_width)
  const [roomH, setRoomH] = useState(floorLayout.room_height)
  const [snapGrid, setSnapGrid] = useState(floorLayout.snap_grid)

  useEffect(() => {
    setRoomW(floorLayout.room_width)
    setRoomH(floorLayout.room_height)
    setSnapGrid(floorLayout.snap_grid)
  }, [floorLayout])

  const gridBg = snapGrid > 0 ? {
    backgroundImage: `linear-gradient(rgba(180,150,100,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(180,150,100,0.1) 1px,transparent 1px)`,
    backgroundSize: `${snapGrid}px ${snapGrid}px`,
  } : {}

  function tableSize(shape: SeatingTable['shape']): { w: number; h: number } {
    return shape === 'round' ? { w: ROUND_SIZE, h: ROUND_SIZE } : { w: RECT_W, h: RECT_H }
  }

  function snap(val: number): number {
    if (snapGrid <= 0) return val
    return Math.round(val / snapGrid) * snapGrid
  }

  function getTablePos(table: SeatingTable, index: number): FloorPos {
    if (drag?.type === 'table' && drag.id === table.id && live) return { x: live.x, y: live.y }
    if (table.pos_x != null && table.pos_y != null) return { x: table.pos_x, y: table.pos_y }
    return defaultPos(index)
  }

  function getAreaRect(area: FloorArea): Rect {
    if (live && drag && drag.id === area.id && (drag.type === 'areaMove' || drag.type === 'areaResize')) return live
    return { x: area.x, y: area.y, w: area.w, h: area.h }
  }

  function handlePrint() {
    const A4_WIDTH_PX = 793 // ~A4 portrait width at 96 dpi
    const scale = Math.min(1, A4_WIDTH_PX / roomW)
    const canvas = canvasRef.current
    if (canvas && scale < 1) {
      canvas.style.zoom = String(scale)
    }
    // Two rAF calls ensure the browser has repainted at the new zoom before the dialog opens.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print()
        if (canvas) canvas.style.zoom = ''
      })
    })
  }

  // ─── Drag / resize ─────────────────────────────────────────────────────────
  function startTableDrag(e: React.PointerEvent, table: SeatingTable, index: number) {
    e.stopPropagation()
    const rect = canvasRef.current!.getBoundingClientRect()
    const pos = getTablePos(table, index)
    setDrag({ type: 'table', id: table.id, offX: e.clientX - rect.left - pos.x, offY: e.clientY - rect.top - pos.y })
    setLive({ x: pos.x, y: pos.y, ...tableSize(table.shape) })
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function startAreaMove(e: React.PointerEvent, area: FloorArea) {
    if (editingAreaId === area.id) return
    e.stopPropagation()
    const rect = canvasRef.current!.getBoundingClientRect()
    setDrag({ type: 'areaMove', id: area.id, offX: e.clientX - rect.left - area.x, offY: e.clientY - rect.top - area.y })
    setLive({ x: area.x, y: area.y, w: area.w, h: area.h })
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function startAreaResize(e: React.PointerEvent, area: FloorArea) {
    e.stopPropagation()
    const rect = canvasRef.current!.getBoundingClientRect()
    setDrag({ type: 'areaResize', id: area.id, px: e.clientX - rect.left, py: e.clientY - rect.top, w0: area.w, h0: area.h })
    setLive({ x: area.x, y: area.y, w: area.w, h: area.h })
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!drag) return
    const rect = canvasRef.current!.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top

    if (drag.type === 'table') {
      const table = tables.find((t) => t.id === drag.id)
      if (!table) return
      const { w, h } = tableSize(table.shape)
      setLive({ x: clamp(snap(px - drag.offX), 0, roomW - w), y: clamp(snap(py - drag.offY), 0, roomH - h), w, h })
    } else if (drag.type === 'areaMove') {
      const area = floorAreas.find((a) => a.id === drag.id)
      if (!area) return
      setLive({ x: clamp(snap(px - drag.offX), 0, roomW - area.w), y: clamp(snap(py - drag.offY), 0, roomH - area.h), w: area.w, h: area.h })
    } else {
      const area = floorAreas.find((a) => a.id === drag.id)
      if (!area) return
      const w = clamp(snap(drag.w0 + (px - drag.px)), MIN_AREA, roomW - area.x)
      const h = clamp(snap(drag.h0 + (py - drag.py)), MIN_AREA, roomH - area.y)
      setLive({ x: area.x, y: area.y, w, h })
    }
  }

  function handlePointerUp() {
    if (drag && live) {
      if (drag.type === 'table') {
        const table = tables.find((t) => t.id === drag.id)
        if (!table || table.pos_x !== live.x || table.pos_y !== live.y) {
          onSavePositions([{ tableId: drag.id, x: live.x, y: live.y }])
        }
      } else if (drag.type === 'areaMove') {
        const area = floorAreas.find((a) => a.id === drag.id)
        if (area && (area.x !== live.x || area.y !== live.y)) {
          onAreasChange(floorAreas.map((a) => a.id === drag.id ? { ...a, x: live.x, y: live.y } : a))
        }
      } else {
        const area = floorAreas.find((a) => a.id === drag.id)
        if (area && (area.w !== live.w || area.h !== live.h)) {
          onAreasChange(floorAreas.map((a) => a.id === drag.id ? { ...a, w: live.w, h: live.h } : a))
        }
      }
    }
    setDrag(null)
    setLive(null)
  }

  // ─── Area mutations ──────────────────────────────────────────────────────────
  function addArea(type: FloorAreaType) {
    onAreasChange([...floorAreas, newArea(type, roomW, roomH, snapGrid)])
    setShowAreaMenu(false)
  }

  function deleteArea(id: string) {
    onAreasChange(floorAreas.filter((a) => a.id !== id))
  }

  function duplicateArea(area: FloorArea) {
    const copy: FloorArea = {
      ...area,
      id: crypto.randomUUID(),
      x: clamp(area.x + 24, 0, roomW - area.w),
      y: clamp(area.y + 24, 0, roomH - area.h),
    }
    onAreasChange([...floorAreas, copy])
  }

  function clearAllAreas() {
    setShowAreaMenu(false)
    if (floorAreas.length === 0) return
    if (confirm(`Remove all ${floorAreas.length} area${floorAreas.length !== 1 ? 's' : ''}? This cannot be undone.`)) {
      onAreasChange([])
    }
  }

  function setAreaShape(id: string, shape: 'rectangle' | 'round') {
    onAreasChange(floorAreas.map((a) => a.id === id ? { ...a, shape } : a))
  }

  function startEditLabel(area: FloorArea) {
    setEditingAreaId(area.id)
    setEditingLabel(area.label)
  }

  function commitLabel() {
    if (editingAreaId) {
      const id = editingAreaId
      onAreasChange(floorAreas.map((a) =>
        a.id === id ? { ...a, label: editingLabel.trim() || AREA_PRESETS[a.type].label } : a
      ))
    }
    setEditingAreaId(null)
  }

  function saveSettings() {
    onFloorLayoutChange({ room_width: roomW, room_height: roomH, snap_grid: snapGrid })
    setShowSettings(false)
  }

  function getOccupancy(table: SeatingTable): number {
    let n = 0
    for (let s = 1; s <= table.capacity; s++) {
      if (assignmentBySeat.has(`${table.id}::${s}`)) n++
    }
    return n
  }

  if (totalTableCount === 0) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-event-muted text-sm">No tables to display.</p>
          <button onClick={onOpenTableConfig} className="px-4 py-2 bg-gold-500 text-white rounded-lg text-sm">
            Set up tables
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 overflow-auto flex flex-col" data-print-show>
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-event-border shrink-0" data-print-hide>
        <span className="text-xs text-event-muted">
          Canvas: <strong className="text-gray-700">{roomW} × {roomH} px</strong>
        </span>
        <span className="text-xs text-event-muted">
          Snap: <strong className="text-gray-700">{snapGrid > 0 ? `${snapGrid}px` : 'off'}</strong>
        </span>
        {saveStatus === 'saving' && (
          <span className="text-xs text-event-muted flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Saving…</span>
        )}
        {saveStatus === 'saved' && (
          <span className="text-xs text-green-600 flex items-center gap-1"><Check size={12} /> All changes saved</span>
        )}
        {saveStatus === 'error' && (
          <span className="text-xs text-red-600 font-medium flex items-center gap-1"><AlertTriangle size={12} /> Save failed — check connection</span>
        )}
        <div className="ml-auto flex items-center gap-2 relative">
          {/* Add area */}
          <div className="relative">
            <button
              onClick={() => { setShowAreaMenu((v) => !v); setShowSettings(false) }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-event-border rounded-lg hover:border-gold-400 hover:bg-gold-50 transition-all"
            >
              <Plus size={14} /> Add area
            </button>
            {showAreaMenu && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl border border-event-border shadow-xl p-1.5 z-50 grid grid-cols-2 gap-1">
                {AREA_TYPE_LIST.map((type) => {
                  const p = AREA_PRESETS[type]
                  const Icon = p.icon
                  return (
                    <button
                      key={type}
                      onClick={() => addArea(type)}
                      className="flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-lg hover:bg-gray-50 text-left transition-colors"
                    >
                      <span className="flex items-center justify-center w-5 h-5 rounded shrink-0" style={{ background: p.bg, color: p.text }}>
                        <Icon size={12} />
                      </span>
                      <span className="text-gray-700 truncate">{p.label}</span>
                    </button>
                  )
                })}
                {floorAreas.length > 0 && (
                  <button
                    onClick={clearAllAreas}
                    className="col-span-2 mt-1 flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-lg text-red-500 hover:bg-red-50 border-t border-event-border pt-2 transition-colors"
                  >
                    <Eraser size={13} /> Clear all areas ({floorAreas.length})
                  </button>
                )}
              </div>
            )}
          </div>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-event-border rounded-lg hover:border-gold-400 hover:bg-gold-50 transition-all"
          >
            <Printer size={14} /> Print
          </button>
          <button
            onClick={onExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-event-border rounded-lg hover:border-gold-400 hover:bg-gold-50 transition-all"
          >
            <Download size={14} /> Export PDF
          </button>
          <button
            onClick={() => { setShowSettings((v) => !v); setShowAreaMenu(false) }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-event-border rounded-lg hover:border-gold-400 hover:bg-gold-50 transition-all"
          >
            <Settings size={14} /> Room settings
          </button>
          {showSettings && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl border border-event-border shadow-xl p-4 z-50 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700">Room settings</h4>
              <div className="flex gap-2">
                <label className="flex-1 space-y-1">
                  <span className="text-xs text-event-muted">Width (px)</span>
                  <input type="number" min={400} step={100} value={roomW} onChange={(e) => setRoomW(Number(e.target.value))}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-gold-400" />
                </label>
                <label className="flex-1 space-y-1">
                  <span className="text-xs text-event-muted">Height (px)</span>
                  <input type="number" min={300} step={100} value={roomH} onChange={(e) => setRoomH(Number(e.target.value))}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-gold-400" />
                </label>
              </div>
              <label className="space-y-1 block">
                <span className="text-xs text-event-muted">Snap grid (updates live)</span>
                <select value={snapGrid} onChange={(e) => setSnapGrid(Number(e.target.value))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-gold-400">
                  <option value={0}>Free (no snap)</option>
                  <option value={20}>20px</option>
                  <option value={40}>40px</option>
                  <option value={80}>80px</option>
                </select>
              </label>
              <button onClick={saveSettings} className="w-full py-1.5 bg-gold-500 text-white text-sm rounded-lg hover:bg-gold-600">
                Save
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto p-4 floor-plan-print-scroll">
        <div
          ref={setCanvasRef}
          className={`relative rounded-xl border-2 shadow-inner floor-plan-canvas transition-colors ${isOver ? 'border-gold-400' : 'border-gold-100'}`}
          style={{ width: roomW, height: roomH, background: '#faf7f2', minWidth: roomW, minHeight: roomH, ...gridBg }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {tables.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" data-print-hide>
              <p className="text-sm text-event-muted bg-white/70 px-4 py-2 rounded-lg border border-dashed border-gold-200">
                Drag a table from the list to place it on the floor plan.
              </p>
            </div>
          )}

          {/* Areas layer — rendered first so tables sit on top */}
          {floorAreas.map((area) => {
            const preset = AREA_PRESETS[area.type]
            const Icon = preset.icon
            const r = getAreaRect(area)
            const isRound = area.shape === 'round'
            const isActive = drag?.id === area.id
            const editing = editingAreaId === area.id
            return (
              <div
                key={area.id}
                className={`group/area absolute border-2 border-dashed select-none flex flex-col items-center justify-center gap-1 text-center
                  ${isRound ? 'rounded-full' : 'rounded-xl'} ${editing ? 'cursor-text' : 'cursor-grab'} ${isActive ? 'cursor-grabbing' : ''}`}
                style={{
                  left: r.x, top: r.y, width: r.w, height: r.h,
                  background: preset.bg, borderColor: preset.border, color: preset.text,
                  zIndex: isActive ? 15 : 0,
                }}
                onPointerDown={(e) => startAreaMove(e, area)}
                onDoubleClick={(e) => { e.stopPropagation(); startEditLabel(area) }}
              >
                <Icon size={18} className="pointer-events-none opacity-80" />
                {editing ? (
                  <input
                    autoFocus
                    value={editingLabel}
                    onChange={(e) => setEditingLabel(e.target.value)}
                    onBlur={commitLabel}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitLabel(); if (e.key === 'Escape') setEditingAreaId(null) }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="w-[85%] text-center text-xs font-semibold bg-white/90 border border-current rounded px-1 py-0.5 outline-none"
                    style={{ color: preset.text }}
                  />
                ) : (
                  <span className="text-xs font-semibold px-2 truncate max-w-full pointer-events-none">{area.label}</span>
                )}

                {/* Hover controls: shape toggle + delete */}
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 opacity-0 group-hover/area:opacity-100 transition-opacity z-30 flex items-center bg-white border border-event-border rounded-lg shadow-sm overflow-hidden"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => setAreaShape(area.id, 'rectangle')}
                    className={`px-1.5 py-1 ${!isRound ? 'bg-gold-500 text-white' : 'text-gray-400 hover:bg-gold-50'}`}
                    title="Rectangle"
                  >
                    <Square size={11} />
                  </button>
                  <button
                    onClick={() => setAreaShape(area.id, 'round')}
                    className={`px-1.5 py-1 border-l border-event-border ${isRound ? 'bg-gold-500 text-white' : 'text-gray-400 hover:bg-gold-50'}`}
                    title="Round"
                  >
                    <Circle size={11} />
                  </button>
                  <button
                    onClick={() => duplicateArea(area)}
                    className="px-1.5 py-1 border-l border-event-border text-gray-400 hover:bg-gold-50 hover:text-gold-600"
                    title="Duplicate area"
                  >
                    <Copy size={11} />
                  </button>
                  <button
                    onClick={() => deleteArea(area.id)}
                    className="px-1.5 py-1 border-l border-event-border text-gray-400 hover:bg-red-50 hover:text-red-500"
                    title="Delete area"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>

                {/* Resize handle */}
                <div
                  onPointerDown={(e) => startAreaResize(e, area)}
                  className="absolute bottom-0 right-0 w-4 h-4 opacity-0 group-hover/area:opacity-100 transition-opacity cursor-se-resize"
                  style={{ touchAction: 'none' }}
                >
                  <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 rounded-sm" style={{ borderColor: preset.text }} />
                </div>
              </div>
            )
          })}

          {tables.map((table, i) => {
            const isRound = table.shape === 'round'
            const { w, h } = tableSize(table.shape)
            const pos = getTablePos(table, i)
            const occ = getOccupancy(table)
            const seatsPerRow = Math.ceil(table.capacity / 2)

            return (
              <div
                key={table.id}
                className={`group absolute border-2 select-none transition-shadow
                  ${isRound ? 'rounded-full' : 'rounded-xl'}
                  ${drag?.type === 'table' && drag.id === table.id
                    ? 'shadow-xl z-10 cursor-grabbing'
                    : 'shadow-card hover:shadow-card-hover cursor-grab z-0 hover:z-20'}
                  ${occ > 0 ? 'border-gold-300 bg-white' : 'border-gray-200 bg-white'}
                `}
                style={{ left: pos.x, top: pos.y, width: w, height: h }}
                onPointerDown={(e) => startTableDrag(e, table, i)}
              >
                {/* Remove from floor plan (send back to the table list) */}
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => onUnplaceTable(table.id)}
                  className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity z-30 bg-white border border-event-border rounded-full p-0.5 shadow-sm text-gray-400 hover:text-red-500"
                  title="Remove from floor plan"
                >
                  <X size={12} />
                </button>
                {isRound ? (
                  <div className="absolute inset-0">
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 pointer-events-none">
                      <span className="font-semibold text-xs text-gray-800 text-center px-3 truncate max-w-full">{table.name}</span>
                      <span className="text-[10px] text-event-muted">{occ}/{table.capacity}</span>
                    </div>
                    {Array.from({ length: table.capacity }, (_, s) => {
                      const angle = (s / table.capacity) * 2 * Math.PI - Math.PI / 2
                      const rad = ROUND_SIZE / 2 - 10
                      const cx = ROUND_SIZE / 2 + rad * Math.cos(angle)
                      const cy = ROUND_SIZE / 2 + rad * Math.sin(angle)
                      const seatKey = `${table.id}::${s + 1}`
                      const guestId = assignmentBySeat.get(seatKey)
                      const guestName = guestId ? guestMap.get(guestId)?.name : undefined
                      const filled = !!guestId
                      return (
                        <div
                          key={s}
                          className={`absolute w-3 h-3 rounded-full border cursor-default ${filled ? 'bg-gold-400 border-gold-500' : 'bg-gray-100 border-gray-300'}`}
                          style={{ left: cx - 6, top: cy - 6 }}
                          title={guestName}
                          onPointerDown={(e) => e.stopPropagation()}
                        />
                      )
                    })}
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col justify-between py-1 px-2">
                    <div className="flex justify-around">
                      {Array.from({ length: seatsPerRow }, (_, s) => {
                        const seatKey = `${table.id}::${s + 1}`
                        const guestId = assignmentBySeat.get(seatKey)
                        const guestName = guestId ? guestMap.get(guestId)?.name : undefined
                        const filled = !!guestId
                        return (
                          <div
                            key={s}
                            className={`w-3 h-3 rounded-full border cursor-default ${filled ? 'bg-gold-400 border-gold-500' : 'bg-gray-100 border-gray-300'}`}
                            title={guestName}
                            onPointerDown={(e) => e.stopPropagation()}
                          />
                        )
                      })}
                    </div>
                    <div className="flex flex-col items-center gap-0.5 pointer-events-none">
                      <span className="font-semibold text-xs text-gray-800 truncate max-w-[90%]">{table.name}</span>
                      <span className="text-[10px] text-event-muted">{occ}/{table.capacity}</span>
                    </div>
                    <div className="flex justify-around">
                      {Array.from({ length: table.capacity - seatsPerRow }, (_, s) => {
                        const seatKey = `${table.id}::${seatsPerRow + s + 1}`
                        const guestId = assignmentBySeat.get(seatKey)
                        const guestName = guestId ? guestMap.get(guestId)?.name : undefined
                        const filled = !!guestId
                        return (
                          <div
                            key={s}
                            className={`w-3 h-3 rounded-full border cursor-default ${filled ? 'bg-gold-400 border-gold-500' : 'bg-gray-100 border-gray-300'}`}
                            title={guestName}
                            onPointerDown={(e) => e.stopPropagation()}
                          />
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Shape toggle — hover pill below the table */}
                <div
                  className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center bg-white border border-event-border rounded-lg shadow-sm overflow-hidden whitespace-nowrap"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => onShapeChange(table.id, 'round')}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs transition-colors ${
                      isRound ? 'bg-gold-500 text-white' : 'text-gray-500 hover:bg-gold-50'
                    }`}
                  >
                    <Circle size={11} /> Round
                  </button>
                  <button
                    onClick={() => onShapeChange(table.id, 'rectangle')}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs border-l border-event-border transition-colors ${
                      !isRound ? 'bg-gold-500 text-white' : 'text-gray-500 hover:bg-gold-50'
                    }`}
                  >
                    <Square size={11} /> Rect
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
