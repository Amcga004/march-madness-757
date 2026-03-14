type Props = {
  currentPickNumber: number;
  totalPicks: number;
  currentManagerName: string;
  managerColorClass?: string;
  roundLabel?: string;
};

export default function DraftPickBanner({
  currentPickNumber,
  totalPicks,
  currentManagerName,
  managerColorClass = "bg-blue-600 text-white",
  roundLabel,
}: Props) {
  return (
    <div className="sticky top-0 z-30 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${managerColorClass}`}
          >
            {currentManagerName} is on the clock
          </span>

          {roundLabel ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {roundLabel}
            </span>
          ) : null}
        </div>

        <div className="text-sm font-medium text-slate-600">
          Pick {currentPickNumber} of {totalPicks}
        </div>
      </div>
    </div>
  );
}