import { getManagerTheme } from './managerTheme'

type Row = {
  player_name: string
  manager_display_name: string | null
  fantasy_points_total: number
  today_to_par: number | null
  total_to_par: number | null
}

type Props = {
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

export default function TopContributorsCard({ rows }: Props) {
  return (
    <div className="rounded-[20px] border border-[#d9ddcf] bg-[linear-gradient(180deg,#fffefb_0%,#f8f8f3_100%)] p-3 shadow-[0_8px_20px_rgba(16,24,40,0.05)] md:rounded-[24px] md:p-4">
      <div className="mb-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6f7a67] md:text-[11px]">
          Top Fantasy Contributors
        </h3>
        <p className="mt-0.5 text-[11px] text-[#788274]">
          Biggest scoring impact right now
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e2e6dc] bg-white">
        {rows.length === 0 ? (
          <div className="px-3 py-4 text-sm text-[#667065]">
            No contributors available.
          </div>
        ) : (
          rows.map((row, index) => {
            const drafted = !!row.manager_display_name
            const theme = getManagerTheme(row.manager_display_name)

            return (
              <div
                key={`${row.player_name}-${index}`}
                className={`${
                  index !== rows.length - 1 ? 'border-b border-[#edf0e8]' : ''
                } px-3 py-3`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-[#162317]">
                      {row.player_name}
                    </p>

                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          drafted
                            ? theme.softBadgeClass
                            : 'border border-[#d9dde5] bg-[#f5f7fb] text-[#5b6472]'
                        }`}
                      >
                        {row.manager_display_name ?? 'Undrafted'}
                      </span>
                    </div>

                    <p className="mt-1 text-[11px] text-[#788274]">
                      Today {formatToPar(row.today_to_par)} • Total {formatToPar(row.total_to_par)}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-[16px] font-semibold text-[#0b8f55]">
                      {formatFantasyPoints(row.fantasy_points_total)}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[#788274]">
                      Fantasy Pts
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