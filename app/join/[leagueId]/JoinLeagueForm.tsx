"use client";

import { useState, useTransition } from "react";
import { joinLeague } from "./actions";

type Props = {
  leagueId: string;
  userEmail: string;
};

export default function JoinLeagueForm({ leagueId, userEmail }: Props) {
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await joinLeague(leagueId, displayName);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#6f7a67]">
          Signed in as
        </label>
        <p className="text-sm text-[#162317]">{userEmail}</p>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#6f7a67]">
          Your Manager Name
        </label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. Andrew"
          required
          className="w-full rounded-xl border border-[#d9ddcf] bg-white px-4 py-3 text-sm text-[#162317] placeholder-[#b0b8a7] outline-none focus:border-[#0B5D3B] focus:ring-1 focus:ring-[#0B5D3B]"
        />
        <p className="mt-1 text-[11px] text-[#6f7a67]">This is how you'll appear in the draft and leaderboard.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || !displayName.trim()}
        className="w-full rounded-xl bg-[#0B5D3B] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#0a4f32] disabled:opacity-40"
      >
        {isPending ? "Joining…" : "Join League"}
      </button>
    </form>
  );
}
