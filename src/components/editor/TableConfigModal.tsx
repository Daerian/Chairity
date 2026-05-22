'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Plus, Trash2, AlertTriangle } from 'lucide-react'
import type { SeatingTable } from '@/types'

interface Props {
  eventId: string
  tables: SeatingTable[]
  onClose: () => void
  onSave: (tables: SeatingTable[]) => void
}

interface TableRow {
  id: string | null  // null = new
  name: string
  capacity: number
  sort_order: number
  toDelete?: boolean
}

export default function TableConfigModal({ eventId, tables, onClose, onSave }: Props) {
  const supabase = createClient()

  const [rows, setRows] = useState<TableRow[]>(
    tables.map((t) => ({ id: t.id, name: t.name, capacity: t.capacity, sort_order: t.sort_order }))
  )
  const [bulkCount, setBulkCount] = useState(10)
  const [bulkCapacity, setBulkCapacity] = useState(10)
  const [bulkPrefix, setBulkPrefix] = useState('Table')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function addBulk() {
    if (bulkCount < 1 || bulkCapacity < 1) return
    const startIndex = rows.filter((r) => !r.toDelete).length + 1
    const newRows: TableRow[] = Array.from({ length: bulkCount }, (_, i) => ({
      id: null,
      name: `${bulkPrefix} ${startIndex + i}`,
      capacity: bulkCapacity,
      sort_order: startIndex + i - 1,
    }))
    setRows((prev) => [...prev, ...newRows])
  }

  function updateRow(idx: number, patch: Partial<TableRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  function markDelete(idx: number) {
    const row = rows[idx]
    if (row.id === null) {
      setRows((prev) => prev.filter((_, i) => i !== idx))
    } else {
      updateRow(idx, { toDelete: !row.toDelete })
    }
  }

  async function handleSave() {
    const activeRows = rows.filter((r) => !r.toDelete)
    if (activeRows.some((r) => !r.name.trim())) {
      setError('All tables must have a name.')
      return
    }
    setError('')
    setSaving(true)

    const toDelete = rows.filter((r) => r.id && r.toDelete).map((r) => r.id as string)
    const toUpdate = activeRows.filter((r) => r.id !== null)
    const toInsert = activeRows.filter((r) => r.id === null)

    const ops: Promise<unknown>[] = []

    if (toDelete.length) {
      ops.push(supabase.from('seating_tables').delete().in('id', toDelete))
    }
    for (const r of toUpdate) {
      ops.push(
        supabase.from('seating_tables').update({ name: r.name.trim(), capacity: r.capacity, sort_order: r.sort_order }).eq('id', r.id!)
      )
    }
    if (toInsert.length) {
      ops.push(
        supabase.from('seating_tables').insert(
          toInsert.map((r) => ({ event_id: eventId, name: r.name.trim(), capacity: r.capacity, sort_order: r.sort_order }))
        )
      )
    }

    await Promise.all(ops)

    const { data } = await supabase.from('seating_tables').select('*').eq('event_id', eventId).order('sort_order')
    setSaving(false)
    onSave((data ?? []) as SeatingTable[])
  }

  const activeCount = rows.filter((r) => !r.toDelete).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-event-border">
          <h2 className="font-display text-lg font-semibold">Configure Tables</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Bulk add section */}
          <div className="bg-gold-50 rounded-xl p-4 border border-gold-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Add Tables in Bulk</h3>
            <div className="grid grid-cols-3 gap-3">
              <label className="space-y-1">
                <span className="text-xs text-event-muted">Count</span>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={bulkCount}
                  onChange={(e) => setBulkCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-gold-400"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-event-muted">Seats each</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={bulkCapacity}
                  onChange={(e) => setBulkCapacity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-gold-400"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-event-muted">Name prefix</span>
                <input
                  type="text"
                  value={bulkPrefix}
                  onChange={(e) => setBulkPrefix(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-gold-400"
                />
              </label>
            </div>
            <button
              onClick={addBulk}
              className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-gold-500 text-white text-sm rounded-lg hover:bg-gold-600 transition-colors"
            >
              <Plus size={14} />
              Add {bulkCount} table{bulkCount !== 1 ? 's' : ''} of {bulkCapacity}
            </button>
          </div>

          {/* Existing / preview table list */}
          {rows.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                All Tables ({activeCount} active{rows.some((r) => r.toDelete) ? `, ${rows.filter((r) => r.toDelete).length} to remove` : ''})
              </h3>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {rows.map((row, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                      row.toDelete ? 'opacity-40 border-red-200 bg-red-50' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <input
                      value={row.name}
                      onChange={(e) => updateRow(idx, { name: e.target.value })}
                      disabled={row.toDelete}
                      className="flex-1 text-sm px-2 py-1 border border-transparent rounded focus:border-gold-300 outline-none bg-transparent"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-event-muted">seats:</span>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={row.capacity}
                        onChange={(e) => updateRow(idx, { capacity: Math.max(1, parseInt(e.target.value) || 1) })}
                        disabled={row.toDelete}
                        className="w-12 text-sm text-center px-1 py-1 border border-gray-200 rounded focus:border-gold-300 outline-none"
                      />
                    </div>
                    <button onClick={() => markDelete(idx)} className="text-gray-300 hover:text-red-400 transition-colors">
                      {row.toDelete ? <Plus size={14} className="rotate-45 text-red-400" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              <AlertTriangle size={14} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-event-border">
          <span className="text-xs text-event-muted">{activeCount} table{activeCount !== 1 ? 's' : ''} total</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm bg-gold-500 text-white rounded-lg hover:bg-gold-600 disabled:opacity-60 transition-colors"
            >
              {saving ? 'Saving…' : 'Save Tables'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
