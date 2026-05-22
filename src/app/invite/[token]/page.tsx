import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AcceptInvite from '@/components/invite/AcceptInvite'

interface Props {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/?next=/invite/${token}`)
  }

  return <AcceptInvite token={token} />
}

export const metadata = { title: 'Join Event — Chairity' }
