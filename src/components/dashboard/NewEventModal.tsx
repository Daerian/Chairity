'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, AlertTriangle } from 'lucide-react'
import type { ChairityEvent } from '@/types'

interface Props {
  userId: string
  onClose: () => void
  onCreate: (event: ChairityEvent) => void
}

export default function NewEventModal({ userId, onClose, onCreate }: Props) {
  const supabase = createClient()
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    const trimmedName = name.trim()
    if (!trimmedName) { setError('Event name is required.'); return }
    setError('')
    setSaving(true)

    const { data, error: dbError } = await supabase
      .from('events')
      .insert({
        user_id: userId,
        name: trimmedName,
        description: description.trim() || null,
        event_date: date || null,
      })
      .select()
      .single()

    setSaving(false)
    if (dbError) { setError(dbError.message); return }
    onCreate(data as ChairityEvent)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-event-border">
          <h2 className="font-display text-lg font-semibold">New Event</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-gray-700">Event Name *</span>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="e.g. Annual Gala 2026"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-gold-400 transition-colors"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-gray-700">Date (optional)</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-gold-400 transition-colors"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-gray-700">Description (optional)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any notes about the event…"
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-gold-400 transition-colors resize-none"
            />
          </label>

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
            onClick={handleCreate}
            disabled={saving}
            className="px-4 py-2 text-sm bg-gold-500 text-white rounded-lg hover:bg-gold-600 disabled:opacity-60 transition-colors"
          >
            {saving ? 'Creating…' : 'Create Event'}
          </button>
        </div>
      </div>
    </div>
  )
}
