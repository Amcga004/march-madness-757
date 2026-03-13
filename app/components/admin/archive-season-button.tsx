'use client';

import { useState } from 'react';

type Props = {
  defaultSeasonYear?: number;
};

export default function ArchiveSeasonButton({
  defaultSeasonYear = new Date().getFullYear(),
}: Props) {
  const [seasonYear, setSeasonYear] = useState(defaultSeasonYear);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function handleArchive() {
    const confirmed = window.confirm(
      `Archive final standings for the ${seasonYear} season? This should only be done once the season is complete.`
    );

    if (!confirmed) return;

    setIsLoading(true);
    setMessage(null);
    setIsError(false);

    try {
      const response = await fetch('/api/admin/archive-season', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ seasonYear }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to archive season.');
      }

      setMessage(
        `Archived ${data.rowsInserted} final standings rows for ${data.archivedSeason}.`
      );
      setIsError(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong.');
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5">
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-white">Archive Current Season Standings</h3>
        <p className="mt-1 text-sm text-zinc-400">
          Saves a permanent snapshot of the final leaderboard into the historical archive.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:max-w-[180px]">
          <label
            htmlFor="seasonYear"
            className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400"
          >
            Season Year
          </label>
          <input
            id="seasonYear"
            type="number"
            value={seasonYear}
            onChange={(e) => setSeasonYear(Number(e.target.value))}
            className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-white outline-none transition focus:border-blue-500"
          />
        </div>

        <button
          type="button"
          onClick={handleArchive}
          disabled={isLoading}
          className="inline-flex h-[50px] items-center justify-center rounded-2xl bg-blue-600 px-5 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? 'Archiving...' : 'Archive Current Season Standings'}
        </button>
      </div>

      {message && (
        <div
          className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
            isError
              ? 'border border-red-500/20 bg-red-500/10 text-red-200'
              : 'border border-green-500/20 bg-green-500/10 text-green-200'
          }`}
        >
          {message}
        </div>
      )}
    </div>
  );
}