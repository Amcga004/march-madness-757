'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  visible: boolean
  leagueId: string
}

type DraftAction = 'lottery' | 'start' | 'pause' | 'resume' | 'reset' | null

export default function CommissionerControls({ visible, leagueId }: Props) {
  const router = useRouter()
  const [activeAction, setActiveAction] = useState<DraftAction>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (!visible) return null

  async function runAction(action: Exclude<DraftAction, null>) {
    setActiveAction(action)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const res = await fetch(`/api/draft/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ leagueId }),
      })

      const payload = await res.json()

      if (!res.ok) {
        setErrorMessage(payload?.error ?? `Unable to ${action} draft`)
        setActiveAction(null)
        return
      }

      const successLabels: Record<Exclude<DraftAction, null>, string> = {
        lottery: 'Lottery completed',
        start: 'Draft started',
        pause: 'Draft paused',
        resume: 'Draft resumed',
        reset: 'Draft reset',
      }

      setSuccessMessage(successLabels[action])

      startTransition(() => {
        router.refresh()
      })
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : `Unexpected error during ${action}`
      )
    } finally {
      setActiveAction(null)
    }
  }

  function getButtonLabel(action: Exclude<DraftAction, null>, defaultLabel: string) {
    if (activeAction === action || isPending) {
      return 'Working...'
    }
    return defaultLabel
  }

  const disabled = isPending || activeAction !== null

  return (
    <div className="rounded-[24px] border border-[#d9ddcf] bg-[linear-gradient(180deg,#fffefb_0%,#f7f7f1_100%)] p-4 shadow-[0_10px_24px_rgba(16,24,40,0.06)]">
      <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6f7a67]">
        Commissioner Controls
      </h3>

      {errorMessage ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <button
          type="button"
          disabled={disabled}
          onClick={() => runAction('lottery')}
          className="rounded-xl border border-[#d9ddcf] bg-white px-4 py-3 text-sm font-medium text-[#243126] transition hover:bg-[#f7f7f1] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {getButtonLabel('lottery', 'Run Lottery')}
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => runAction('start')}
          className="rounded-xl border border-[#d9ddcf] bg-white px-4 py-3 text-sm font-medium text-[#243126] transition hover:bg-[#f7f7f1] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {getButtonLabel('start', 'Start Draft')}
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => runAction('pause')}
          className="rounded-xl border border-[#d9ddcf] bg-white px-4 py-3 text-sm font-medium text-[#243126] transition hover:bg-[#f7f7f1] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {getButtonLabel('pause', 'Pause')}
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => runAction('resume')}
          className="rounded-xl border border-[#d9ddcf] bg-white px-4 py-3 text-sm font-medium text-[#243126] transition hover:bg-[#f7f7f1] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {getButtonLabel('resume', 'Resume')}
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => runAction('reset')}
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {getButtonLabel('reset', 'Reset Draft')}
        </button>
      </div>
    </div>
  )
}