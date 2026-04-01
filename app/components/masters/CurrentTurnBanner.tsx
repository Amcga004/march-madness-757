import { getManagerTheme } from './managerTheme'

type Props = {
  drafterName?: string | null
  currentPick?: number | null
  currentRound?: number | null
  status?: string | null
  isUsersTurn?: boolean
}

export default function CurrentTurnBanner({
  drafterName,
  currentPick,
  currentRound,
  status,
  isUsersTurn = false,
}: Props) {
  const theme = getManagerTheme(drafterName)

  const title =
    status === 'pending'
      ? 'Draft not started'
      : drafterName
      ? `${drafterName} is on the clock`
      : 'Waiting for draft state'

  return (
    <div
      className={`rounded-[24px] border px-4 py-4 shadow-[0_10px_24px_rgba(16,24,40,0.06)] md:px-5 ${
        isUsersTurn
          ? 'border-[#0b5d3b] bg-[#f1f8f4]'
          : 'border-[#d9ddcf] bg-[linear-gradient(180deg,#fffefb_0%,#f7f7f1_100%)]'
      }`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#6f7a67]">
            On The Clock
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-[#162317] md:text-xl">
              {title}
            </h2>

            {drafterName && status !== 'pending' ? (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${theme.softBadgeClass}`}
              >
                {drafterName}
              </span>
            ) : null}
          </div>

          <p className="mt-1 text-sm text-[#667065]">
            {currentRound ? `Round ${currentRound}` : 'Round —'} •{' '}
            {currentPick ? `Pick ${currentPick}` : 'Pick —'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {isUsersTurn ? (
            <div className="inline-flex rounded-full border border-[#0b5d3b] bg-[#0b5d3b] px-4 py-2 text-sm font-semibold text-white shadow-sm">
              Your Pick
            </div>
          ) : null}

          {status === 'pending' ? (
            <div className="inline-flex rounded-full border border-[#d9ddcf] bg-white px-4 py-2 text-sm font-semibold text-[#425040]">
              Waiting To Start
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}