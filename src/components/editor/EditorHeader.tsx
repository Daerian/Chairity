'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Settings2, Upload, ChevronLeft, Check, Loader2, Share2, LayoutGrid, Map } from 'lucide-react'
import type { Guest, SeatingTable, SeatAssignment } from '@/types'
import ExportButtons from './ExportButtons'
import ThemeSelector from '@/components/ThemeSelector'

interface Props {
  eventName: string
  saving: boolean
  tables: SeatingTable[]
  guests: Guest[]
  assignments: SeatAssignment[]
  isOwner: boolean
  view: 'grid' | 'floor'
  onViewChange: (view: 'grid' | 'floor') => void
  onRename: (name: string) => void
  onOpenTableConfig: () => void
  onOpenCSVImport: () => void
  onOpenShare: () => void
}

export default function EditorHeader({
  eventName, saving, tables, guests, assignments, isOwner, view, onViewChange,
  onRename, onOpenTableConfig, onOpenCSVImport, onOpenShare,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(eventName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(eventName) }, [eventName])
  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  function commit() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== eventName) onRename(trimmed)
    else setDraft(eventName)
    setEditing(false)
  }

  return (
    <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-event-border shadow-sm z-10 shrink-0" data-print-hide>
      <Link href="/dashboard" className="text-event-muted hover:text-gold-600 transition-colors">
        <ChevronLeft size={20} />
      </Link>

      <div className="flex-1 flex items-center gap-2 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(eventName); setEditing(false) } }}
            className="font-display text-xl font-semibold bg-transparent border-b-2 border-gold-400 outline-none min-w-0 flex-1"
            autoFocus
          />
        ) : (
          <button onClick={() => setEditing(true)} className="font-display text-xl font-semibold truncate hover:text-gold-700 transition-colors text-left" title="Click to rename">
            {eventName}
          </button>
        )}
        {saving
          ? <Loader2 size={14} className="text-gold-500 animate-spin shrink-0" />
          : <Check size={14} className="text-green-500 shrink-0" />
        }
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* View toggle */}
        <div className="flex items-center border border-event-border rounded-lg overflow-hidden">
          <button
            onClick={() => onViewChange('grid')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${
              view === 'grid' ? 'bg-gold-500 text-white' : 'hover:bg-gold-50 text-gray-600'
            }`}
          >
            <LayoutGrid size={13} />
            Grid
          </button>
          <button
            onClick={() => onViewChange('floor')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors border-l border-event-border ${
              view === 'floor' ? 'bg-gold-500 text-white' : 'hover:bg-gold-50 text-gray-600'
            }`}
          >
            <Map size={13} />
            Floor Plan
          </button>
        </div>

        <button onClick={onOpenCSVImport} className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-event-border hover:border-gold-400 hover:bg-gold-50 transition-all">
          <Upload size={14} />
          Import CSV
        </button>
        <button onClick={onOpenTableConfig} className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-event-border hover:border-gold-400 hover:bg-gold-50 transition-all">
          <Settings2 size={14} />
          Tables
        </button>
        {isOwner && (
          <button onClick={onOpenShare} className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-event-border hover:border-gold-400 hover:bg-gold-50 transition-all">
            <Share2 size={14} />
            Share
          </button>
        )}
        <ExportButtons eventName={eventName} tables={tables} guests={guests} assignments={assignments} />
        <ThemeSelector />
      </div>
    </header>
  )
}
