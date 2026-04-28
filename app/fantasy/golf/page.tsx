import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/authHelpers";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const LIVE_WINDOW_DAYS = 1;

function getTrueStatus(event: { status: string; starts_at: string | null }): "live" | "upcoming" | "completed" {
  if (event.status === "scheduled") return "upcoming";
  if (event.status === "active") {
    if (!event.starts_at) return "live";
    const startsAt = new Date(event.starts_at);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysAgo = (today.getTime() - startsAt.getTime()) / msPerDay;
    return daysAgo <= LIVE_WINDOW_DAYS ? "live" : "completed";
  }
  return "completed";
}

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

function LeagueBadge({ status }: { status: string | null }) {
  const s = status ?? "unknown";
  const styles: Record<string, string> = {
    live: "bg-[#0B5D3B]/10 text-[#0B5D3B] border border-[#0B5D3B]/20",
    completed: "bg-[#d9ddcf] text-[#6f7a67] border border-[#d9ddcf]",
    draft: "bg-[#C9A84C]/10 text-[#9A7A28] border border-[#C9A84C]/30",
    predraft: "bg-[#C9A84C]/10 text-[#9A7A28] border border-[#C9A84C]/30",
  };
  const label: Record<string, string> = {
    live: "Live",
    completed: "Season Ended",
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

  const [{ data: leagues }, { data: rawTournaments }] = await Promise.all([
    supabase
      .from("leagues_v2")
      .select("id, name, draft_status, created_at")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("platform_events")
      .select("id, name, starts_at, status, metadata")
      .in("sport_key", ["pga", "golf"])
      .in("status", ["active", "scheduled"])
      .order("starts_at", { ascending: true }),
  ]);

  // TODO: add is_team_event flag to platform_events and filter on that instead
  const tournaments = (rawTournaments ?? [])
    .filter((e) => !e.name.toLowerCase().includes('zurich'))
    .map((e) => ({
      ...e,
      trueStatus: getTrueStatus(e),
    }));

  const allLeaguesCompleted = (leagues ?? []).length > 0 && (leagues ?? []).every((l) => l.draft_status === "completed");

  const liveTournaments = tournaments.filter((e) => e.trueStatus === "live");
  const upcomingTournaments = tournaments.filter((e) => e.trueStatus === "upcoming");
  const completedTournaments = tournaments.filter((e) => e.trueStatus === "completed");

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 md:py-14">
      {/* Back link */}
      <div className="mb-6">
        <a href="/betting" className="inline-flex items-center gap-1.5 text-xs text-[#6f7a67] hover:text-[#162317] transition-colors">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          EdgePulse
        </a>
      </div>

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

        <Link
          href="/masters/create"
          className="shrink-0 rounded-lg bg-[#0B5D3B] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0a4f32]"
        >
          + Create League
        </Link>
      </div>

      {/* My Leagues */}
      <section className="mb-10">
        {!leagues || leagues.length === 0 ? (
          <>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#6f7a67]">
              My Leagues
            </h2>
            <div className="rounded-xl border border-[#d9ddcf] bg-white px-5 py-8 text-center">
              <p className="text-sm font-medium text-[#162317]">No leagues yet</p>
              <p className="mt-1 text-xs text-[#6f7a67]">
                Create a league for an upcoming tournament to get started.
              </p>
            </div>
          </>
        ) : allLeaguesCompleted ? (
          <details>
            <summary className="mb-3 flex cursor-pointer list-none items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#6f7a67] hover:text-[#162317]">
              <svg
                className="h-3 w-3 transition-transform group-open:rotate-90"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              Past Leagues ({leagues.length})
            </summary>
            <div className="flex flex-col gap-2">
              {leagues.map((league) => (
                <Link
                  key={league.id}
                  href={`/masters/${league.id}/hub`}
                  className="flex items-center gap-4 rounded-xl border border-[#d9ddcf] bg-white px-5 py-4 opacity-70 transition-colors hover:opacity-100"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d9ddcf]/40 text-lg">
                    ⛳
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#162317] truncate">{league.name}</p>
                    <p className="text-xs text-[#6f7a67]">Created {formatDate(league.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <LeagueBadge status={league.draft_status} />
                    <svg className="h-4 w-4 text-[#6f7a67]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </details>
        ) : (
          <>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#6f7a67]">
              My Leagues
            </h2>
            <div className="flex flex-col gap-2">
              {leagues.map((league) => (
                <Link
                  key={league.id}
                  href={`/masters/${league.id}/hub`}
                  className="flex items-center gap-4 rounded-xl border border-[#d9ddcf] bg-white px-5 py-4 transition-colors hover:border-[#0B5D3B]/30 hover:bg-[#f6f4ed]"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0B5D3B]/10 text-lg">
                    ⛳
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#162317] truncate">{league.name}</p>
                    <p className="text-xs text-[#6f7a67]">Created {formatDate(league.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <LeagueBadge status={league.draft_status} />
                    <svg className="h-4 w-4 text-[#6f7a67]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Live / Current Tournament */}
      {liveTournaments.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#6f7a67]">
            Current Tournament
          </h2>
          <div className="flex flex-col gap-2">
            {liveTournaments.map((event) => (
              <div
                key={event.id}
                className="rounded-xl border border-[#0B5D3B]/25 bg-white px-5 py-4"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0B5D3B]/10 text-lg">
                    🏆
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#162317] truncate">{event.name}</p>
                    <p className="text-xs text-[#6f7a67]">
                      {event.starts_at ? formatDate(event.starts_at) : "Date TBD"}
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-[#0B5D3B]">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0B5D3B] opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-[#0B5D3B]" />
                    </span>
                    Live
                  </span>
                </div>
                <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-[#6f7a67]">
                  <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Registration closed — league entries locked at tee time Thursday
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming Tournaments */}
      <section className="mb-10">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#6f7a67]">
          Upcoming Tournaments
        </h2>

        {upcomingTournaments.length === 0 ? (
          <div className="rounded-xl border border-[#d9ddcf] bg-white px-5 py-8 text-center">
            <p className="text-sm text-[#6f7a67]">No upcoming tournaments found.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {upcomingTournaments.map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-4 rounded-xl border border-[#d9ddcf] bg-white px-5 py-4"
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
                <span className="text-xs font-medium text-[#C9A84C]">Registration open</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Completed Tournaments — collapsible */}
      {completedTournaments.length > 0 && (
        <section>
          <details className="group">
            <summary className="mb-3 flex cursor-pointer list-none items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#6f7a67] hover:text-[#162317]">
              <svg
                className="h-3 w-3 transition-transform group-open:rotate-90"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              Past Tournaments ({completedTournaments.length})
            </summary>
            <div className="flex flex-col gap-2">
              {completedTournaments.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-4 rounded-xl border border-[#d9ddcf] bg-white px-5 py-4 opacity-60"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d9ddcf]/40 text-lg">
                    🏆
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#162317] truncate">{event.name}</p>
                    <p className="text-xs text-[#6f7a67]">
                      {event.starts_at ? formatDate(event.starts_at) : "Date TBD"}
                    </p>
                  </div>
                  <span className="text-xs text-[#6f7a67]">Completed</span>
                </div>
              ))}
            </div>
          </details>
        </section>
      )}
    </main>
  );
}
