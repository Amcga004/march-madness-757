'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { AvailablePlayer } from '@/lib/masters/types'

type Props = {
  leagueId: string
  players: AvailablePlayer[]
  canDraft?: boolean
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function compareNullableNumberAsc(a: number | null, b: number | null) {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return a - b
}

function sortPlayers(players: AvailablePlayer[]) {
  return [...players].sort((a, b) => {
    const aMeta = a as AvailablePlayer & Record<string, unknown>
    const bMeta = b as AvailablePlayer & Record<string, unknown>

    const aWorldRank = readNumber(aMeta.world_rank)
    const bWorldRank = readNumber(bMeta.world_rank)

    const worldRankCompare = compareNullableNumberAsc(aWorldRank, bWorldRank)
    if (worldRankCompare !== 0) return worldRankCompare

    const aFedex = readNumber(aMeta.fedex_points)
    const bFedex = readNumber(bMeta.fedex_points)

    if (aFedex == null && bFedex == null) {
      return a.player_name.localeCompare(b.player_name)
    }

    if (aFedex == null) return 1
    if (bFedex == null) return -1

    if (aFedex !== bFedex) {
      return bFedex - aFedex
    }

    return a.player_name.localeCompare(b.player_name)
  })
}

export default function AvailablePlayersList({
  leagueId,
  players,
  canDraft = false,
}: Props) {
  const router = useRouter()

  const [query, setQuery] = useState('')
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filteredPlayers = useMemo(() => {
    const sorted = sortPlayers(players)
    const q = query.trim().toLowerCase()

    if (!q) return sorted

    return sorted.filter((player) =>
      player.player_name.toLowerCase().includes(q)
    )
  }, [players, query])

  async function handleDraftNow(competitorId: string, playerName: string) {
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const res = await fetch('/api/draft/pick', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leagueId,
          competitorId,
        }),
      })

      const payload = await res.json()

      if (!res.ok) {
        setErrorMessage(payload?.error ?? 'Unable to submit draft pick')
        return
      }

      setSuccessMessage(`${playerName} drafted successfully`)
      setSelectedPlayerId(null)

      startTransition(() => {
        router.refresh()
      })
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unexpected error submitting pick'
      )
    }
  }

  return (
    <div className="rounded-[20px] border border-[#d9ddcf] bg-[linear-gradient(180deg,#fffefb_0%,#f8f8f3_100%)] p-3 shadow-[0_8px_20px_rgba(16,24,40,0.05)] md:rounded-[24px] md:p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6f7a67] md:text-[11px]">
            Players
          </h3>
          <p className="mt-0.5 text-[11px] text-[#788274]">
            Sorted by rank, FedEx points, then name
          </p>
        </div>

        <div className="rounded-full border border-[#d9ddcf] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#425040]">
          {filteredPlayers.length}
        </div>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search players..."
        className="mb-2.5 w-full rounded-xl border border-[#d9ddcf] bg-white px-3 py-2.5 text-[13px] text-[#162317] outline-none placeholder:text-[#8b9385]"
      />

      {errorMessage ? (
        <div className="mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="mb-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-[#e2e6dc] bg-white">
        <div className="max-h-[640px] overflow-y-auto overscroll-contain md:max-h-[700px]">
          {filteredPlayers.length === 0 ? (
            <div className="px-3 py-4 text-sm text-[#667065]">
              No matching players found.
            </div>
          ) : (
            filteredPlayers.map((player, index) => {
              const isSelected = selectedPlayerId === player.competitor_id
              const meta = player as AvailablePlayer & Record<string, unknown>

              const worldRank = readNumber(meta.world_rank)
              const fedexPoints = readNumber(meta.fedex_points)
              const top10Finishes = readNumber(meta.top_10_finishes)

              return (
                <div
                  key={player.competitor_id}
                  className={`${
                    index !== filteredPlayers.length - 1
                      ? 'border-b border-[#edf0e8]'
                      : ''
                  } ${isSelected ? 'bg-[#f4f9f5]' : 'bg-white'}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPlayerId((prev) =>
                        prev === player.competitor_id ? null : player.competitor_id
                      )
                      setErrorMessage(null)
                      setSuccessMessage(null)
                    }}
                    className="w-full px-3 py-2.5 text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[13px] font-semibold text-[#162317] md:text-sm">
                            {player.player_name}
                          </p>
                          {player.country ? (
                            <span className="shrink-0 rounded-full bg-[#eef2ea] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#5f6d60]">
                              {player.country}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#6f7a67] md:text-[11px]">
                          <span>Rank {worldRank ?? '—'}</span>
                          <span>FedEx {fedexPoints ?? '—'}</span>
                          <span>Top 10s {top10Finishes ?? '—'}</span>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {canDraft ? (
                          <span className="inline-flex items-center rounded-full border border-[#d9ddcf] bg-[#f8faf6] px-2.5 py-1 text-[10px] font-semibold text-[#425040]">
                            {isSelected ? 'Ready' : 'Draft'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-[#d9ddcf] bg-[#f8faf6] px-2.5 py-1 text-[10px] font-semibold text-[#788274]">
                            View
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  {isSelected ? (
                    <div className="border-t border-[#e2e6dc] bg-[#fbfcf8] px-3 py-2.5">
                      {canDraft ? (
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[9px] uppercase tracking-[0.16em] text-[#0b5d3b]">
                              Selected
                            </p>
                            <p className="mt-0.5 truncate text-[13px] font-semibold text-[#162317]">
                              {player.player_name}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              handleDraftNow(player.competitor_id, player.player_name)
                            }
                            disabled={isPending}
                            className="shrink-0 rounded-xl bg-[#0b5d3b] px-3 py-2 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isPending ? 'Submitting...' : 'Draft'}
                          </button>
                        </div>
                      ) : (
                        <div>
                          <p className="text-[9px] uppercase tracking-[0.16em] text-[#788274]">
                            Player Selected
                          </p>
                          <p className="mt-0.5 text-[13px] font-semibold text-[#162317]">
                            {player.player_name}
                          </p>
                          <p className="mt-1 text-[11px] text-[#788274]">
                            Drafting is only available when it is your turn.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}