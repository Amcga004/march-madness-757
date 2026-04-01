type Props = {
  leagueName: string
  eventName?: string | null
  season?: number | null
  status?: string | null
}

function formatStatus(status?: string | null) {
  if (!status) return 'Pending'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export default function DraftRoomHeader({
  leagueName,
  eventName,
  season,
  status,
}: Props) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-[#d9ddcf] bg-[linear-gradient(180deg,#fffefb_0%,#f7f7f1_100%)] shadow-[0_8px_20px_rgba(16,24,40,0.05)]">
      <div className="bg-[linear-gradient(90deg,rgba(0,87,63,0.05)_0%,rgba(255,255,255,0)_55%)] px-4 py-3 md:px-5 md:py-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-[0.24em] text-[#6f7a67]">
              Masters Fantasy
            </p>
            <h1 className="mt-0.5 truncate text-[1rem] font-semibold tracking-tight text-[#162317] md:text-[1.35rem]">
              {leagueName}
            </h1>
            <p className="mt-0.5 text-xs text-[#667065] md:text-sm">
              {eventName ?? 'Masters'}
              {season ? ` • ${season}` : ''}
            </p>
          </div>

          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#d6dbc9] bg-white px-3 py-1.5 text-xs text-[#50604d] shadow-sm md:text-sm">
            <span>Status</span>
            <span className="rounded-full bg-[#0b5d3b] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
              {formatStatus(status)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}