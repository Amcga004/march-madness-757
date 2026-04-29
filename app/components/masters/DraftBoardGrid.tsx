import type { DraftPick } from '@/lib/masters/types'
import { getManagerTheme } from './managerTheme'

type Props = {
  picks: DraftPick[]
  rosterSize: number
  managers: string[]
}

export default function DraftBoardGrid({ picks, rosterSize, managers }: Props) {
  const pickMap = new Map<string, DraftPick>()
  for (const pick of picks) {
    pickMap.set(`${pick.round_number}-${pick.round_pick}`, pick)
  }

  const roundOrders = Array.from({ length: rosterSize }, (_, i) => {
    const round = i + 1
    return round % 2 === 1 ? managers : [...managers].reverse()
  })

  function overallPickNum(round: number, posInRound: number): number {
    return (round - 1) * managers.length + posInRound
  }

  return (
    <div className="rounded-[20px] border border-[#0b5d3b] bg-[#0b5d3b] p-3 shadow-[0_8px_20px_rgba(16,24,40,0.08)] md:rounded-[24px] md:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/85 md:text-[11px]">
            Draft Board
          </h3>
          <p className="mt-0.5 text-[11px] text-white/70">
            Full room context
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[860px] space-y-1.5">
          {roundOrders.map((order, index) => {
            const round = index + 1

            return (
              <div
                key={round}
                className="grid gap-1.5"
                style={{
                  gridTemplateColumns: `56px repeat(${managers.length}, minmax(125px, 1fr))`,
                }}
              >
                <div className="rounded-lg border border-[#2b7759] bg-[#08452d] px-2 py-2 text-xs font-semibold text-white">
                  R{round}
                </div>

                {order.map((manager, i) => {
                  // order is already reversed for even rounds
                  // snakeRoundPick = manager's position in the original (non-reversed) draft order for this round
                  const managerOriginalIndex = managers.indexOf(manager)
                  const snakeRoundPick = round % 2 === 1 ? managerOriginalIndex + 1 : managers.length - managerOriginalIndex
                  const pick = pickMap.get(`${round}-${snakeRoundPick}`)
                  const theme = getManagerTheme(manager)
                  const pickNum = overallPickNum(round, i + 1)

                  return (
                    <div
                      key={`${round}-${snakeRoundPick}-${manager}`}
                      className="min-h-[60px] rounded-lg border border-[#cfd9c8] bg-white px-2.5 py-2"
                    >
                      <div className="mb-1 flex items-center justify-between gap-1">
                        <p className={`truncate text-[10px] uppercase tracking-[0.12em] ${theme.textClass}`}>
                          {manager}
                        </p>
                        <span className="shrink-0 text-[10px] font-semibold text-[#b0b8a7]">
                          #{pickNum}
                        </span>
                      </div>

                      {pick ? (
                        <p className="line-clamp-2 text-xs font-semibold leading-4 text-[#162317]">
                          {pick.competitor_name}
                        </p>
                      ) : (
                        <p className="text-xs text-[#7a8578]">Open</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}