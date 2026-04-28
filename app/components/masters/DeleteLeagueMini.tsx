"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteLeague } from "@/app/masters/create/actions";

export default function DeleteLeagueMini({ leagueId }: { leagueId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.confirm("Delete this league? This cannot be undone.")) return;
        startTransition(async () => {
          const result = await deleteLeague(leagueId);
          if (result.ok) router.refresh();
          else alert(result.error ?? "Failed to delete league");
        });
      }}
      disabled={isPending}
      title="Delete league"
      className="delete-league-mini flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
    >
      {isPending ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
      ) : (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      )}
    </button>
  );
}
