import Link from 'next/link'
import { getManagerTheme } from './managerTheme'

type Row = {
  competitor_id: string
  player_name: string
  manager_display_name: string | null
  position_text: string | null
  today_to_par: number | null
  total_to_par: number | null
  fantasy_points_total: number
  today_points: number
  thru: string | null
  status: string | null
}

type Props = {
  leagueId: string
  rows: Row[]
}

function formatToPar(value: number | null | undefined) {
  if (value == null) return 'E'
  if (value === 0) return 'E'
  return value > 0 ? `+${value}` : `${value}`
}

function formatFantasyPoints(value: number | null | undefined) {
  if (value == null) return '0'
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(1)
}

function fantasyPointsClass(value: number | null | undefined) {
  if (value == null || value === 0) return 'text-[#425040]'
  return value > 0 ? 'text-[#0b8f55]' : 'text-[#c23b3b]'
}

export default function LiveFantasyLeaderboardTable({ leagueId, rows }: Props) {
  return (
    <div className="rounded-[20px] border border-[#d9ddcf] bg-[linear-gradient(180deg,#fffefb_0%,#f8f8f3_100%)] p-3 shadow-[0_8px_20px_rgba(16,24,40,0.05)] md:rounded-[22px] md:p-4">
      <div className="mb-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#6f7a67] md:text-[11px]">
          Live Fantasy Leaderboard
        </h2>
        <p className="mt-1 text-[11px] text-[#788274] md:text-xs">
          Tournament density first, fantasy context layered in.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e2e6dc] bg-white md:hidden">
        <div className="divide-y divide-[#edf0e8]">
          {rows.map((row) => {
            const drafted = !!row.manager_display_name
            const theme = getManagerTheme(row.manager_display_name)

            return (
              <Link
                key={row.competitor_id}
                href={`/masters/${leagueId}/players/${row.competitor_id}`}
                className="block px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 text-[12px] font-semibold text-[#162317]">
                        {row.position_text ?? '—'}
                      </span>
                      <p className="truncate text-[13px] font-semibold text-[#162317]">
                        {row.player_name}
                      </p>
                    </div>

                    <div className="mt-1 flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                          drafted
                            ? theme.softBadgeClass
                            : 'border border-[#d9dde5] bg-[#f5f7fb] text-[#5b6472]'
                        }`}
                      >
                        {row.manager_display_name ?? 'Undrafted'}
                      </span>
                      <span className="truncate text-[10px] text-[#788274]">
                        {row.status ?? row.thru ?? '—'}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div
                      className={`text-[13px] font-semibold ${fantasyPointsClass(
                        row.fantasy_points_total
                      )}`}
                    >
                      {formatFantasyPoints(row.fantasy_points_total)} pts
                    </div>
                    <div className="mt-1 space-y-0.5 text-[10px] text-[#788274]">
                      <div>Today {formatToPar(row.today_to_par)}</div>
                      <div>Total {formatToPar(row.total_to_par)}</div>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <div className="min-w-[1180px]">
          <div className="grid grid-cols-[80px_minmax(220px,1.45fr)_170px_90px_90px_95px_95px_120px] gap-2 border-b border-[#dfe4d5] pb-2 text-[11px] uppercase tracking-[0.14em] text-[#7a8578]">
            <div>Pos</div>
            <div>Golfer</div>
            <div>Manager</div>
            <div>Today</div>
            <div>Total</div>
            <div>Day Pts</div>
            <div>Total Pts</div>
            <div>Status</div>
          </div>

          <div className="mt-2 space-y-2">
            {rows.map((row) => {
              const theme = getManagerTheme(row.manager_display_name)

              return (
                <Link
                  key={row.competitor_id}
                  href={`/masters/${leagueId}/players/${row.competitor_id}`}
                  className="grid grid-cols-[80px_minmax(220px,1.45fr)_170px_90px_90px_95px_95px_120px] gap-2 rounded-2xl border border-[#e3e6da] bg-white px-3 py-3 shadow-[0_4px_12px_rgba(16,24,40,0.04)] transition hover:border-[#d0d7c5]"
                >
                  <div className="text-sm font-semibold text-[#162317]">
                    {row.position_text ?? '—'}
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-[#162317]">{row.player_name}</div>
                    <div className="mt-1 text-xs text-[#788274]">Click for live scorecard</div>
                  </div>

                  <div className="flex items-center">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${theme.softBadgeClass}`}
                    >
                      {row.manager_display_name ?? 'Undrafted'}
                    </span>
                  </div>

                  <div className="text-sm font-semibold text-[#162317]">
                    {formatToPar(row.today_to_par)}
                  </div>

                  <div className="text-sm font-semibold text-[#162317]">
                    {formatToPar(row.total_to_par)}
                  </div>

                  <div className={`text-sm font-semibold ${fantasyPointsClass(row.today_points)}`}>
                    {formatFantasyPoints(row.today_points)}
                  </div>

                  <div
                    className={`text-sm font-semibold ${fantasyPointsClass(
                      row.fantasy_points_total
                    )}`}
                  >
                    {formatFantasyPoints(row.fantasy_points_total)}
                  </div>

                  <div className="text-sm text-[#5f6b5b]">
                    {row.status ?? row.thru ?? '—'}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}