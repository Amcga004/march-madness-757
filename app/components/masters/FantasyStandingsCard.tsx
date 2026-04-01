import { getManagerTheme } from './managerTheme'

type Row = {
  display_name: string
  fantasy_points: number
  active_golfers?: number | null
  finished_golfers?: number | null
}

type Props = {
  rows: Row[]
}

function formatFantasyPoints(value: number | null | undefined) {
  if (value == null) return '0'
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(1)
}

export default function FantasyStandingsCard({ rows }: Props) {
  return (
    <div className="rounded-[20px] border border-[#d9ddcf] bg-[linear-gradient(180deg,#fffefb_0%,#f8f8f3_100%)] p-3 shadow-[0_8px_20px_rgba(16,24,40,0.05)] md:rounded-[24px] md:p-4">
      <div className="mb-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6f7a67] md:text-[11px]">
          Fantasy Standings
        </h3>
        <p className="mt-0.5 text-[11px] text-[#788274]">
          League scoring snapshot
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e2e6dc] bg-white">
        {rows.length === 0 ? (
          <div className="px-3 py-4 text-sm text-[#667065]">
            No fantasy standings available.
          </div>
        ) : (
          rows.map((row, index) => {
            const theme = getManagerTheme(row.display_name)

            return (
              <div
                key={`${row.display_name}-${index}`}
                className={`${index !== rows.length - 1 ? 'border-b border-[#edf0e8]' : ''} px-3 py-3`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-[#162317]">
                        #{index + 1}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${theme.softBadgeClass}`}
                      >
                        {row.display_name}
                      </span>
                    </div>

                    <p className="mt-1 text-[11px] text-[#788274]">
                      {(row.active_golfers ?? 0)} golfers active • {(row.finished_golfers ?? 0)} finished
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-[16px] font-semibold text-[#0b8f55]">
                      {formatFantasyPoints(row.fantasy_points)}
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