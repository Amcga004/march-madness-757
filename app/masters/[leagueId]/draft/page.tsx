import CurrentTurnBanner from '@/app/components/masters/CurrentTurnBanner'
import RecentPicksFeed from '@/app/components/masters/RecentPicksFeed'
import DraftBoardGrid from '@/app/components/masters/DraftBoardGrid'
import AvailablePlayersList from '@/app/components/masters/AvailablePlayersList'
import ManagerRosters from '@/app/components/masters/ManagerRosters'
import CommissionerControls from '@/app/components/masters/CommissionerControls'
import EventHubNav from '@/app/components/masters/EventHubNav'
import DraftRoomHeader from '@/app/components/masters/DraftRoomHeader'
import UpcomingPicksCard from '@/app/components/masters/UpcomingPicksCard'
import { getDraftRoomData, getFullDraftBoard } from '@/lib/masters/queries'

type PageProps = {
  params: Promise<{ leagueId: string }>
}

type UpcomingPick = {
  overall_pick: number
  round_number: number
  round_pick: number
  manager_name: string
}

function buildUpcomingPicks(
  managers: string[],
  rosterSize: number,
  filledPicksCount: number,
  count = 8
): UpcomingPick[] {
  const upcoming: UpcomingPick[] = []

  for (let roundIndex = 0; roundIndex < rosterSize; roundIndex += 1) {
    const roundNumber = roundIndex + 1
    const order = roundNumber % 2 === 1 ? managers : [...managers].reverse()

    for (let pickIndex = 0; pickIndex < order.length; pickIndex += 1) {
      const overallPick = roundIndex * managers.length + pickIndex + 1

      if (overallPick <= filledPicksCount) {
        continue
      }

      upcoming.push({
        overall_pick: overallPick,
        round_number: roundNumber,
        round_pick: pickIndex + 1,
        manager_name: order[pickIndex],
      })

      if (upcoming.length >= count) {
        return upcoming
      }
    }
  }

  return upcoming
}

export default async function MastersDraftPage({ params }: PageProps) {
  const { leagueId } = await params

  const [draftRoomData, fullDraftBoard] = await Promise.all([
    getDraftRoomData(leagueId),
    getFullDraftBoard(leagueId),
  ])

  const {
    league,
    event,
    currentTurn,
    draftOrder,
    availablePlayers,
    recentPicks,
    rosters,
    isCommissioner,
    currentUserId,
  } = draftRoomData

  if (!league) {
    return (
      <main className="min-h-screen bg-[#f3f1ea] px-4 py-6 text-[#162317]">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-[22px] border border-[#d9ddcf] bg-white p-6 shadow-[0_10px_24px_rgba(16,24,40,0.06)]">
            <h1 className="text-2xl font-semibold">League not found</h1>
            <p className="mt-2 text-[#667065]">
              We couldn’t find a Masters league for that ID.
            </p>
          </div>
        </div>
      </main>
    )
  }

  const isUsersTurn =
    !!currentUserId &&
    !!currentTurn?.current_drafter_user_id &&
    currentUserId === currentTurn.current_drafter_user_id

  const managerNames = draftOrder.map((m) => m.display_name)
  const upcomingPicks = buildUpcomingPicks(
    managerNames,
    league.roster_size,
    fullDraftBoard.length,
    8
  )

  return (
    <main className="min-h-screen bg-transparent px-2 py-3 text-[#162317] md:px-6 md:py-5">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-3 pb-24 md:gap-4">
        <DraftRoomHeader
          leagueName={league.name}
          eventName={event?.name ?? 'Masters'}
          season={event?.season ?? 2026}
          status={currentTurn?.status ?? league.status}
        />

        <CurrentTurnBanner
          drafterName={currentTurn?.current_drafter_name}
          currentPick={currentTurn?.current_pick}
          currentRound={currentTurn?.current_round}
          status={currentTurn?.status}
          isUsersTurn={isUsersTurn}
        />

        <div className="sticky top-[72px] z-20 -mx-2 border-y border-[#dde2d6] bg-[#f3f1ea]/95 px-2 py-2 backdrop-blur md:hidden">
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            <a
              href="#draft-players"
              className="whitespace-nowrap rounded-full border border-[#0b5d3b] bg-[#0b5d3b] px-3 py-1.5 text-[11px] font-semibold text-white"
            >
              Players
            </a>
            <a
              href="#draft-upcoming"
              className="whitespace-nowrap rounded-full border border-[#d9ddcf] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#243126]"
            >
              Upcoming
            </a>
            <a
              href="#draft-team"
              className="whitespace-nowrap rounded-full border border-[#d9ddcf] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#243126]"
            >
              League
            </a>
            <a
              href="#draft-recent"
              className="whitespace-nowrap rounded-full border border-[#d9ddcf] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#243126]"
            >
              Recent
            </a>
            <a
              href="#draft-board"
              className="whitespace-nowrap rounded-full border border-[#d9ddcf] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#243126]"
            >
              Board
            </a>
          </div>
        </div>

        <div className="hidden xl:grid xl:grid-cols-[270px_minmax(0,1fr)_280px] xl:items-start xl:gap-4">
          <div className="space-y-3">
            <AvailablePlayersList
              leagueId={leagueId}
              players={availablePlayers}
              canDraft={isUsersTurn}
            />
          </div>

          <div className="space-y-3">
            <DraftBoardGrid
              picks={fullDraftBoard}
              rosterSize={league.roster_size}
              managers={managerNames}
            />
          </div>

          <div className="space-y-3">
            <UpcomingPicksCard picks={upcomingPicks} />
            <RecentPicksFeed picks={recentPicks} />
            <ManagerRosters rosters={rosters} leagueId={leagueId} />
            <CommissionerControls visible={isCommissioner} leagueId={leagueId} />
          </div>
        </div>

        <div className="space-y-3 xl:hidden">
          <section id="draft-players">
            <AvailablePlayersList
              leagueId={leagueId}
              players={availablePlayers}
              canDraft={isUsersTurn}
            />
          </section>

          <section id="draft-upcoming">
            <UpcomingPicksCard picks={upcomingPicks} />
          </section>

          <section id="draft-recent">
            <RecentPicksFeed picks={recentPicks} />
          </section>

          <section id="draft-team">
            <ManagerRosters rosters={rosters} leagueId={leagueId} />
          </section>

          <section id="draft-board">
            <DraftBoardGrid
              picks={fullDraftBoard}
              rosterSize={league.roster_size}
              managers={managerNames}
            />
          </section>

          <CommissionerControls visible={isCommissioner} leagueId={leagueId} />
        </div>
      </div>

      <EventHubNav leagueId={leagueId} />
    </main>
  )
}