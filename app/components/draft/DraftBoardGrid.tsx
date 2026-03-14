import TeamLogo from "../TeamLogo";

type Pick = {
  id: string;
  pick_number: number;
  round_number: number;
  manager_name: string;
  team_name: string;
};

type Props = {
  picks: Pick[];
};

export default function DraftBoardGrid({ picks }: Props) {
  const roundsMap = new Map<number, Pick[]>();

  for (const pick of picks) {
    const existing = roundsMap.get(pick.round_number) ?? [];
    existing.push(pick);
    roundsMap.set(pick.round_number, existing);
  }

  const rounds = Array.from(roundsMap.entries()).sort((a, b) => a[0] - b[0]);

  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold">Draft Board</h3>
          <p className="mt-1 text-sm text-slate-500">
            Full draft history organized by round.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-6">
        {rounds.length === 0 ? (
          <div className="rounded-xl border p-4 text-sm text-slate-500">
            No picks have been made yet.
          </div>
        ) : (
          rounds.map(([roundNumber, roundPicks]) => (
            <div key={roundNumber}>
              <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Round {roundNumber}
              </div>

              <div className="grid gap-3">
                {roundPicks
                  .sort((a, b) => a.pick_number - b.pick_number)
                  .map((pick) => (
                    <div
                      key={pick.id}
                      className="flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                          {pick.pick_number}
                        </div>

                        <div>
                          <div className="text-sm text-slate-500">{pick.manager_name}</div>
                          <div className="mt-1 flex items-center gap-2 font-semibold text-slate-900">
                            <TeamLogo teamName={pick.team_name} size={24} />
                            <span>{pick.team_name}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Pick #{pick.pick_number}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}