'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

interface Props {
  token: string
}

export default function AcceptInvite({ token }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [eventName, setEventName] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function accept() {
      const { data, error } = await supabase.rpc('accept_event_invite', { p_token: token })

      if (error || !data?.length) {
        setErrorMsg(error?.message ?? 'Invalid or expired invite link.')
        setStatus('error')
        return
      }

      setEventName(data[0].event_name)
      setStatus('success')

      setTimeout(() => router.push(`/events/${data[0].event_id}`), 1500)
    }

    accept()
  }, [token])

  return (
    <div className="min-h-screen bg-event-bg flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-event-border shadow-card p-10 max-w-sm w-full text-center space-y-4">
        {status === 'loading' && (
          <>
            <Loader2 size={40} className="text-gold-400 animate-spin mx-auto" />
            <p className="text-gray-600 text-sm">Joining event…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle size={40} className="text-green-500 mx-auto" />
            <h2 className="font-display text-xl font-semibold text-gray-800">You're in!</h2>
            <p className="text-gray-500 text-sm">
              Joined <strong>{eventName}</strong>. Redirecting to the editor…
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle size={40} className="text-red-400 mx-auto" />
            <h2 className="font-display text-xl font-semibold text-gray-800">Invalid link</h2>
            <p className="text-gray-500 text-sm">{errorMsg}</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-2 px-4 py-2 text-sm bg-gold-500 text-white rounded-lg hover:bg-gold-600 transition-colors"
            >
              Go to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  )
}
