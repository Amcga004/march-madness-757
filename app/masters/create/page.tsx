import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/authHelpers";
import { createServiceClient } from "@/lib/supabase/service";
import CreateLeagueWizard from "./CreateLeagueWizard";

export const dynamic = "force-dynamic";

export default async function CreateLeaguePage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = createServiceClient();
  const { data: tournaments } = await supabase
    .from("platform_events")
    .select("id, name, starts_at")
    .in("sport_key", ["pga", "golf"])
    .eq("status", "scheduled")
    .order("starts_at", { ascending: true });

  return (
    <main className="min-h-screen bg-[#f3f1ea] text-[#162317] antialiased">
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(11,93,59,0.06),transparent_28%),linear-gradient(180deg,#f6f4ed_0%,#f3f1ea_42%,#eeece3_100%)]">
        <div className="mx-auto max-w-2xl px-4 py-10 md:py-14">
          {/* Header */}
          <div className="mb-8 flex items-center gap-3">
            <Link
              href="/fantasy/golf"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[#d9ddcf] bg-white text-[#6f7a67] hover:bg-[#f6f4ed]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6f7a67]">
                757 Fantasy · Golf
              </p>
              <h1 className="text-xl font-bold tracking-tight text-[#162317]">
                Create New League
              </h1>
            </div>
          </div>

          <CreateLeagueWizard tournaments={tournaments ?? []} />
        </div>
      </div>
    </main>
  );
}
