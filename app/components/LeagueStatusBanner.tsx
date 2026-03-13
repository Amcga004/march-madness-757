export default function LeagueStatusBanner() {
  return (
    <div className="border-b border-amber-300 bg-amber-50">
      <div className="mx-auto max-w-7xl px-6 py-3 text-center text-sm">
        <span className="font-semibold text-amber-700">
          🏀 Mock 2026 Field
        </span>

        <span className="ml-2 text-amber-800">
          Teams are based on current KenPom rankings for demonstration purposes.
          The official NCAA bracket and the final draft order will both update
          after Selection Sunday.
        </span>
      </div>
    </div>
  );
}