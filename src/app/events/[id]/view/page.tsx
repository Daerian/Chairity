import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Guest, SeatingTable, SeatAssignment } from '@/types'
import EventViewer from '@/components/viewer/EventViewer'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EventViewPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: event } = await supabase
    .from('events')
    .select('id, name, event_date')
    .eq('id', id)
    .single()

  if (!event) notFound()

  const [{ data: guests }, { data: tables }] = await Promise.all([
    supabase.from('guests').select('*').eq('event_id', id).order('name'),
    supabase.from('seating_tables').select('*').eq('event_id', id).order('sort_order'),
  ])

  const tableIds = (tables ?? []).map((t) => t.id)
  const { data: assignments } = tableIds.length
    ? await supabase.from('seat_assignments').select('*').in('table_id', tableIds)
    : { data: [] }

  return (
    <EventViewer
      event={event}
      guests={(guests ?? []) as Guest[]}
      tables={(tables ?? []) as SeatingTable[]}
      assignments={(assignments ?? []) as SeatAssignment[]}
    />
  )
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('events').select('name').eq('id', id).single()
  return { title: data?.name ? `${data.name} — Find Your Seat` : 'Find Your Seat — Chairity' }
}
