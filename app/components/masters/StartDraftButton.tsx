'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  leagueId: string
}

export default function StartDraftButton({ leagueId }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleStart() {
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/draft/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leagueId }),
        })
        const payload = await res.json()
        if (!res.ok) {
          setError(payload?.error ?? 'Failed to start draft')
          return
        }
        router.push(`/masters/${leagueId}/draft`)
      } catch {
        setError('Unexpected error starting draft')
      }
    })
  }

  return (
    <div>
      <button
        onClick={handleStart}
        disabled={isPending}
        className="w-full rounded-xl bg-[#0B5D3B] px-4 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#0a4f32] disabled:opacity-50"
      >
        {isPending ? 'Starting Draft…' : 'Start Draft'}
      </button>
      {error && (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
