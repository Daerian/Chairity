'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Copy, Check, RefreshCw, Trash2, Users, Loader2, QrCode } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import type { Collaborator } from '@/types'

interface Props {
  eventId: string
  inviteToken: string
  showSeatNumbers: boolean
  onClose: () => void
  onTokenRegenerated: (newToken: string) => void
  onShowSeatNumbersChange: (value: boolean) => void
}

export default function ShareModal({
  eventId, inviteToken, showSeatNumbers, onClose, onTokenRegenerated, onShowSeatNumbersChange,
}: Props) {
  const supabase = createClient()
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [copiedView, setCopiedView] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [currentToken, setCurrentToken] = useState(inviteToken)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const inviteUrl = `${origin}/invite/${currentToken}`
  const viewUrl = `${origin}/events/${eventId}/view`

  const fetchCollaborators = useCallback(async () => {
    const { data } = await supabase
      .from('event_collaborators')
      .select('*, profiles(id, email, full_name, avatar_url)')
      .eq('event_id', eventId)
      .order('created_at')
    setCollaborators((data ?? []) as Collaborator[])
    setLoading(false)
  }, [eventId])

  useEffect(() => { fetchCollaborators() }, [fetchCollaborators])

  async function copyLink() {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function copyViewLink() {
    await navigator.clipboard.writeText(viewUrl)
    setCopiedView(true)
    setTimeout(() => setCopiedView(false), 2000)
  }

  async function regenerateToken() {
    if (!confirm('Regenerate the invite link? The old link will stop working immediately.')) return
    setRegenerating(true)
    const newToken = crypto.randomUUID()
    await supabase.from('events').update({ invite_token: newToken }).eq('id', eventId)
    setCurrentToken(newToken)
    onTokenRegenerated(newToken)
    setRegenerating(false)
  }

  async function removeCollaborator(collaboratorId: string) {
    await supabase.from('event_collaborators').delete().eq('id', collaboratorId)
    setCollaborators((prev) => prev.filter((c) => c.id !== collaboratorId))
  }

  async function toggleShowSeatNumbers() {
    const next = !showSeatNumbers
    onShowSeatNumbersChange(next)
    await supabase.from('events').update({ show_seat_numbers: next }).eq('id', eventId)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-event-border">
          <h2 className="font-display text-lg font-semibold">Share Event</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Guest view QR code */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <QrCode size={14} className="text-gold-600" />
              <label className="text-sm font-medium text-gray-700">Guest view</label>
            </div>
            <p className="text-xs text-event-muted">
              Display this QR code at your event so guests can scan it to find their table — no sign-in required.
            </p>
            <div className="flex gap-4 items-start">
              <div className="p-3 bg-white border border-event-border rounded-xl shadow-sm shrink-0">
                {viewUrl ? (
                  <QRCodeSVG value={viewUrl} size={120} bgColor="#ffffff" fgColor="#1a1a1a" />
                ) : (
                  <div className="w-[120px] h-[120px] bg-gray-50 rounded" />
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-xs text-event-muted break-all leading-relaxed">{viewUrl}</p>
                <button
                  onClick={copyViewLink}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gold-500 text-white rounded-lg hover:bg-gold-600 transition-colors"
                >
                  {copiedView ? <Check size={13} /> : <Copy size={13} />}
                  {copiedView ? 'Copied!' : 'Copy link'}
                </button>
                <a
                  href={viewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs text-gold-600 hover:text-gold-700 transition-colors"
                >
                  Open guest view ↗
                </a>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleShowSeatNumbers}
              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-event-border hover:border-gold-300 hover:bg-gold-50 transition-colors text-left"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-700">Show seat numbers</p>
                <p className="text-xs text-event-muted mt-0.5">
                  When off, guests only see their table — not the seat.
                </p>
              </div>
              <span
                aria-hidden
                className={`relative shrink-0 inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  showSeatNumbers ? 'bg-gold-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    showSeatNumbers ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </span>
            </button>
          </div>

          <div className="border-t border-event-border" />

          {/* Invite link */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Invite link</label>
            <p className="text-xs text-event-muted">Anyone with this link can join as an editor after signing in.</p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={inviteUrl}
                className="flex-1 min-w-0 px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none text-gray-600 truncate"
              />
              <button
                onClick={copyLink}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm bg-gold-500 text-white rounded-lg hover:bg-gold-600 transition-colors"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <button
              onClick={regenerateToken}
              disabled={regenerating}
              className="flex items-center gap-1.5 text-xs text-event-muted hover:text-red-500 transition-colors"
            >
              {regenerating ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
              Regenerate link (invalidates old one)
            </button>
          </div>

          {/* Collaborators list */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Users size={14} />
              <span>Editors with access</span>
              {!loading && <span className="text-event-muted font-normal">({collaborators.length})</span>}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={20} className="animate-spin text-gold-400" />
              </div>
            ) : collaborators.length === 0 ? (
              <p className="text-sm text-event-muted py-3 text-center">No collaborators yet. Share the link above to invite someone.</p>
            ) : (
              <div className="space-y-1.5">
                {collaborators.map((c) => {
                  const profile = c.profiles
                  const display = profile?.full_name || profile?.email || 'Unknown user'
                  const initial = display[0].toUpperCase()
                  return (
                    <div key={c.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
                      <div className="w-7 h-7 rounded-full bg-gold-200 flex items-center justify-center text-xs font-semibold text-gold-700 shrink-0">
                        {initial}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{display}</p>
                        {profile?.full_name && profile.email && (
                          <p className="text-xs text-event-muted truncate">{profile.email}</p>
                        )}
                      </div>
                      <button
                        onClick={() => removeCollaborator(c.id)}
                        className="shrink-0 text-gray-300 hover:text-red-400 transition-colors"
                        title="Remove access"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-event-border flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
