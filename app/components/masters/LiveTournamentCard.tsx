import { getManagerTheme } from './managerTheme'

type Row = {
  player_name: string
  position_text: string | null
  today_to_par: number | null
  total_to_par: number | null
  thru: string | null
  manager_display_name?: string | null
}

type Props = {
  rows: Row[]
}

function formatToPar(value: number | null | undefined) {
  if (value == null) return 'E'
  if (value === 0) return 'E'
  return value > 0 ? `+${value}` : `${value}`
}

function getTodayColorClass(value: number | null | undefined) {
  if (value == null || value === 0) return 'text-[#425040]'
  if (value < 0) return 'text-[#0b5d3b]'
  return 'text-[#b42318]'
}

function formatThru(thru: string | null | undefined) {
  if (!thru) return 'Not Started'

  const normalized = thru.trim().toUpperCase()

  if (normalized === 'F') return 'Final'
  if (/^\d+$/.test(normalized)) return `Thru ${normalized}`

  return normalized
}

export default function LiveTournamentCard({ rows }: Props) {
  return (
    <div className="rounded-[20px] border border-[#d9ddcf] bg-[linear-gradient(180deg,#fffefb_0%,#f8f8f3_100%)] p-3 shadow-[0_8px_20px_rgba(16,24,40,0.05)] md:rounded-[24px] md:p-4">
      <div className="mb-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6f7a67] md:text-[11px]">
          Live Tournament Snapshot
        </h3>
        <p className="mt-0.5 text-[11px] text-[#788274]">
          Today-focused view of who is moving, with tournament position and ownership
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e2e6dc] bg-white">
        {rows.length === 0 ? (
          <div className="px-3 py-4 text-sm text-[#667065]">
            No live tournament data available.
          </div>
        ) : (
          rows.map((row, index) => {
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
                      {row.position_text ?? '—'} • {row.player_name}
                    </p>

                    <p className="mt-1 text-[11px] text-[#788274]">
                      Tournament {formatToPar(row.total_to_par)} • {formatThru(row.thru)}
                    </p>

                    <div className="mt-1">
                      {row.manager_display_name ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${theme.softBadgeClass}`}
                        >
                          Drafted • {row.manager_display_name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-[#d9dde5] bg-[#f5f7fb] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5b6472]">
                          Undrafted
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p
                      className={`text-[18px] font-semibold ${getTodayColorClass(
                        row.today_to_par
                      )}`}
                    >
                      {formatToPar(row.today_to_par)}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[#788274]">
                      Today
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