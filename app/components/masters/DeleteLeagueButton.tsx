"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteLeague } from "@/app/masters/create/actions";

export default function DeleteLeagueButton({ leagueId }: { leagueId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    if (!window.confirm("Delete this league? This cannot be undone.")) return;
    startTransition(async () => {
      const result = await deleteLeague(leagueId);
      if (result.ok) {
        router.push("/fantasy/golf");
      } else {
        alert(result.error ?? "Failed to delete league");
      }
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="mt-3 w-full rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
    >
      {isPending ? "Deleting…" : "Delete League"}
    </button>
  );
}
