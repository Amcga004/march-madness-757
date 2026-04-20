import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/authHelpers";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "America/New_York",
    });
  } catch {
    return dateStr;
  }
}

function StatusBadge({ status }: { status: string | null }) {
  const s = status ?? "unknown";
  const styles: Record<string, string> = {
    live: "bg-[#0B5D3B]/10 text-[#0B5D3B] border border-[#0B5D3B]/20",
    completed: "bg-[#d9ddcf] text-[#6f7a67] border border-[#d9ddcf]",
    draft: "bg-[#C9A84C]/10 text-[#9A7A28] border border-[#C9A84C]/30",
    predraft: "bg-[#C9A84C]/10 text-[#9A7A28] border border-[#C9A84C]/30",
  };
  const label: Record<string, string> = {
    live: "Live",
    completed: "Complete",
    draft: "Drafting",
    predraft: "Pre-Draft",
  };
  const cls = styles[s] ?? "bg-[#d9ddcf] text-[#6f7a67] border border-[#d9ddcf]";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {label[s] ?? s}
    </span>
  );
}

export default async function FantasyGolfPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = createServiceClient();

  const [{ data: leagues }, { data: tournaments }] = await Promise.all([
    supabase
      .from("leagues_v2")
      .select("id, name, draft_status, created_at")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("platform_events")
      .select("id, name, starts_at, status, metadata")
      .in("sport_key", ["pga", "golf"])
      .order("starts_at", { ascending: true }),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 md:py-14">
      {/* Header */}
      <div className="mb-10 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">⛳</span>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6f7a67]">
              757 Fantasy · Golf
            </p>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#162317] md:text-3xl">
            My Golf Leagues
          </h1>
        </div>

        <button
          disabled
          className="shrink-0 rounded-lg bg-[#0B5D3B] px-4 py-2 text-sm font-semibold text-white opacity-60 cursor-not-allowed"
          title="Coming soon"
        >
          + Create League
        </button>
      </div>

      {/* My Leagues */}
      <section className="mb-10">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#6f7a67]">
          My Leagues
        </h2>

        {!leagues || leagues.length === 0 ? (
          <div className="rounded-xl border border-[#d9ddcf] bg-white px-5 py-8 text-center">
            <p className="text-sm font-medium text-[#162317]">No leagues yet</p>
            <p className="mt-1 text-xs text-[#6f7a67]">
              Create a league for an upcoming tournament to get started.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {leagues.map((league) => (
              <Link
                key={league.id}
                href={`/masters/${league.id}/hub`}
                className="flex items-center gap-4 rounded-xl border border-[#d9ddcf] bg-white px-5 py-4 transition-colors hover:border-[#0B5D3B]/30 hover:bg-[#f6f4ed]"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0B5D3B]/8 text-lg">
                  ⛳
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#162317] truncate">{league.name}</p>
                  <p className="text-xs text-[#6f7a67]">
                    Created {formatDate(league.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={league.draft_status} />
                  <svg
                    className="h-4 w-4 text-[#6f7a67]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Available Tournaments */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#6f7a67]">
          Available Tournaments
        </h2>

        {!tournaments || tournaments.length === 0 ? (
          <div className="rounded-xl border border-[#d9ddcf] bg-white px-5 py-8 text-center">
            <p className="text-sm text-[#6f7a67]">No upcoming tournaments found.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {tournaments.map((event) => {
              const isPast = event.starts_at && new Date(event.starts_at) < new Date();
              return (
                <div
                  key={event.id}
                  className={`flex items-center gap-4 rounded-xl border border-[#d9ddcf] bg-white px-5 py-4 ${isPast ? "opacity-50" : ""}`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#C9A84C]/10 text-lg">
                    🏆
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#162317] truncate">{event.name}</p>
                    <p className="text-xs text-[#6f7a67]">
                      {event.starts_at ? formatDate(event.starts_at) : "Date TBD"}
                    </p>
                  </div>
                  <span className="text-xs text-[#6f7a67]">
                    {isPast ? "Completed" : "Upcoming"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
