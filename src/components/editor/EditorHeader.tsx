'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Settings2, Upload, ChevronLeft, Check, Loader2, Share2, LayoutGrid,
  Map as MapIcon, Search, X, MoreVertical, Download, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import type { Guest, SeatingTable, SeatAssignment } from '@/types'
import { getGroupColor } from '@/lib/groups'
import ExportButtons from './ExportButtons'
import ThemeSelector from '@/components/ThemeSelector'
import { useIsMobile } from '@/hooks/useIsMobile'
import { exportToPDF, exportToExcel } from '@/lib/export'
import { THEMES, useTheme } from '@/lib/theme'

interface Props {
  eventName: string
  saving: boolean
  tables: SeatingTable[]
  guests: Guest[]
  assignments: SeatAssignment[]
  isOwner: boolean
  view: 'grid' | 'floor'
  sidebarOpen: boolean
  onViewChange: (view: 'grid' | 'floor') => void
  onRename: (name: string) => void
  onOpenTableConfig: () => void
  onOpenCSVImport: () => void
  onOpenShare: () => void
  onDeleteGuest: (guestId: string) => void
  onToggleSidebar: () => void
}

export default function EditorHeader({
  eventName, saving, tables, guests, assignments, isOwner, view, sidebarOpen,
  onViewChange, onRename, onOpenTableConfig, onOpenCSVImport, onOpenShare,
  onDeleteGuest, onToggleSidebar,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(eventName)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showOverflow, setShowOverflow] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const overflowRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()
  const { theme, setTheme } = useTheme()

  useEffect(() => { setDraft(eventName) }, [eventName])
  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  useEffect(() => {
    if (!showSearch) return
    searchInputRef.current?.focus()
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearch(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSearch])

  useEffect(() => {
    if (!showOverflow) return
    function handleClickOutside(e: MouseEvent) {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setShowOverflow(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showOverflow])

  const tableMap = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables])
  const assignmentByGuestId = useMemo(() => new Map(assignments.map((a) => [a.guest_id, a])), [assignments])

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return guests
      .filter((g) => g.name.toLowerCase().includes(q))
      .map((g) => {
        const assignment = assignmentByGuestId.get(g.id)
        const table = assignment ? tableMap.get(assignment.table_id) : null
        return { guest: g, table: table ?? null }
      })
      .sort((a, b) => a.guest.name.localeCompare(b.guest.name))
  }, [guests, searchQuery, tableMap, assignmentByGuestId])

  function commit() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== eventName) onRename(trimmed)
    else setDraft(eventName)
    setEditing(false)
  }

  const sidebarToggleBtn = (
    <button
      onClick={onToggleSidebar}
      title={sidebarOpen ? 'Hide guest panel' : 'Show guest panel'}
      className="flex items-center justify-center w-8 h-8 rounded-lg border border-event-border hover:border-gold-400 hover:bg-gold-50 transition-all text-gray-500"
    >
      {sidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
    </button>
  )

  const viewToggle = (
    <div className="flex items-center border border-event-border rounded-lg overflow-hidden shrink-0">
      <button
        onClick={() => onViewChange('grid')}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm transition-colors ${
          view === 'grid' ? 'bg-gold-500 text-white' : 'hover:bg-gold-50 text-gray-600'
        }`}
        title="Grid view"
      >
        <LayoutGrid size={13} />
        <span className="hidden md:inline">Grid</span>
      </button>
      <button
        onClick={() => onViewChange('floor')}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm transition-colors border-l border-event-border ${
          view === 'floor' ? 'bg-gold-500 text-white' : 'hover:bg-gold-50 text-gray-600'
        }`}
        title="Floor plan view"
      >
        <MapIcon size={13} />
        <span className="hidden md:inline">Floor Plan</span>
      </button>
    </div>
  )

  const searchDropdown = (
    <div className="relative shrink-0" ref={searchContainerRef}>
      <button
        onClick={() => setShowSearch((v) => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-lg border transition-all ${
          showSearch ? 'border-gold-400 bg-gold-50 text-gold-700' : 'border-event-border hover:border-gold-400 hover:bg-gold-50'
        }`}
        title="Find guest"
      >
        <Search size={14} />
        <span className="hidden md:inline">Find</span>
      </button>

      {showSearch && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-event-border shadow-lg z-50 overflow-hidden">
          <div className="p-3 border-b border-event-border">
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 rounded-lg border border-gray-200 focus-within:border-gold-400 transition-colors">
              <Search size={13} className="text-gray-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by name…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { setShowSearch(false); setSearchQuery('') } }}
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-gray-400"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {!searchQuery.trim() ? (
              <p className="px-4 py-6 text-center text-sm text-event-muted">Type a name to find a guest</p>
            ) : searchResults.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-event-muted">No guests found</p>
            ) : (
              <div className="p-2 space-y-0.5">
                {searchResults.map(({ guest, table }) => (
                  <div key={guest.id} className="group flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                    {guest.group_name && (
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: getGroupColor(guest.group_name) }} />
                    )}
                    <span className="flex-1 text-sm font-medium text-gray-800 truncate">{guest.name}</span>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                      table ? 'bg-gold-50 text-gold-700 border border-gold-200' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {table ? table.name : 'Unassigned'}
                    </span>
                    <button
                      onClick={() => onDeleteGuest(guest.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all shrink-0"
                      title="Remove guest"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )

  // ─── Mobile layout ───────────────────────────────────────────────────────────
  if (isMobile === true) {
    return (
      <header className="flex items-center gap-2 px-3 py-2.5 bg-white border-b border-event-border shadow-sm z-10 shrink-0" data-print-hide>
        <Link href="/dashboard" className="text-event-muted hover:text-gold-600 transition-colors shrink-0">
          <ChevronLeft size={20} />
        </Link>

        <div className="flex-1 flex items-center gap-1.5 min-w-0">
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(eventName); setEditing(false) } }}
              className="font-display text-base font-semibold bg-transparent border-b-2 border-gold-400 outline-none min-w-0 flex-1"
              autoFocus
            />
          ) : (
            <button onClick={() => setEditing(true)} className="font-display text-base font-semibold truncate hover:text-gold-700 transition-colors text-left" title="Click to rename">
              {eventName}
            </button>
          )}
          {saving
            ? <Loader2 size={13} className="text-gold-500 animate-spin shrink-0" />
            : <Check size={13} className="text-green-500 shrink-0" />
          }
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {sidebarToggleBtn}
          {viewToggle}
          {searchDropdown}

          {/* Overflow menu */}
          <div className="relative" ref={overflowRef}>
            <button
              onClick={() => setShowOverflow((v) => !v)}
              className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-all ${
                showOverflow
                  ? 'border-gold-400 bg-gold-50 text-gold-700'
                  : 'border-event-border hover:border-gold-400 hover:bg-gold-50 text-gray-600'
              }`}
              title="More options"
            >
              <MoreVertical size={15} />
            </button>

            {showOverflow && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl border border-event-border shadow-xl z-50 py-1.5">
                <button
                  onClick={() => { onOpenCSVImport(); setShowOverflow(false) }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gold-50 hover:text-gold-700 transition-colors text-left"
                >
                  <Upload size={14} className="shrink-0" />
                  Import CSV
                </button>
                <button
                  onClick={() => { onOpenTableConfig(); setShowOverflow(false) }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gold-50 hover:text-gold-700 transition-colors text-left"
                >
                  <Settings2 size={14} className="shrink-0" />
                  Tables
                </button>
                {isOwner && (
                  <button
                    onClick={() => { onOpenShare(); setShowOverflow(false) }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gold-50 hover:text-gold-700 transition-colors text-left"
                  >
                    <Share2 size={14} className="shrink-0" />
                    Share
                  </button>
                )}

                <div className="my-1 border-t border-gray-100" />

                <button
                  onClick={() => { exportToPDF({ eventName, tables, guests, assignments }); setShowOverflow(false) }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gold-50 hover:text-gold-700 transition-colors text-left"
                >
                  <Download size={14} className="shrink-0" />
                  Export PDF
                </button>
                <button
                  onClick={() => { exportToExcel({ eventName, tables, guests, assignments }); setShowOverflow(false) }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gold-50 hover:text-gold-700 transition-colors text-left"
                >
                  <Download size={14} className="shrink-0" />
                  Export Excel
                </button>

                <div className="my-1 border-t border-gray-100" />

                <div className="px-4 py-2">
                  <p className="text-xs font-medium text-gray-400 mb-2">Theme</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {THEMES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTheme(t.id)}
                        title={t.label}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${
                          theme === t.id ? 'border-gray-700 scale-110' : 'border-transparent hover:scale-110'
                        }`}
                        style={{ background: t.swatch }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
    )
  }

  // ─── Desktop layout ──────────────────────────────────────────────────────────
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
        {sidebarToggleBtn}
        {viewToggle}

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

        {searchDropdown}
        <ThemeSelector />
      </div>
    </header>
  )
}
