import Link from 'next/link'
import type { ManagerRoster } from '@/lib/masters/types'
import { getManagerTheme } from './managerTheme'

type Props = {
  rosters: ManagerRoster[]
  leagueId?: string
}

function buildRosterKey(roster: ManagerRoster, index: number) {
  return roster.member_id || `${roster.display_name}-${index}`
}

function buildPlayerKey(
  player: ManagerRoster['players'][number],
  roster: ManagerRoster,
  index: number
) {
  return (
    player.competitor_id ||
    `${roster.member_id || roster.display_name}-${player.player_name}-${index}`
  )
}

export default function ManagerRosters({ rosters, leagueId }: Props) {
  return (
    <div className="rounded-[20px] border border-[#d9ddcf] bg-[linear-gradient(180deg,#fffefb_0%,#f7f7f1_100%)] p-3 shadow-[0_8px_20px_rgba(16,24,40,0.05)] md:rounded-[24px] md:p-4">
      <div className="mb-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6f7a67] md:text-[11px]">
          League Rosters
        </h3>
        <p className="mt-0.5 text-[11px] text-[#788274]">
          Sleeper-style team scan
        </p>
      </div>

      <div className="space-y-2.5">
        {rosters.map((roster, rosterIndex) => {
          const theme = getManagerTheme(roster.display_name)

          return (
            <details
              key={buildRosterKey(roster, rosterIndex)}
              className="overflow-hidden rounded-[18px] border border-[#d9ddcf] bg-white"
            >
              <summary className="cursor-pointer list-none px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[#162317] md:text-sm">
                      {roster.display_name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#788274]">
                      {roster.players.length} drafted
                    </p>
                  </div>

                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${theme.softBadgeClass}`}
                  >
                    {roster.players.length} picks
                  </span>
                </div>
              </summary>

              <div className="border-t border-[#e4e8df] bg-[#fafaf7]">
                {roster.players.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-[#667065]">
                    No players drafted yet.
                  </div>
                ) : (
                  <div className="divide-y divide-[#edf0e8]">
                    {roster.players.map((player, playerIndex) => {
                      const content = (
                        <div className="flex items-center justify-between gap-3 px-3 py-2.5 transition hover:bg-[#f7f7f1]">
                          <p className="min-w-0 truncate text-[12px] font-medium text-[#162317] md:text-sm">
                            {player.player_name}
                          </p>
                          <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-[#7b8578]">
                            View
                          </span>
                        </div>
                      )

                      if (!leagueId || !player.competitor_id) {
                        return (
                          <div key={buildPlayerKey(player, roster, playerIndex)}>
                            {content}
                          </div>
                        )
                      }

                      return (
                        <Link
                          key={buildPlayerKey(player, roster, playerIndex)}
                          href={`/masters/${leagueId}/players/${player.competitor_id}`}
                        >
                          {content}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            </details>
          )
        })}
      </div>
    </div>
  )
}