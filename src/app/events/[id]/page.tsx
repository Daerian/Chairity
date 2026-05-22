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

  const [{ data: event }, { data: guests }, { data: tables }, { data: assignments }] =
    await Promise.all([
      supabase.from('events').select('*').eq('id', id).eq('user_id', user.id).single(),
      supabase.from('guests').select('*').eq('event_id', id).order('name'),
      supabase.from('seating_tables').select('*').eq('event_id', id).order('sort_order'),
      supabase
        .from('seat_assignments')
        .select('*')
        .in('table_id', (await supabase.from('seating_tables').select('id').eq('event_id', id)).data?.map((t) => t.id) ?? []),
    ])

  if (!event) notFound()

  return (
    <EditorLayout
      event={event as ChairityEvent}
      initialGuests={(guests ?? []) as Guest[]}
      initialTables={(tables ?? []) as SeatingTable[]}
      initialAssignments={(assignments ?? []) as SeatAssignment[]}
    />
  )
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('events').select('name').eq('id', id).single()
  return { title: data?.name ? `${data.name} — Chairity` : 'Event Editor — Chairity' }
}
