import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { ChairityEvent, Guest, SeatingTable, SeatAssignment } from '@/types'
import EditorLayout from '@/components/editor/EditorLayout'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EventPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: event } = await supabase.from('events').select('*').eq('id', id).single()
  if (!event) notFound()

  const isOwner = event.user_id === user.id

  const [{ data: guests }, { data: tables }] = await Promise.all([
    supabase.from('guests').select('*').eq('event_id', id).order('name'),
    supabase.from('seating_tables').select('*').eq('event_id', id).order('sort_order'),
  ])

  const tableIds = (tables ?? []).map((t) => t.id)
  const { data: assignments } = tableIds.length
    ? await supabase.from('seat_assignments').select('*').in('table_id', tableIds)
    : { data: [] }

  return (
    <EditorLayout
      event={event as ChairityEvent}
      initialGuests={(guests ?? []) as Guest[]}
      initialTables={(tables ?? []) as SeatingTable[]}
      initialAssignments={(assignments ?? []) as SeatAssignment[]}
      isOwner={isOwner}
    />
  )
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('events').select('name').eq('id', id).single()
  return { title: data?.name ? `${data.name} — Chairity` : 'Event Editor — Chairity' }
}
