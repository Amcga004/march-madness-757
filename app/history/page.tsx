import { createClient } from "@/lib/supabase/server";
import TeamLogo from "../components/TeamLogo";

type Game = {
  id: string;
  round_name: string;
  winning_team_id: string | null;
  losing_team_id: string | null;
  status: string | null;
  created_at: string;
  external_game_id: string | null;
};

type Team = {
  id: string;
  school_name: string;
};

type ExternalGameSync = {
  external_game_id: string;
  home_score: number | null;
  away_score: number | null;
  espn_status: string | null;
  home_team_name: string | null;
  away_team_name: string | null;
  mapped_home_team_id: string | null;
  mapped_away_team_id: string | null;
};

function formatEasternDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    timeZone: "America/New_York",
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getDisplayStatus(status: string | null) {
  if (!status) return "Final";
  if (status === "STATUS_FINAL" || status === "complete") return "Final";
  return status.replace("STATUS_", "").replaceAll("_", " ").trim();
}

function getWinnerLoserRows(args: {
  homeName: string;
  awayName: string;
  homeScore: number | null;
  awayScore: number | null;
  statusLabel: string;
}) {
  const { homeName, awayName, homeScore, awayScore, statusLabel } = args;

  const isFinal = statusLabel.toLowerCase() === "final";
  const hasScores = homeScore !== null && awayScore !== null;

  if (!isFinal || !hasScores) {
    return {
      top: {
        name: homeName,
        score: homeScore,
        winner: false,
        loser: false,
      },
      bottom: {
        name: awayName,
        score: awayScore,
        winner: false,
        loser: false,
      },
    };
  }

  const homeWon = (homeScore ?? 0) > (awayScore ?? 0);

  return {
    top: {
      name: homeName,
      score: homeScore,
      winner: homeWon,
      loser: !homeWon,
    },
    bottom: {
      name: awayName,
      score: awayScore,
      winner: !homeWon,
      loser: homeWon,
    },
  };
}

function ResultTeamRow({
  teamName,
  score,
  winner,
  loser,
  size = 22,
}: {
  teamName: string;
  score: number | null;
  winner: boolean;
  loser: boolean;
  size?: number;
}) {
  const winnerClasses = winner
    ? "border-green-500/60 bg-green-500/12 text-green-200"
    : "";
  const loserClasses = loser
    ? "border-red-500/60 bg-red-500/12 text-red-200"
    : "";
  const neutralClasses =
    !winner && !loser ? "border-slate-700/80 bg-[#172033] text-white" : "";

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${winnerClasses} ${loserClasses} ${neutralClasses}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <TeamLogo teamName={teamName} size={size} />
        <span
          className={`truncate text-sm font-semibold ${
            loser ? "line-through opacity-90" : ""
          }`}
        >
          {teamName}
        </span>
      </div>
      <div className="text-base font-bold">{score ?? "—"}</div>
    </div>
  );
}

export default async function HistoryPage() {
  const supabase = await createClient();

  const [
    { data: games, error: gamesError },
    { data: teams, error: teamsError },
    { data: externalGames, error: externalGamesError },
  ] = await Promise.all([
    supabase
      .from("games")
      .select("id, round_name, winning_team_id, losing_team_id, status, created_at, external_game_id")
      .order("created_at", { ascending: false }),
    supabase.from("teams").select("id, school_name"),
    supabase
      .from("external_game_sync")
      .select(
        "external_game_id, home_score, away_score, espn_status, home_team_name, away_team_name, mapped_home_team_id, mapped_away_team_id"
      ),
  ]);

  const error = gamesError || teamsError || externalGamesError;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl p-8">
        <h1 className="text-3xl font-bold text-white">Results History</h1>
        <p className="mt-4 text-red-300">Error loading history: {error.message}</p>
      </main>
    );
  }

  const typedGames = (games ?? []) as Game[];
  const typedTeams = (teams ?? []) as Team[];
  const typedExternalGames = (externalGames ?? []) as ExternalGameSync[];

  const latestRecordedResultAt = typedGames[0]?.created_at ?? null;

  const teamMap = new Map<string, string>(
    typedTeams.map((team) => [team.id, team.school_name])
  );

  const externalGameMap = new Map<string, ExternalGameSync>(
    typedExternalGames.map((game) => [game.external_game_id, game])
  );

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Results
          </div>
          <h1 className="mt-1 text-3xl font-bold text-white">Results History</h1>
          <p className="mt-2 text-slate-300">
            Every recorded game result entered into the app.
          </p>
        </div>

        <div className="text-sm text-slate-400">
          {latestRecordedResultAt
            ? `Last result recorded: ${formatEasternDateTime(latestRecordedResultAt)}`
            : "No game results recorded yet"}
        </div>
      </div>

      <div className="space-y-3">
        {typedGames.length === 0 ? (
          <div className="rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-4 text-slate-400 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
            No game results recorded yet.
          </div>
        ) : (
          typedGames.map((game) => {
            const winnerName = teamMap.get(game.winning_team_id ?? "") ?? "Unknown winner";
            const loserName = teamMap.get(game.losing_team_id ?? "") ?? "Unknown loser";
            const externalGame =
              game.external_game_id ? externalGameMap.get(game.external_game_id) ?? null : null;

            const homeScore = externalGame?.home_score ?? null;
            const awayScore = externalGame?.away_score ?? null;
            const statusLabel = getDisplayStatus(externalGame?.espn_status ?? game.status ?? null);

            const homeName =
              externalGame?.mapped_home_team_id
                ? teamMap.get(externalGame.mapped_home_team_id) ??
                  externalGame.home_team_name ??
                  "Home"
                : externalGame?.home_team_name ?? winnerName;

            const awayName =
              externalGame?.mapped_away_team_id
                ? teamMap.get(externalGame.mapped_away_team_id) ??
                  externalGame.away_team_name ??
                  "Away"
                : externalGame?.away_team_name ?? loserName;

            const rows = getWinnerLoserRows({
              homeName,
              awayName,
              homeScore,
              awayScore,
              statusLabel,
            });

            return (
              <div
                key={game.id}
                className="rounded-2xl border border-slate-700/80 bg-[#111827]/90 px-4 py-3 shadow-[0_12px_28px_rgba(0,0,0,0.24)]"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {game.round_name}
                  </div>
                  <div className="text-xs text-slate-400">
                    {formatEasternDateTime(game.created_at)}
                  </div>
                </div>

                <div className="grid gap-2">
                  <ResultTeamRow
                    teamName={rows.top.name}
                    score={rows.top.score}
                    winner={rows.top.winner}
                    loser={rows.top.loser}
                    size={22}
                  />

                  <ResultTeamRow
                    teamName={rows.bottom.name}
                    score={rows.bottom.score}
                    winner={rows.bottom.winner}
                    loser={rows.bottom.loser}
                    size={22}
                  />

                  <div className="pt-1 text-center text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {statusLabel}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}