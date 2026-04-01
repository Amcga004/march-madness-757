type Props = {
  leaderName: string | null
  leaderPoints: number
  activeGolfers: number
  finishedGolfers: number
  draftedGolfers: number
}

export default function LeaguePulseCard({
  leaderName,
  leaderPoints,
  activeGolfers,
  finishedGolfers,
  draftedGolfers,
}: Props) {
  return (
    <div className="rounded-[20px] border border-[#0b5d3b] bg-[#0b5d3b] p-3 shadow-[0_8px_20px_rgba(16,24,40,0.08)] md:rounded-[24px] md:p-4">
      <div className="mb-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/85 md:text-[11px]">
          League Pulse
        </h3>
        <p className="mt-0.5 text-[11px] text-white/70">
          Fast league snapshot
        </p>
      </div>

      <div className="grid gap-2 md:grid-cols-4 md:gap-3">
        <div className="rounded-[16px] border border-[#2b7759] bg-white px-3 py-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[#788274]">
            Leader
          </p>
          <p className="mt-1 truncate text-[14px] font-semibold text-[#162317] md:text-base">
            {leaderName ?? '—'}
          </p>
          <p className="mt-1 text-[13px] font-semibold text-[#0b8f55]">
            {leaderPoints} pts
          </p>
        </div>

        <div className="rounded-[16px] border border-[#2b7759] bg-white px-3 py-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[#788274]">
            Active Now
          </p>
          <p className="mt-1 text-[14px] font-semibold text-[#162317] md:text-base">
            {activeGolfers}
          </p>
          <p className="mt-1 text-[12px] text-[#788274]">
            golfers currently live
          </p>
        </div>

        <div className="rounded-[16px] border border-[#2b7759] bg-white px-3 py-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[#788274]">
            Finished
          </p>
          <p className="mt-1 text-[14px] font-semibold text-[#162317] md:text-base">
            {finishedGolfers}
          </p>
          <p className="mt-1 text-[12px] text-[#788274]">
            golfers finished today
          </p>
        </div>

        <div className="rounded-[16px] border border-[#2b7759] bg-white px-3 py-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[#788274]">
            Drafted Field
          </p>
          <p className="mt-1 text-[14px] font-semibold text-[#162317] md:text-base">
            {draftedGolfers}
          </p>
          <p className="mt-1 text-[12px] text-[#788274]">
            owned golfers in play
          </p>
        </div>
      </div>
    </div>
  )
}