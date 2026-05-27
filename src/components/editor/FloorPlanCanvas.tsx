'use client'

import { useState, useRef, useEffect } from 'react'
import { Settings, Circle, Square, Printer } from 'lucide-react'
import type { Guest, SeatingTable, FloorLayout } from '@/types'

const RECT_W = 160
const RECT_H = 110
const ROUND_SIZE = 130

interface FloorPos { x: number; y: number }

function defaultPos(index: number): FloorPos {
  const cols = 5
  return {
    x: 40 + (index % cols) * (RECT_W + 30),
    y: 40 + Math.floor(index / cols) * (RECT_H + 30),
  }
}

interface Props {
  tables: SeatingTable[]
  floorLayout: FloorLayout
  guestMap: Map<string, Guest>
  assignmentBySeat: Map<string, string>
  onPositionChange: (tableId: string, x: number, y: number) => void
  onShapeChange: (tableId: string, shape: 'rectangle' | 'round') => void
  onFloorLayoutChange: (layout: FloorLayout) => void
  onOpenTableConfig: () => void
}

export default function FloorPlanCanvas({
  tables, floorLayout, guestMap, assignmentBySeat,
  onPositionChange, onShapeChange, onFloorLayoutChange, onOpenTableConfig,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [tempPos, setTempPos] = useState<FloorPos | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [roomW, setRoomW] = useState(floorLayout.room_width)
  const [roomH, setRoomH] = useState(floorLayout.room_height)
  const [snapGrid, setSnapGrid] = useState(floorLayout.snap_grid)

  // Keep local form state in sync with committed prop
  useEffect(() => {
    setRoomW(floorLayout.room_width)
    setRoomH(floorLayout.room_height)
    setSnapGrid(floorLayout.snap_grid)
  }, [floorLayout])

  // Use local snapGrid so the grid previews immediately as the select changes
  const gridBg = snapGrid > 0 ? {
    backgroundImage: `linear-gradient(rgba(180,150,100,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(180,150,100,0.1) 1px,transparent 1px)`,
    backgroundSize: `${snapGrid}px ${snapGrid}px`,
  } : {}

  function tableSize(shape: SeatingTable['shape']): { w: number; h: number } {
    return shape === 'round' ? { w: ROUND_SIZE, h: ROUND_SIZE } : { w: RECT_W, h: RECT_H }
  }

  function getPos(table: SeatingTable, index: number): FloorPos {
    if (draggingId === table.id && tempPos) return tempPos
    if (table.pos_x != null && table.pos_y != null) return { x: table.pos_x, y: table.pos_y }
    return defaultPos(index)
  }

  function snap(val: number): number {
    if (snapGrid <= 0) return val
    return Math.round(val / snapGrid) * snapGrid
  }

  function startDrag(e: React.PointerEvent, table: SeatingTable, index: number) {
    e.stopPropagation()
    const rect = canvasRef.current!.getBoundingClientRect()
    const pos = getPos(table, index)
    setDragOffset({ x: e.clientX - rect.left - pos.x, y: e.clientY - rect.top - pos.y })
    setTempPos(pos)
    setDraggingId(table.id)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!draggingId) return
    const table = tables.find((t) => t.id === draggingId)
    if (!table) return
    const { w, h } = tableSize(table.shape)
    const rect = canvasRef.current!.getBoundingClientRect()
    const rawX = e.clientX - rect.left - dragOffset.x
    const rawY = e.clientY - rect.top - dragOffset.y
    setTempPos({
      x: Math.max(0, Math.min(roomW - w, snap(rawX))),
      y: Math.max(0, Math.min(roomH - h, snap(rawY))),
    })
  }

  function handlePointerUp() {
    if (draggingId && tempPos) onPositionChange(draggingId, tempPos.x, tempPos.y)
    setDraggingId(null)
    setTempPos(null)
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

  if (tables.length === 0) {
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
        <div className="ml-auto flex items-center gap-2 relative">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-event-border rounded-lg hover:border-gold-400 hover:bg-gold-50 transition-all"
          >
            <Printer size={14} /> Print
          </button>
          <button
            onClick={() => setShowSettings((v) => !v)}
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
      <div className="flex-1 overflow-auto p-4">
        <div
          ref={canvasRef}
          className="relative rounded-xl border-2 border-gold-100 shadow-inner floor-plan-canvas"
          style={{ width: roomW, height: roomH, background: '#faf7f2', minWidth: roomW, minHeight: roomH, ...gridBg }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {tables.map((table, i) => {
            const isRound = table.shape === 'round'
            const { w, h } = tableSize(table.shape)
            const pos = getPos(table, i)
            const occ = getOccupancy(table)
            const seatsPerRow = Math.ceil(table.capacity / 2)

            return (
              <div
                key={table.id}
                className={`group absolute border-2 select-none transition-shadow
                  ${isRound ? 'rounded-full' : 'rounded-xl'}
                  ${draggingId === table.id
                    ? 'shadow-xl z-10 cursor-grabbing'
                    : 'shadow-card hover:shadow-card-hover cursor-grab z-0 hover:z-20'}
                  ${occ > 0 ? 'border-gold-300 bg-white' : 'border-gray-200 bg-white'}
                `}
                style={{ left: pos.x, top: pos.y, width: w, height: h }}
                onPointerDown={(e) => startDrag(e, table, i)}
              >
                {isRound ? (
                  <div className="absolute inset-0">
                    {/* Center label — no pointer events so drag still works from center */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 pointer-events-none">
                      <span className="font-semibold text-xs text-gray-800 text-center px-3 truncate max-w-full">{table.name}</span>
                      <span className="text-[10px] text-event-muted">{occ}/{table.capacity}</span>
                    </div>
                    {/* Seat dots — pointer-events enabled so title tooltip works */}
                    {Array.from({ length: table.capacity }, (_, s) => {
                      const angle = (s / table.capacity) * 2 * Math.PI - Math.PI / 2
                      const r = ROUND_SIZE / 2 - 10
                      const cx = ROUND_SIZE / 2 + r * Math.cos(angle)
                      const cy = ROUND_SIZE / 2 + r * Math.sin(angle)
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
                  // Rectangular table: seats top + bottom rows
                  <div className="absolute inset-0 flex flex-col justify-between py-1 px-2">
                    {/* Top seats */}
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
                    {/* Center label */}
                    <div className="flex flex-col items-center gap-0.5 pointer-events-none">
                      <span className="font-semibold text-xs text-gray-800 truncate max-w-[90%]">{table.name}</span>
                      <span className="text-[10px] text-event-muted">{occ}/{table.capacity}</span>
                    </div>
                    {/* Bottom seats */}
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
