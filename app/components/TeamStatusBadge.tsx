type Props = {
  isEliminated?: boolean | null;
  showText?: boolean;
};

export default function TeamStatusBadge({
  isEliminated,
  showText = true,
}: Props) {
  if (isEliminated === true) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-red-200">
        <span>❌</span>
        {showText ? <span>Eliminated</span> : null}
      </span>
    );
  }

  if (isEliminated === false) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 ring-1 ring-green-200">
        <span>🔥</span>
        {showText ? <span>Alive</span> : null}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
      <span>•</span>
      {showText ? <span>Pending</span> : null}
    </span>
  );
}