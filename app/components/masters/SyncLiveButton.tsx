'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  leagueId: string
}

export default function SyncLiveButton({ leagueId }: Props) {
  const router = useRouter()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSync() {
    setMessage(null)
    setError(null)

    try {
      const res = await fetch('/api/golf/sync-live', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ leagueId }),
      })

      const payload = await res.json()

      if (!res.ok) {
        setError(payload?.error ?? 'Sync failed')
        return
      }

      setMessage(
        `Sync complete • field ${payload.fieldRowCount ?? 0} • live ${payload.liveRowCount ?? 0} • player ${payload.playerRowCount ?? 0} • manager ${payload.managerRowCount ?? 0} • primary ${payload.primarySource ?? 'unknown'}`
      )

      startTransition(() => router.refresh())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed')
    }
  }

  return (
    <div className="rounded-[24px] border border-[#d9ddcf] bg-[linear-gradient(180deg,#fffefb_0%,#f7f7f1_100%)] p-4 shadow-[0_10px_24px_rgba(16,24,40,0.06)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#162317]">Live Sync</p>
          <p className="text-xs text-[#788274]">
            Refreshes field, live state, fantasy scoring, and leaderboard state
          </p>
        </div>

        <button
          type="button"
          onClick={handleSync}
          disabled={isPending}
          className="rounded-xl bg-[#0b5d3b] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#094c31] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {message ? (
        <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  )
}