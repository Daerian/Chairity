'use client'

import { useState, useRef } from 'react'
import { Settings, Circle, Square, Printer } from 'lucide-react'
import type { Guest, SeatingTable, FloorLayout } from '@/types'

const CANVAS_W = 1200
const CANVAS_H = 800
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
  assignmentBySeat: Map<string, string>
  onPositionChange: (tableId: string, x: number, y: number) => void
  onShapeChange: (tableId: string, shape: 'rectangle' | 'round') => void
  onFloorLayoutChange: (layout: FloorLayout) => void
  onOpenTableConfig: () => void
}

export default function FloorPlanCanvas({
  tables, floorLayout, assignmentBySeat,
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

  const gridBg = floorLayout.snap_grid > 0 ? {
    backgroundImage: `linear-gradient(rgba(180,150,100,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(180,150,100,0.1) 1px,transparent 1px)`,
    backgroundSize: `${floorLayout.snap_grid}px ${floorLayout.snap_grid}px`,
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
    if (floorLayout.snap_grid <= 0) return val
    return Math.round(val / floorLayout.snap_grid) * floorLayout.snap_grid
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
      x: Math.max(0, Math.min(CANVAS_W - w, snap(rawX))),
      y: Math.max(0, Math.min(CANVAS_H - h, snap(rawY))),
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
          Room: <strong className="text-gray-700">{floorLayout.room_width} m × {floorLayout.room_height} m</strong>
        </span>
        <span className="text-xs text-event-muted">
          Snap: <strong className="text-gray-700">{floorLayout.snap_grid > 0 ? `${floorLayout.snap_grid}px` : 'off'}</strong>
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
                  <span className="text-xs text-event-muted">Width (m)</span>
                  <input type="number" min={1} value={roomW} onChange={(e) => setRoomW(Number(e.target.value))}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-gold-400" />
                </label>
                <label className="flex-1 space-y-1">
                  <span className="text-xs text-event-muted">Height (m)</span>
                  <input type="number" min={1} value={roomH} onChange={(e) => setRoomH(Number(e.target.value))}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-gold-400" />
                </label>
              </div>
              <label className="space-y-1 block">
                <span className="text-xs text-event-muted">Snap grid</span>
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
          style={{ width: CANVAS_W, height: CANVAS_H, background: '#faf7f2', minWidth: CANVAS_W, minHeight: CANVAS_H, ...gridBg }}
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
                className={`absolute border-2 select-none transition-shadow
                  ${isRound ? 'rounded-full' : 'rounded-xl'}
                  ${draggingId === table.id ? 'shadow-xl z-10 cursor-grabbing' : 'shadow-card hover:shadow-card-hover cursor-grab z-0'}
                  ${occ > 0 ? 'border-gold-300 bg-white' : 'border-gray-200 bg-white'}
                `}
                style={{ left: pos.x, top: pos.y, width: w, height: h }}
                onPointerDown={(e) => startDrag(e, table, i)}
              >
                {isRound ? (
                  // Round table: seats around circumference
                  <div className="absolute inset-0">
                    {/* Center info */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 pointer-events-none">
                      <span className="font-semibold text-xs text-gray-800 text-center px-3 truncate max-w-full">{table.name}</span>
                      <span className="text-[10px] text-event-muted">{occ}/{table.capacity}</span>
                    </div>
                    {/* Seat dots */}
                    {Array.from({ length: table.capacity }, (_, s) => {
                      const angle = (s / table.capacity) * 2 * Math.PI - Math.PI / 2
                      const r = ROUND_SIZE / 2 - 10
                      const cx = ROUND_SIZE / 2 + r * Math.cos(angle)
                      const cy = ROUND_SIZE / 2 + r * Math.sin(angle)
                      const filled = assignmentBySeat.has(`${table.id}::${s + 1}`)
                      return (
                        <div
                          key={s}
                          className={`absolute w-3 h-3 rounded-full border pointer-events-none ${filled ? 'bg-gold-400 border-gold-500' : 'bg-gray-100 border-gray-300'}`}
                          style={{ left: cx - 6, top: cy - 6 }}
                        />
                      )
                    })}
                  </div>
                ) : (
                  // Rectangular table: seats top + bottom rows
                  <div className="absolute inset-0 flex flex-col justify-between py-1 px-2 pointer-events-none">
                    {/* Top seats */}
                    <div className="flex justify-around">
                      {Array.from({ length: seatsPerRow }, (_, s) => {
                        const filled = assignmentBySeat.has(`${table.id}::${s + 1}`)
                        return (
                          <div key={s} className={`w-3 h-3 rounded-full border ${filled ? 'bg-gold-400 border-gold-500' : 'bg-gray-100 border-gray-300'}`} />
                        )
                      })}
                    </div>
                    {/* Center info */}
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="font-semibold text-xs text-gray-800 truncate max-w-[90%]">{table.name}</span>
                      <span className="text-[10px] text-event-muted">{occ}/{table.capacity}</span>
                    </div>
                    {/* Bottom seats */}
                    <div className="flex justify-around">
                      {Array.from({ length: table.capacity - seatsPerRow }, (_, s) => {
                        const filled = assignmentBySeat.has(`${table.id}::${seatsPerRow + s + 1}`)
                        return (
                          <div key={s} className={`w-3 h-3 rounded-full border ${filled ? 'bg-gold-400 border-gold-500' : 'bg-gray-100 border-gray-300'}`} />
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Shape toggle */}
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => onShapeChange(table.id, isRound ? 'rectangle' : 'round')}
                  title={isRound ? 'Switch to rectangular' : 'Switch to round'}
                  className="absolute bottom-1 right-1 text-gray-300 hover:text-gold-500 transition-colors"
                >
                  {isRound ? <Square size={10} /> : <Circle size={10} />}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
