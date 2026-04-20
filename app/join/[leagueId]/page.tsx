import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/authHelpers";
import { createServiceClient } from "@/lib/supabase/service";
import JoinLeagueForm from "./JoinLeagueForm";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ leagueId: string }>;
};

export default async function JoinLeaguePage({ params }: PageProps) {
  const { leagueId } = await params;
  const user = await getUser();

  const supabase = createServiceClient();
  const { data: league } = await supabase
    .from("leagues_v2")
    .select("id, name, max_members, draft_status")
    .eq("id", leagueId)
    .maybeSingle();

  if (!league) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f3f1ea]">
        <div className="rounded-2xl border border-[#d9ddcf] bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-[#162317]">League not found</p>
          <p className="mt-1 text-xs text-[#6f7a67]">This invite link may be invalid or expired.</p>
        </div>
      </main>
    );
  }

  // Count current members
  const { count } = await supabase
    .from("league_draft_order_v2")
    .select("*", { count: "exact", head: true })
    .eq("league_id", leagueId);

  const isFull = (count ?? 0) >= (league.max_members ?? 8);
  const isClosed = league.draft_status !== "predraft";

  // If already a member, redirect to hub
  if (user) {
    const { data: existing } = await supabase
      .from("league_draft_order_v2")
      .select("user_id")
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing) redirect(`/masters/${leagueId}/hub`);
  }

  return (
    <main className="min-h-screen bg-[#f3f1ea] antialiased">
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(11,93,59,0.06),transparent_28%),linear-gradient(180deg,#f6f4ed_0%,#f3f1ea_42%,#eeece3_100%)]">
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-16">
          <div className="w-full rounded-2xl border border-[#d9ddcf] bg-white p-8 shadow-[0_4px_20px_rgba(16,24,40,0.06)]">
            {/* Header */}
            <div className="mb-6 text-center">
              <span className="text-3xl">⛳</span>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-widest text-[#6f7a67]">
                757 Fantasy · Golf
              </p>
              <h1 className="mt-1 text-xl font-bold text-[#162317]">
                You're invited!
              </h1>
              <p className="mt-1 text-sm text-[#6f7a67]">
                Join <span className="font-semibold text-[#162317]">{league.name}</span>
              </p>
            </div>

            {/* League info */}
            <div className="mb-6 rounded-xl border border-[#d9ddcf] bg-[#f6f4ed] px-4 py-3 text-center">
              <p className="text-xs text-[#6f7a67]">
                {count ?? 0} of {league.max_members} managers joined
              </p>
            </div>

            {isClosed ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">
                This league is no longer accepting new members.
              </div>
            ) : isFull ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700">
                This league is full.
              </div>
            ) : !user ? (
              <div className="text-center">
                <p className="mb-4 text-sm text-[#6f7a67]">Sign in to join this league.</p>
                <a
                  href={`/login?next=/join/${leagueId}`}
                  className="block w-full rounded-xl bg-[#0B5D3B] px-4 py-3 text-sm font-bold text-white text-center hover:bg-[#0a4f32]"
                >
                  Sign In to Join
                </a>
              </div>
            ) : (
              <JoinLeagueForm leagueId={leagueId} userEmail={user.email ?? ""} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
