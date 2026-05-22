import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { ChairityEvent } from '@/types'
import DashboardView from '@/components/dashboard/DashboardView'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: owned } = await supabase
    .from('events')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  const { data: collabRows } = await supabase
    .from('event_collaborators')
    .select('event_id, events(*)')
    .eq('user_id', user.id)

  const collabEvents = (collabRows ?? [])
    .map((r: { event_id: string; events: unknown }) => r.events)
    .filter(Boolean) as ChairityEvent[]

  const events = [
    ...((owned ?? []) as ChairityEvent[]),
    ...collabEvents.filter((e) => !(owned ?? []).find((o: ChairityEvent) => o.id === e.id)),
  ]

  return (
    <DashboardView
      user={{ id: user.id, email: user.email ?? '', avatar: user.user_metadata?.avatar_url }}
      events={events}
      ownedEventIds={new Set((owned ?? []).map((e: ChairityEvent) => e.id))}
    />
  )
}
