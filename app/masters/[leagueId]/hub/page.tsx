import { redirect } from 'next/navigation'
import DraftRoomHeader from '@/app/components/masters/DraftRoomHeader'
import EventHubNav from '@/app/components/masters/EventHubNav'
import FantasyStandingsCard from '@/app/components/masters/FantasyStandingsCard'
import LiveTournamentCard from '@/app/components/masters/LiveTournamentCard'
import SyncLiveButton from '@/app/components/masters/SyncLiveButton'
import LeaguePulseCard from '@/app/components/masters/LeaguePulseCard'
import TopContributorsCard from '@/app/components/masters/TopContributorsCard'
import InviteCopyButton from '@/app/components/masters/InviteCopyButton'
import StartDraftButton from '@/app/components/masters/StartDraftButton'
import DeleteLeagueButton from '@/app/components/masters/DeleteLeagueButton'
import { getEventHubData } from '@/lib/golf/queries'
import { getUser } from '@/lib/auth/authHelpers'

type PageProps = {
  params: Promise<{ leagueId: string }>
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'America/New_York',
    })
  } catch {
    return dateStr
  }
}

export default async function MastersHubPage({ params }: PageProps) {
  const { leagueId } = await params
  const [user, { league, platformEvent, memberCount, livePlayers, fantasyStandings, topContributors, leaguePulse }] =
    await Promise.all([getUser(), getEventHubData(leagueId)])

  if (!league) {
    redirect('/')
  }

  const isPredraft = league.draft_status === 'predraft'
  const isCommissioner = !!user && !!league.created_by && user.id === league.created_by
  const maxMembers = league.max_members ?? 8
  const isFull = memberCount >= maxMembers
  const inviteUrl = `https://edgepulse.ai/join/${leagueId}`

  if (isPredraft) {
    return (
      <main className="min-h-screen bg-transparent px-4 py-6 text-[#162317] md:px-6 md:py-8">
        <div className="mx-auto flex max-w-xl flex-col gap-5 pb-24">

          {/* League + event header */}
          <div className="rounded-2xl border border-[#d9ddcf] bg-white p-5 shadow-[0_4px_12px_rgba(16,24,40,0.04)]">
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#6f7a67]">
              Golf League
            </p>
            <h1 className="text-xl font-bold text-[#162317]">{league.name}</h1>
            {platformEvent && (
              <div className="mt-3 flex items-start gap-3 rounded-xl border border-[#d9ddcf] bg-[#f6f4ed] px-4 py-3">
                <span className="mt-0.5 text-lg">🏆</span>
                <div>
                  <p className="font-semibold text-[#162317]">{platformEvent.name}</p>
                  <p className="text-xs text-[#6f7a67]">
                    {platformEvent.starts_at ? formatDate(platformEvent.starts_at) : 'Date TBD'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Member count */}
          <div className="rounded-2xl border border-[#d9ddcf] bg-white p-5 shadow-[0_4px_12px_rgba(16,24,40,0.04)]">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#6f7a67]">
              Managers
            </p>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-[#162317]">
                {memberCount} <span className="text-base font-normal text-[#6f7a67]">of {maxMembers} joined</span>
              </p>
              <div className="flex gap-1">
                {Array.from({ length: maxMembers }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-3 w-3 rounded-full ${i < memberCount ? 'bg-[#0B5D3B]' : 'bg-[#d9ddcf]'}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Status banner */}
          {isFull ? (
            <div className="flex items-center gap-3 rounded-2xl border border-[#0B5D3B]/25 bg-[#0B5D3B]/8 px-5 py-4">
              <span className="text-lg">✅</span>
              <div>
                <p className="font-semibold text-[#0B5D3B]">Ready to Draft</p>
                <p className="text-xs text-[#0B5D3B]/70">All managers have joined. Commissioner can start the draft.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-[#C9A84C]/30 bg-[#C9A84C]/8 px-5 py-4">
              <span className="text-lg">⏳</span>
              <div>
                <p className="font-semibold text-[#9A7A28]">Waiting for Managers</p>
                <p className="text-xs text-[#9A7A28]/80">
                  {maxMembers - memberCount} more manager{maxMembers - memberCount !== 1 ? 's' : ''} needed before the draft can begin.
                </p>
              </div>
            </div>
          )}

          {/* Invite link — visible to all */}
          <div className="rounded-2xl border border-[#d9ddcf] bg-white p-5 shadow-[0_4px_12px_rgba(16,24,40,0.04)]">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#6f7a67]">
              Invite Link
            </p>
            <p className="mb-3 text-sm text-[#162317]">
              Share this link with managers to let them join.
            </p>
            <div className="flex items-center gap-2 rounded-xl border border-[#d9ddcf] bg-[#f6f4ed] px-4 py-2.5">
              <span className="flex-1 truncate font-mono text-[13px] text-[#162317]">
                edgepulse.ai/join/{leagueId}
              </span>
              <InviteCopyButton url={inviteUrl} />
            </div>
          </div>

          {/* Commissioner controls */}
          {isCommissioner && (
            <div className="rounded-2xl border border-[#d9ddcf] bg-white p-5 shadow-[0_4px_12px_rgba(16,24,40,0.04)]">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#6f7a67]">
                Commissioner
              </p>
              <p className="mb-4 text-sm text-[#6f7a67]">
                {isFull
                  ? 'League is full. You can start the draft when ready.'
                  : 'You can start the draft at any time, even before all managers join.'}
              </p>
              <StartDraftButton leagueId={leagueId} />
              <DeleteLeagueButton leagueId={leagueId} />
            </div>
          )}
        </div>

        <EventHubNav leagueId={leagueId} />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-transparent px-2 py-3 text-[#162317] md:px-6 md:py-5">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 pb-24 md:gap-4">
        <DraftRoomHeader
          leagueName={league.name}
          eventName={platformEvent?.name ?? 'Masters Event Hub'}
          season={platformEvent?.starts_at ? new Date(platformEvent.starts_at).getFullYear() : 2026}
          status={league.draft_status ?? 'live'}
        />

        <LeaguePulseCard
          leaderName={leaguePulse.leaderName}
          leaderPoints={leaguePulse.leaderPoints}
          activeGolfers={leaguePulse.activeGolfers}
          finishedGolfers={leaguePulse.finishedGolfers}
          draftedGolfers={leaguePulse.draftedGolfers}
        />

        <div className="grid gap-3 xl:grid-cols-[1.02fr_0.98fr] md:gap-4">
          <FantasyStandingsCard rows={fantasyStandings} />
          <TopContributorsCard rows={topContributors} />
        </div>

        <LiveTournamentCard rows={livePlayers} />

        <SyncLiveButton leagueId={leagueId} />

        {/* Invite link — visible to commissioner only during live play */}
        {isCommissioner && (
          <div className="rounded-2xl border border-[#d9ddcf] bg-white p-5 shadow-[0_4px_12px_rgba(16,24,40,0.04)]">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#6f7a67]">
              Invite Link
            </p>
            <p className="mb-3 text-sm text-[#162317]">
              Share this link with your managers to let them join.
            </p>
            <div className="flex items-center gap-2 rounded-xl border border-[#d9ddcf] bg-[#f6f4ed] px-4 py-2.5">
              <span className="flex-1 truncate font-mono text-[13px] text-[#162317]">
                edgepulse.ai/join/{leagueId}
              </span>
              <InviteCopyButton url={inviteUrl} />
            </div>
          </div>
        )}
      </div>

      <EventHubNav leagueId={leagueId} />
    </main>
  )
}
