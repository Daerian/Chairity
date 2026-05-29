'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { ChairityEvent } from '@/types'

export async function createEvent(payload: {
  name: string
  date: string
  description: string
}): Promise<ChairityEvent> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data, error } = await supabase
    .from('events')
    .insert({
      user_id: user.id,
      name: payload.name,
      description: payload.description || null,
      event_date: payload.date || null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as ChairityEvent
}
