'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type ManagedLeague = {
  id: string
  name: string
  event_id: string | null
  draft_status: string | null
  created_by: string | null
  created_at: string | null
  roster_size: number | null
  max_members: number | null
}

type ManagedLeagueStats = {
  memberCount: number
  draftedCount: number
}

type StatusType = 'idle' | 'loading' | 'success' | 'error'

type DraftAction = 'lottery' | 'start' | 'pause' | 'resume' | 'reset'

function formatDateTime(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString([], {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function AdminPage() {
  const supabase = useMemo(() => createClient(), [])

  const [authUser, setAuthUser] = useState<any>(null)
  const [email, setEmail] = useState('amacbfs@gmail.com')
  const [password, setPassword] = useState('')
  const [isSigningIn, setIsSigningIn] = useState(false)

  const [managedLeagues, setManagedLeagues] = useState<ManagedLeague[]>([])
  const [leagueStats, setLeagueStats] = useState<Record<string, ManagedLeagueStats>>({})
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null)

  const [status, setStatus] = useState<StatusType>('idle')
  const [message, setMessage] = useState('')

  const [activeActionByLeague, setActiveActionByLeague] = useState<Record<string, DraftAction | null>>({})

  function setStatusMessage(nextStatus: StatusType, nextMessage: string) {
    setStatus(nextStatus)
    setMessage(nextMessage)
  }

  async function loadData() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    setAuthUser(user ?? null)

    if (!user) {
      setManagedLeagues([])
      setLeagueStats({})
      setSelectedLeagueId(null)
      return
    }

    const { data: leaguesData, error: leaguesError } = await supabase
      .from('leagues_v2')
      .select('id, name, event_id, draft_status, created_by, created_at, roster_size, max_members')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })

    if (leaguesError) {
      setStatusMessage('error', leaguesError.message || 'Failed to load managed leagues.')
      return
    }

    const leagues = (leaguesData ?? []) as ManagedLeague[]
    setManagedLeagues(leagues)

    if (leagues.length > 0) {
      setSelectedLeagueId((current) => {
        if (current && leagues.some((league) => league.id === current)) return current
        return leagues[0].id
      })
    } else {
      setSelectedLeagueId(null)
    }

    const statsEntries = await Promise.all(
      leagues.map(async (league) => {
        const [{ count: memberCount }, { count: draftedCount }] = await Promise.all([
          supabase
            .from('league_members_v2')
            .select('*', { count: 'exact', head: true })
            .eq('league_id', league.id),
          supabase
            .from('drafted_board_v2')
            .select('*', { count: 'exact', head: true })
            .eq('league_id', league.id),
        ])

        return [
          league.id,
          {
            memberCount: memberCount ?? 0,
            draftedCount: draftedCount ?? 0,
          },
        ] as const
      })
    )

    setLeagueStats(Object.fromEntries(statsEntries))
  }

  useEffect(() => {
    loadData()
  }, [])

  const selectedLeague =
    managedLeagues.find((league) => league.id === selectedLeagueId) ?? null

  function renderStatusBanner() {
    if (status === 'idle' || !message) return null

    const classes =
      status === 'success'
        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
        : status === 'error'
        ? 'border-red-500/40 bg-red-500/10 text-red-200'
        : 'border-blue-500/40 bg-blue-500/10 text-blue-200'

    return (
      <div className={`rounded-2xl border px-4 py-3 text-sm ${classes}`}>
        {message}
      </div>
    )
  }

  async function signInWithPassword() {
    if (!email.trim() || !password.trim()) {
      setStatusMessage('error', 'Please enter both email and password.')
      return
    }

    setIsSigningIn(true)
    setStatusMessage('loading', 'Signing in...')

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setIsSigningIn(false)
      setStatusMessage('error', error.message || 'Failed to sign in.')
      return
    }

    await loadData()
    setIsSigningIn(false)
    setStatusMessage('success', 'Signed in successfully.')
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.reload()
  }

  async function runDraftAction(leagueId: string, action: DraftAction) {
    setActiveActionByLeague((prev) => ({ ...prev, [leagueId]: action }))
    setStatusMessage('loading', `${action} in progress...`)

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
        setStatusMessage('error', payload?.error ?? `Unable to ${action} draft`)
        return
      }

      const successLabelMap: Record<DraftAction, string> = {
        lottery: 'Draft lottery completed.',
        start: 'Draft started successfully.',
        pause: 'Draft paused successfully.',
        resume: 'Draft resumed successfully.',
        reset: 'Draft reset successfully.',
      }

      await loadData()
      setStatusMessage('success', successLabelMap[action])
    } catch (error) {
      setStatusMessage(
        'error',
        error instanceof Error ? error.message : `Unexpected error during ${action}`
      )
    } finally {
      setActiveActionByLeague((prev) => ({ ...prev, [leagueId]: null }))
    }
  }

  function getActionLabel(leagueId: string, action: DraftAction, defaultLabel: string) {
    return activeActionByLeague[leagueId] === action ? 'Working...' : defaultLabel
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Admin Control Center
          </h1>
          <p className="mt-2 text-sm text-slate-300 sm:text-base">
            Central admin surface for leagues you manage across sports.
          </p>
        </div>

        {authUser ? (
          <button
            onClick={signOut}
            className="w-full rounded-xl border border-slate-600 bg-[#172033] px-4 py-2 text-sm text-white transition hover:bg-[#1c2940] sm:w-auto"
          >
            Sign Out
          </button>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur sm:p-6">
        <div>
          <div className="text-sm font-medium uppercase tracking-wide text-slate-400">
            Admin Access
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            {authUser ? 'Signed In' : 'Commissioner Sign In Required'}
          </div>
          <div className="mt-2 text-sm text-slate-300">
            {authUser?.email ?? 'Not signed in'}
          </div>
        </div>

        {!authUser ? (
          <div className="mt-5 max-w-md rounded-2xl border border-slate-700/80 bg-[#172033] p-4">
            <div className="text-base font-semibold text-white">
              Commissioner Email Login
            </div>
            <div className="mt-1 text-sm text-slate-300">
              Sign in with the account that created your managed leagues
            </div>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your commissioner email"
              className="mt-4 w-full rounded-xl border border-slate-600 bg-[#0f172a] px-3 py-2 text-white placeholder:text-slate-400 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
              autoComplete="email"
            />

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="mt-3 w-full rounded-xl border border-slate-600 bg-[#0f172a] px-3 py-2 text-white placeholder:text-slate-400 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
              autoComplete="current-password"
            />

            <button
              onClick={signInWithPassword}
              disabled={isSigningIn}
              className="mt-3 rounded-xl bg-slate-950 px-4 py-2 text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {isSigningIn ? 'Signing In...' : 'Sign In'}
            </button>
          </div>
        ) : null}
      </section>

      {renderStatusBanner()}

      {authUser ? (
        <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur sm:p-6">
              <h2 className="text-xl font-semibold text-white">Managed PGA Leagues</h2>

              <div className="mt-4 space-y-3">
                {managedLeagues.length === 0 ? (
                  <div className="rounded-2xl border border-slate-700/80 bg-[#172033] p-4 text-sm text-slate-300">
                    No `leagues_v2` found where you are the creator.
                  </div>
                ) : (
                  managedLeagues.map((league) => {
                    const isSelected = selectedLeagueId === league.id
                    const stats = leagueStats[league.id] ?? {
                      memberCount: 0,
                      draftedCount: 0,
                    }

                    return (
                      <button
                        key={league.id}
                        type="button"
                        onClick={() => setSelectedLeagueId(league.id)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-500/10'
                            : 'border-slate-700/80 bg-[#172033] hover:bg-[#1c2940]'
                        }`}
                      >
                        <div className="text-sm font-semibold text-white">{league.name}</div>
                        <div className="mt-2 space-y-1 text-xs text-slate-400">
                          <div>Status: {league.draft_status ?? '—'}</div>
                          <div>Members: {stats.memberCount}</div>
                          <div>Picks made: {stats.draftedCount}</div>
                          <div>Created: {formatDateTime(league.created_at)}</div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur sm:p-6">
              <h2 className="text-xl font-semibold text-white">Legacy NCAA Tools</h2>
              <p className="mt-2 text-sm text-slate-300">
                Your existing NCAA commissioner experience remains available here.
              </p>

              <div className="mt-4">
                <Link
                  href="/admin/ncaa"
                  className="block rounded-xl border border-slate-700/80 bg-[#172033] px-4 py-3 text-white transition hover:bg-[#1c2940]"
                >
                  Open NCAA Admin
                </Link>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {selectedLeague ? (
              <>
                <section className="rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h2 className="text-2xl font-semibold text-white">
                        {selectedLeague.name}
                      </h2>
                      <div className="mt-2 space-y-1 text-sm text-slate-300">
                        <div>League ID: {selectedLeague.id}</div>
                        <div>Event ID: {selectedLeague.event_id ?? '—'}</div>
                        <div>Draft Status: {selectedLeague.draft_status ?? '—'}</div>
                        <div>Roster Size: {selectedLeague.roster_size ?? '—'}</div>
                        <div>Max Members: {selectedLeague.max_members ?? '—'}</div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      <button
                        type="button"
                        onClick={() => runDraftAction(selectedLeague.id, 'lottery')}
                        disabled={!!activeActionByLeague[selectedLeague.id]}
                        className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {getActionLabel(selectedLeague.id, 'lottery', 'Run Lottery')}
                      </button>

                      <button
                        type="button"
                        onClick={() => runDraftAction(selectedLeague.id, 'start')}
                        disabled={!!activeActionByLeague[selectedLeague.id]}
                        className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {getActionLabel(selectedLeague.id, 'start', 'Start Draft')}
                      </button>

                      <button
                        type="button"
                        onClick={() => runDraftAction(selectedLeague.id, 'pause')}
                        disabled={!!activeActionByLeague[selectedLeague.id]}
                        className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {getActionLabel(selectedLeague.id, 'pause', 'Pause')}
                      </button>

                      <button
                        type="button"
                        onClick={() => runDraftAction(selectedLeague.id, 'resume')}
                        disabled={!!activeActionByLeague[selectedLeague.id]}
                        className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {getActionLabel(selectedLeague.id, 'resume', 'Resume')}
                      </button>

                      <button
                        type="button"
                        onClick={() => runDraftAction(selectedLeague.id, 'reset')}
                        disabled={!!activeActionByLeague[selectedLeague.id]}
                        className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-3 text-sm font-medium text-red-200 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {getActionLabel(selectedLeague.id, 'reset', 'Reset Draft')}
                      </button>
                    </div>
                  </div>
                </section>

                <section className="grid gap-6 xl:grid-cols-2">
                  <div className="rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur sm:p-6">
                    <h3 className="text-xl font-semibold text-white">League Navigation</h3>

                    <div className="mt-4 grid gap-3">
                      <Link
                        href={`/masters/${selectedLeague.id}`}
                        className="rounded-xl border border-slate-700/80 bg-[#172033] px-4 py-3 text-white transition hover:bg-[#1c2940]"
                      >
                        League Home
                      </Link>

                      <Link
                        href={`/masters/${selectedLeague.id}/draft`}
                        className="rounded-xl border border-slate-700/80 bg-[#172033] px-4 py-3 text-white transition hover:bg-[#1c2940]"
                      >
                        Draft Room
                      </Link>

                      <Link
                        href={`/masters/${selectedLeague.id}/hub`}
                        className="rounded-xl border border-slate-700/80 bg-[#172033] px-4 py-3 text-white transition hover:bg-[#1c2940]"
                      >
                        Hub
                      </Link>

                      <Link
                        href={`/masters/${selectedLeague.id}/leaderboard`}
                        className="rounded-xl border border-slate-700/80 bg-[#172033] px-4 py-3 text-white transition hover:bg-[#1c2940]"
                      >
                        Leaderboard
                      </Link>

                      <Link
                        href={`/masters/${selectedLeague.id}/rosters`}
                        className="rounded-xl border border-slate-700/80 bg-[#172033] px-4 py-3 text-white transition hover:bg-[#1c2940]"
                      >
                        Rosters
                      </Link>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur sm:p-6">
                    <h3 className="text-xl font-semibold text-white">League Readiness</h3>

                    <div className="mt-4 space-y-3 text-sm text-slate-300">
                      <div className="rounded-xl border border-slate-700/80 bg-[#172033] p-4">
                        PGA admin now keys off <span className="font-semibold text-white">leagues_v2.created_by</span>, not a nonexistent role field in `league_members_v2`.
                      </div>

                      <div className="rounded-xl border border-slate-700/80 bg-[#172033] p-4">
                        This selected league currently needs a full event field sized appropriately for the draft before a complete live draft can run end-to-end.
                      </div>

                      <div className="rounded-xl border border-slate-700/80 bg-[#172033] p-4">
                        Once event competitors are fully populated, this page becomes your control center for start / pause / resume / reset across managed PGA leagues.
                      </div>
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <section className="rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-6 text-slate-300 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur">
                No managed PGA leagues found yet.
              </section>
            )}
          </div>
        </section>
      ) : null}
    </div>
  )
}