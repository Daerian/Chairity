'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, LogOut, Calendar, ChevronRight, Trash2, Users, Copy } from 'lucide-react'
import type { ChairityEvent } from '@/types'
import NewEventModal from './NewEventModal'
import ThemeSelector from '@/components/ThemeSelector'

interface Props {
  user: { id: string; email: string; avatar?: string }
  events: ChairityEvent[]
  ownedEventIds: Set<string>
}

export default function DashboardView({ user, events: initialEvents, ownedEventIds }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [events, setEvents] = useState(initialEvents)
  const [showNewModal, setShowNewModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this event and all its seating data? This cannot be undone.')) return
    setDeletingId(id)
    await supabase.from('events').delete().eq('id', id)
    setEvents((prev) => prev.filter((e) => e.id !== id))
    setDeletingId(null)
  }

  async function handleDuplicate(id: string) {
    const { data, error } = await supabase.rpc('duplicate_event', { p_event_id: id })
    if (error || !data) return
    const { data: newEvent } = await supabase.from('events').select('*').eq('id', data).single()
    if (newEvent) setEvents((prev) => [...prev, newEvent as ChairityEvent])
  }

  async function handleLeave(id: string) {
    if (!confirm('Leave this event? You will lose access unless re-invited.')) return
    await supabase.from('event_collaborators').delete().eq('event_id', id).eq('user_id', user.id)
    setEvents((prev) => prev.filter((e) => e.id !== id))
  }

  function handleEventCreated(event: ChairityEvent) {
    setShowNewModal(false)
    router.push(`/events/${event.id}`)
  }

  return (
    <div className="min-h-screen bg-event-bg">
      <header className="bg-white border-b border-event-border shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-sm">
              <span className="text-white font-display font-bold text-sm">C</span>
            </div>
            <span className="font-display text-lg font-semibold text-gray-800">Chairity</span>
          </div>
          <div className="flex items-center gap-3">
            {user.avatar && (
              <Image src={user.avatar} alt={user.email} width={28} height={28} className="rounded-full" />
            )}
            <span className="text-sm text-event-muted hidden sm:block">{user.email}</span>
            <ThemeSelector />
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:border-gray-300 transition-all"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-gray-800">Your Events</h1>
          <p className="mt-1 text-event-muted">Create and manage seating arrangements for your events.</p>
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          className="mb-6 flex items-center gap-2 px-4 py-2.5 bg-gold-500 text-white rounded-xl hover:bg-gold-600 transition-colors text-sm font-medium shadow-sm"
        >
          <Plus size={16} />
          New Event
        </button>

        {events.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-event-border">
            <Calendar size={48} className="text-gold-200 mx-auto mb-4" />
            <h2 className="font-display text-xl font-semibold text-gray-600">No events yet</h2>
            <p className="text-event-muted text-sm mt-1 mb-5">Create your first event to start arranging seats.</p>
            <button
              onClick={() => setShowNewModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gold-500 text-white rounded-xl hover:bg-gold-600 transition-colors text-sm font-medium"
            >
              <Plus size={16} />
              Create Event
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => {
              const isOwner = ownedEventIds.has(event.id)
              return (
                <div key={event.id} className="group relative bg-white rounded-2xl border border-event-border shadow-card hover:shadow-card-hover transition-all overflow-hidden">
                  <div className="h-1.5 bg-gradient-to-r from-gold-400 to-gold-600" />
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-lg font-semibold text-gray-800 truncate">{event.name}</h3>
                      {!isOwner && (
                        <span className="shrink-0 flex items-center gap-1 text-xs text-gold-600 bg-gold-50 px-2 py-0.5 rounded-full border border-gold-200">
                          <Users size={10} />
                          Shared
                        </span>
                      )}
                    </div>
                    {event.event_date && (
                      <p className="mt-1 text-xs text-event-muted flex items-center gap-1">
                        <Calendar size={11} />
                        {new Date(event.event_date).toLocaleDateString('en-US', { dateStyle: 'medium' })}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-400">
                      Updated {new Date(event.updated_at).toLocaleDateString('en-US', { dateStyle: 'short' })}
                    </p>
                    <div className="mt-4 flex items-center justify-between">
                      <Link href={`/events/${event.id}`} className="flex items-center gap-1.5 text-sm font-medium text-gold-600 hover:text-gold-700 transition-colors">
                        Open Editor <ChevronRight size={14} />
                      </Link>
                      {isOwner ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDuplicate(event.id)}
                            className="text-gray-300 hover:text-gold-500 transition-colors"
                            title="Duplicate event"
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(event.id)}
                            disabled={deletingId === event.id}
                            className="text-gray-300 hover:text-red-400 transition-colors"
                            title="Delete event"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleLeave(event.id)}
                          className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                          title="Leave event"
                        >
                          Leave
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {showNewModal && (
        <NewEventModal userId={user.id} onClose={() => setShowNewModal(false)} onCreate={handleEventCreated} />
      )}
    </div>
  )
}
