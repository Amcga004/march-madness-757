import type { DraftPick } from '@/lib/masters/types'
import { getManagerTheme } from './managerTheme'

type Props = {
  picks: DraftPick[]
}

export default function RecentPicksFeed({ picks }: Props) {
  return (
    <div className="rounded-[24px] border border-[#d9ddcf] bg-[linear-gradient(180deg,#fffefb_0%,#f7f7f1_100%)] p-4 shadow-[0_10px_24px_rgba(16,24,40,0.06)]">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6f7a67]">
            Recent Picks
          </h3>
          <p className="mt-1 text-xs text-[#788274]">
            Latest selections across the room
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {picks.length === 0 ? (
          <div className="rounded-2xl border border-[#d9ddcf] bg-white p-3 text-sm text-[#667065]">
            No picks yet.
          </div>
        ) : (
          picks.map((pick) => {
            const theme = getManagerTheme(pick.manager_name)

            return (
              <div
                key={pick.id ?? `${pick.overall_pick}-${pick.competitor_name}`}
                className="rounded-2xl border border-[#d9ddcf] bg-white p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#162317]">
                      {pick.competitor_name}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${theme.softBadgeClass}`}
                      >
                        {pick.manager_name}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 text-right text-[11px] text-[#788274]">
                    <p className="font-semibold text-[#425040]">#{pick.overall_pick}</p>
                    <p>
                      R{pick.round_number}.{pick.round_pick}
                    </p>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}