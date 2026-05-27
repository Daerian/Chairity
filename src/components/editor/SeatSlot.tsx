'use client'

import { useCallback, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { X, ChevronDown, Search } from 'lucide-react'
import { getGroupColor } from '@/lib/groups'
import type { Guest } from '@/types'

interface Props {
  tableId: string
  seatNumber: number
  assignedGuest: Guest | null
  guestMap: Map<string, Guest>
  assignmentBySeat: Map<string, string>
  onUnassign: () => void
}

export default function SeatSlot({ tableId, seatNumber, assignedGuest, guestMap, assignmentBySeat, onUnassign }: Props) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [search, setSearch] = useState('')
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const [mounted, setMounted] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `seat-${tableId}-${seatNumber}`,
    data: { type: 'seat', tableId, seatNumber },
  })

  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: assignedGuest ? `seated-${assignedGuest.id}` : `empty-seat-${tableId}-${seatNumber}`,
    data: assignedGuest ? { type: 'seated', guestId: assignedGuest.id, tableId, seatNumber } : { type: 'empty' },
    disabled: !assignedGuest,
  })

  const setRef = useCallback((node: HTMLElement | null) => {
    setDropRef(node)
    setDragRef(node)
  }, [setDropRef, setDragRef])

  function openDropdown() {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const DROPDOWN_W = 224
    const DROPDOWN_H = 260

    let top = rect.bottom + 4
    if (top + DROPDOWN_H > window.innerHeight) top = rect.top - DROPDOWN_H - 4

    let left = rect.left
    if (left + DROPDOWN_W > window.innerWidth) left = window.innerWidth - DROPDOWN_W - 8

    setDropdownStyle({ position: 'fixed', top, left, width: DROPDOWN_W, zIndex: 9999 })
    setShowDropdown(true)
    setSearch('')
  }

  function closeDropdown() {
    setShowDropdown(false)
    setSearch('')
  }

  const seatedGuestIds = new Set(assignmentBySeat.values())
  const availableGuests = Array.from(guestMap.values()).filter((g) => !seatedGuestIds.has(g.id) || g.id === assignedGuest?.id)
  const filtered = search
    ? availableGuests.filter((g) => g.name.toLowerCase().includes(search.toLowerCase()))
    : availableGuests

  return (
    <div ref={triggerRef} className="relative min-w-0">
      <div
        ref={setRef}
        style={assignedGuest ? { transform: CSS.Translate.toString(transform) } : undefined}
        {...(assignedGuest ? listeners : {})}
        {...(assignedGuest ? attributes : {})}
        title={assignedGuest ? assignedGuest.name : undefined}
        className={`flex items-center gap-1 px-2 py-1.5 rounded-md border text-xs min-h-[30px] min-w-0 overflow-hidden transition-all select-none
          ${isDragging ? 'opacity-40' : ''}
          ${isOver ? 'border-gold-400 bg-gold-50 scale-[1.02]' : ''}
          ${assignedGuest
            ? 'bg-white border-gold-200 hover:border-gold-300 cursor-grab active:cursor-grabbing'
            : 'border-dashed border-gray-200 bg-gray-50 hover:border-gold-300 hover:bg-gold-50 cursor-pointer'
          }`}
        onClick={assignedGuest ? undefined : openDropdown}
      >
        <span className="text-gray-400 font-mono text-[10px] w-3.5 shrink-0">{seatNumber}</span>
        {assignedGuest ? (
          <>
            {assignedGuest.group_name && (
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: getGroupColor(assignedGuest.group_name) }} />
            )}
            <span className="flex-1 truncate font-medium text-gray-700">{assignedGuest.name}</span>
            <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onUnassign() }} className="ml-0.5 shrink-0 text-gray-300 hover:text-red-400 transition-colors">
              <X size={10} />
            </button>
          </>
        ) : (
          <>
            <span className="flex-1 text-gray-300 italic">empty</span>
            <ChevronDown size={10} className="text-gray-300 shrink-0" />
          </>
        )}
      </div>

      {showDropdown && !assignedGuest && mounted && createPortal(
        <>
          <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={closeDropdown} />
          <div className="bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden" style={dropdownStyle}>
            <div className="flex items-center gap-1.5 px-2.5 py-2 border-b border-gray-100">
              <Search size={11} className="text-gray-400 shrink-0" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onPointerDown={(e) => e.stopPropagation()}
                placeholder="Search guests…"
                className="flex-1 text-xs outline-none bg-transparent placeholder:text-gray-400"
              />
            </div>
            <div className="max-h-44 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-400">
                  {availableGuests.length === 0 ? 'No unassigned guests' : 'No matches'}
                </p>
              ) : (
                filtered.map((g) => (
                  <button
                    key={g.id}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-gold-50 hover:text-gold-700 transition-colors"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => {
                      closeDropdown()
                      document.dispatchEvent(new CustomEvent('chairity:assign', { detail: { guestId: g.id, tableId, seatNumber } }))
                    }}
                  >
                    {g.name}
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-gray-100 px-3 py-1.5">
              <button onClick={closeDropdown} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}
