type Props = {
  picks: {
    overall_pick: number
    round_number: number
    round_pick: number
    manager_name: string
  }[]
}

export default function UpcomingPicksCard({ picks }: Props) {
  return (
    <div className="rounded-[20px] border border-[#d9ddcf] bg-[linear-gradient(180deg,#fffefb_0%,#f7f7f1_100%)] p-3 shadow-[0_8px_20px_rgba(16,24,40,0.05)] md:rounded-[24px] md:p-4">
      <div className="mb-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6f7a67] md:text-[11px]">
          Upcoming Picks
        </h3>
        <p className="mt-0.5 text-[11px] text-[#788274]">
          Immediate draft order visibility
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e2e6dc] bg-white">
        {picks.length === 0 ? (
          <div className="px-3 py-4 text-sm text-[#667065]">
            No upcoming picks available.
          </div>
        ) : (
          picks.map((pick, index) => (
            <div
              key={`${pick.overall_pick}-${pick.manager_name}`}
              className={`flex items-center justify-between gap-3 px-3 py-3 ${
                index !== picks.length - 1 ? 'border-b border-[#edf0e8]' : ''
              } ${index === 0 ? 'bg-[#f4f9f5]' : 'bg-white'}`}
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-[#162317] md:text-sm">
                  {pick.manager_name}
                </p>
                <p className="mt-0.5 text-[11px] text-[#788274]">
                  Round {pick.round_number} • Pick {pick.round_pick}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-[12px] font-semibold text-[#243126] md:text-sm">
                  #{pick.overall_pick}
                </p>
                {index === 0 ? (
                  <p className="text-[9px] uppercase tracking-[0.12em] text-[#0b5d3b]">
                    Next
                  </p>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}