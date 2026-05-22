import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { ChairityEvent } from '@/types'
import DashboardView from '@/components/dashboard/DashboardView'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .order('updated_at', { ascending: false })

  return (
    <DashboardView
      user={{ id: user.id, email: user.email ?? '', avatar: user.user_metadata?.avatar_url }}
      events={(events ?? []) as ChairityEvent[]}
    />
  )
}
