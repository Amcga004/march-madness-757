import { redirect } from 'next/navigation'
import DraftRoomHeader from '@/app/components/masters/DraftRoomHeader'
import EventHubNav from '@/app/components/masters/EventHubNav'
import FantasyStandingsCard from '@/app/components/masters/FantasyStandingsCard'
import LiveTournamentCard from '@/app/components/masters/LiveTournamentCard'
import SyncLiveButton from '@/app/components/masters/SyncLiveButton'
import LeaguePulseCard from '@/app/components/masters/LeaguePulseCard'
import TopContributorsCard from '@/app/components/masters/TopContributorsCard'
import { getEventHubData } from '@/lib/golf/queries'
import { getUser } from '@/lib/auth/authHelpers'
import InviteCopyButton from '@/app/components/masters/InviteCopyButton'

type PageProps = {
  params: Promise<{ leagueId: string }>
}

export default async function MastersHubPage({ params }: PageProps) {
  const { leagueId } = await params
  const [user, { league, livePlayers, fantasyStandings, topContributors, leaguePulse }] =
    await Promise.all([getUser(), getEventHubData(leagueId)])

  if (!league) {
    redirect('/')
  }

  return (
    <main className="min-h-screen bg-transparent px-2 py-3 text-[#162317] md:px-6 md:py-5">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 pb-24 md:gap-4">
        <DraftRoomHeader
          leagueName={league.name}
          eventName="Masters Event Hub"
          season={2026}
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

        {/* Invite link — visible to commissioner only */}
        {user?.id === league.created_by && (
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
              <InviteCopyButton url={`https://edgepulse.ai/join/${leagueId}`} />
            </div>
          </div>
        )}
      </div>

      <EventHubNav leagueId={leagueId} />
    </main>
  )
}