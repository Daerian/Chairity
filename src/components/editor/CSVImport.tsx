'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { parseCSV, extractNames } from '@/lib/csv'
import { X, Upload, FileText, AlertTriangle, Check } from 'lucide-react'
import type { Guest } from '@/types'

interface Props {
  eventId: string
  existingNames: Set<string>
  onClose: () => void
  onImport: (guests: Guest[]) => void
}

export default function CSVImport({ eventId, existingNames, onClose, onImport }: Props) {
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [selectedColumn, setSelectedColumn] = useState('')
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(file: File) {
    setError('')
    try {
      const { headers, rows } = await parseCSV(file)
      if (headers.length === 0) { setError('No columns found in CSV.'); return }
      setHeaders(headers)
      setRows(rows)
      setFileName(file.name)
      // Auto-pick a "name" column if one exists
      const nameCol = headers.find((h) => /name/i.test(h)) ?? headers[0]
      setSelectedColumn(nameCol)
    } catch {
      setError('Could not parse the CSV file. Make sure it has headers.')
    }
  }

  const names = selectedColumn ? extractNames(rows, selectedColumn) : []
  const newNames = names.filter((n) => !existingNames.has(n.toLowerCase()))
  const duplicateCount = names.length - newNames.length

  async function handleImport() {
    if (newNames.length === 0) return
    setImporting(true)
    const { data, error: dbError } = await supabase
      .from('guests')
      .insert(newNames.map((name) => ({ event_id: eventId, name })))
      .select()
    setImporting(false)
    if (dbError) { setError(dbError.message); return }
    onImport((data ?? []) as Guest[])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-event-border">
          <h2 className="font-display text-lg font-semibold">Import Guests from CSV</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Drop zone */}
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
            className="border-2 border-dashed border-gold-300 rounded-xl p-8 text-center cursor-pointer hover:bg-gold-50 hover:border-gold-400 transition-all"
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            {fileName ? (
              <div className="flex flex-col items-center gap-2">
                <FileText size={32} className="text-gold-400" />
                <span className="text-sm font-medium text-gray-700">{fileName}</span>
                <span className="text-xs text-event-muted">{rows.length} rows found</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload size={32} className="text-gold-300" />
                <p className="text-sm text-gray-600">Drop a CSV here, or click to browse</p>
                <p className="text-xs text-event-muted">Must have a header row</p>
              </div>
            )}
          </div>

          {/* Column selector */}
          {headers.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Which column has the guest names?</label>
              <select
                value={selectedColumn}
                onChange={(e) => setSelectedColumn(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-gold-400 bg-white"
              >
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          )}

          {/* Preview */}
          {names.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">{newNames.length} new guests to import</span>
                {duplicateCount > 0 && (
                  <span className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    {duplicateCount} already exist (skipped)
                  </span>
                )}
              </div>
              <div className="max-h-36 overflow-y-auto space-y-0.5">
                {newNames.slice(0, 50).map((name, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-600 py-0.5">
                    <Check size={10} className="text-green-400 shrink-0" />
                    {name}
                  </div>
                ))}
                {newNames.length > 50 && (
                  <p className="text-xs text-event-muted pt-1">…and {newNames.length - 50} more</p>
                )}
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

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-event-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={newNames.length === 0 || importing}
            className="px-4 py-2 text-sm bg-gold-500 text-white rounded-lg hover:bg-gold-600 disabled:opacity-50 transition-colors"
          >
            {importing ? 'Importing…' : `Import ${newNames.length} guest${newNames.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
