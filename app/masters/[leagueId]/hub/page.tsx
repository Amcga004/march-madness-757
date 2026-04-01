import { redirect } from 'next/navigation'
import DraftRoomHeader from '@/app/components/masters/DraftRoomHeader'
import EventHubNav from '@/app/components/masters/EventHubNav'
import FantasyStandingsCard from '@/app/components/masters/FantasyStandingsCard'
import LiveTournamentCard from '@/app/components/masters/LiveTournamentCard'
import SyncLiveButton from '@/app/components/masters/SyncLiveButton'
import LeaguePulseCard from '@/app/components/masters/LeaguePulseCard'
import TopContributorsCard from '@/app/components/masters/TopContributorsCard'
import { getEventHubData } from '@/lib/golf/queries'

type PageProps = {
  params: Promise<{ leagueId: string }>
}

export default async function MastersHubPage({ params }: PageProps) {
  const { leagueId } = await params
  const {
    league,
    livePlayers,
    fantasyStandings,
    topContributors,
    leaguePulse,
  } = await getEventHubData(leagueId)

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
      </div>

      <EventHubNav leagueId={leagueId} />
    </main>
  )
}