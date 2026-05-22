'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Copy, Check, RefreshCw, Trash2, Users, Loader2 } from 'lucide-react'
import type { Collaborator } from '@/types'

interface Props {
  eventId: string
  inviteToken: string
  onClose: () => void
  onTokenRegenerated: (newToken: string) => void
}

export default function ShareModal({ eventId, inviteToken, onClose, onTokenRegenerated }: Props) {
  const supabase = createClient()
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [currentToken, setCurrentToken] = useState(inviteToken)

  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/invite/${currentToken}`
    : ''

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-event-border">
          <h2 className="font-display text-lg font-semibold">Share Event</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-6">
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
