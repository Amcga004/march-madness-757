import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type ExternalGameSync = {
  id: string;
  external_game_id: string;
  espn_event_name: string | null;
  espn_status: string | null;
  espn_period: number | null;
  espn_clock: string | null;
  start_time: string | null;
  home_team_name: string | null;
  away_team_name: string | null;
  home_score: number | null;
  away_score: number | null;
};

function formatEasternDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatEasternTime(value: string) {
  return new Date(value).toLocaleString([], {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getLiveStatus(game: ExternalGameSync) {
  const status = game.espn_status ?? "";

  if (status === "STATUS_HALFTIME" || status.includes("HALFTIME")) {
    return "Halftime";
  }

  if (status === "STATUS_IN_PROGRESS" || status === "STATUS_END_PERIOD") {
    const clock = game.espn_clock && game.espn_clock !== "0:00" ? game.espn_clock : "";
    const period =
      game.espn_period && game.espn_period > 0 ? `${game.espn_period}H` : "";
    return [clock, period].filter(Boolean).join(" ") || "Live";
  }

  return "Live";
}

function isLiveGame(game: ExternalGameSync) {
  return (
    game.espn_status === "STATUS_IN_PROGRESS" ||
    game.espn_status === "STATUS_END_PERIOD" ||
    game.espn_status === "STATUS_HALFTIME" ||
    (game.espn_status ?? "").includes("HALFTIME")
  );
}

export default async function LiveNowBar() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("external_game_sync")
    .select(
      "id, external_game_id, espn_event_name, espn_status, espn_period, espn_clock, start_time, home_team_name, away_team_name, home_score, away_score"
    )
    .order("start_time", { ascending: true });

  const games = (data ?? []) as ExternalGameSync[];
  const liveGames = games.filter(isLiveGame);

  const now = Date.now();
  const nextGame =
    games
      .filter((game) => !!game.start_time)
      .filter((game) => new Date(game.start_time as string).getTime() >= now)
      .sort(
        (a, b) =>
          new Date(a.start_time as string).getTime() -
          new Date(b.start_time as string).getTime()
      )[0] ?? null;

  if (liveGames.length === 0 && !nextGame) {
    return null;
  }

  return (
    <div className="border-b border-slate-800/80 bg-[#06101d]/95 text-white">
      <div className="mx-auto max-w-7xl px-3 py-1.5 sm:px-6">
        {liveGames.length > 0 ? (
          <div className="flex items-center gap-2">
            <span className="shrink-0 rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-red-300 sm:text-[10px]">
              Live
            </span>

            <div className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1">
              {liveGames.map((game) => (
                <Link
                  key={game.id}
                  href="/scores"
                  className="shrink-0 rounded-xl border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[10px] transition hover:bg-red-500/15 sm:text-xs"
                >
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="font-semibold text-white">
                      {game.away_team_name ?? "Away"} {game.away_score ?? "—"}
                    </span>
                    <span className="text-slate-400">vs</span>
                    <span className="font-semibold text-white">
                      {game.home_team_name ?? "Home"} {game.home_score ?? "—"}
                    </span>
                    <span className="text-red-300">• {getLiveStatus(game)}</span>
                  </div>
                </Link>
              ))}
            </div>

            <Link
              href="/scores"
              className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300 transition hover:text-white"
            >
              Scores
            </Link>
          </div>
        ) : nextGame ? (
          <div className="flex items-center gap-2">
            <span className="shrink-0 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-blue-300 sm:text-[10px]">
              Next
            </span>

            <div className="min-w-0 flex-1 truncate text-[11px] text-slate-300 sm:text-sm">
              <span className="font-semibold text-white">
                {nextGame.away_team_name ?? "Away"} vs {nextGame.home_team_name ?? "Home"}
              </span>
              <span className="text-slate-400">
                {" "}•{" "}
                {nextGame.start_time
                  ? formatEasternTime(nextGame.start_time)
                  : "Scheduled"}
              </span>
            </div>

            {nextGame.start_time ? (
              <div className="hidden text-[10px] text-slate-400 sm:block">
                {formatEasternDateTime(nextGame.start_time)}
              </div>
            ) : null}

            <Link
              href="/scores"
              className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300 transition hover:text-white"
            >
              Scores
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}