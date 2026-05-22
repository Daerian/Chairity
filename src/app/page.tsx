import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LoginPage from '@/components/auth/LoginPage'

interface Props {
  searchParams: Promise<{ next?: string }>
}

export default async function Home({ searchParams }: Props) {
  const { next } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect(next ?? '/dashboard')

  return <LoginPage redirectTo={next} />
}
