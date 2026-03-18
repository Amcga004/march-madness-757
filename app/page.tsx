import { createClient } from "@/lib/supabase/server";
import ManagerBadge from "./components/ManagerBadge";
import TeamLogo from "./components/TeamLogo";
import AutoRefreshClient from "./components/AutoRefreshClient";
import {
  computeLeagueForecasts,
  type ForecastGame,
  type ForecastMember,
  type ForecastPick,
  type ForecastTeam,
  type ForecastTeamResult,
  type ManagerForecast,
} from "@/lib/bracketForecast";

type Member = {
  id: string;
  display_name: string;
  draft_slot: number;
};

type Pick = {
  id: string;
  member_id: string;
  team_id: string;
  overall_pick: number;
};

type TeamResult = {
  id: string;
  team_id: string;
  total_points: number;
  eliminated: boolean;
};

type Game = {
  id: string;
  round_name: string;
  winning_team_id: string | null;
  losing_team_id: string | null;
  created_at: string;
  external_game_id: string | null;
  status?: string | null;
};

type Team = {
  id: string;
  school_name: string;
  seed: number;
  region: string;
};

type ExternalGameSync = {
  id?: string;
  external_game_id: string;
  home_score: number | null;
  away_score: number | null;
  espn_status: string | null;
  espn_period: number | null;
  espn_clock: string | null;
  start_time: string | null;
  round_name: string | null;
  home_team_name: string | null;
  away_team_name: string | null;
  mapped_home_team_id: string | null;
  mapped_away_team_id: string | null;
};

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border border-slate-700/80 bg-[#172033] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-base font-bold text-white">{value}</div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string | number;
  subtext?: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-xl font-bold text-white">{value}</div>
      {subtext ? <div className="mt-1 text-sm text-slate-300">{subtext}</div> : null}
    </div>
  );
}

function SectionShell({
  title,
  subtitle,
  rightLabel,
  children,
}: {
  title: string;
  subtitle?: string;
  rightLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.28)] sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-slate-300">{subtitle}</p> : null}
        </div>
        {rightLabel ? <div className="text-xs text-slate-400">{rightLabel}</div> : null}
      </div>
      {children}
    </section>
  );
}

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

function isLiveStatus(status: string | null | undefined) {
  if (!status) return false;

  return (
    status === "STATUS_IN_PROGRESS" ||
    status === "STATUS_END_PERIOD" ||
    status === "STATUS_HALFTIME" ||
    status.includes("HALFTIME")
  );
}

function isFinalStatus(status: string | null | undefined) {
  return status === "STATUS_FINAL" || status === "complete";
}

function isScheduledStatus(status: string | null | undefined) {
  return !status || status === "STATUS_SCHEDULED";
}

function getDisplayStatus(game: ExternalGameSync | null, fallbackStatus?: string | null) {
  const status = game?.espn_status ?? fallbackStatus ?? null;

  if (!status) return "Scheduled";

  if (status === "STATUS_FINAL" || status === "complete") {
    return "Final";
  }

  if (status.includes("HALFTIME")) {
    return "Halftime";
  }

  if (
    status === "STATUS_IN_PROGRESS" ||
    status === "STATUS_END_PERIOD" ||
    status === "STATUS_HALFTIME"
  ) {
    const clock = game?.espn_clock && game.espn_clock !== "0:00" ? game.espn_clock : "";
    const period = game?.espn_period && game.espn_period > 0 ? `${game.espn_period}H` : "";
    const pieces = [clock, period].filter(Boolean);

    return pieces.length > 0 ? `Live • ${pieces.join(" ")}` : "Live";
  }

  if (status === "STATUS_SCHEDULED" && game?.start_time) {
    return formatEasternTime(game.start_time);
  }

  return status.replace("STATUS_", "").replaceAll("_", " ").trim();
}

function getGameTeams(
  game: ExternalGameSync,
  teamMap: Map<string, string>
) {
  const homeName =
    game.mapped_home_team_id
      ? teamMap.get(game.mapped_home_team_id) ?? game.home_team_name ?? "Home"
      : game.home_team_name ?? "Home";

  const awayName =
    game.mapped_away_team_id
      ? teamMap.get(game.mapped_away_team_id) ?? game.away_team_name ?? "Away"
      : game.away_team_name ?? "Away";

  return {
    homeName,
    awayName,
  };
}

function SlateGameCard({
  game,
  teamMap,
  compact = false,
}: {
  game: ExternalGameSync;
  teamMap: Map<string, string>;
  compact?: boolean;
}) {
  const { homeName, awayName } = getGameTeams(game, teamMap);
  const isLive = isLiveStatus(game.espn_status);
  const isFinal = isFinalStatus(game.espn_status);
  const statusLabel = getDisplayStatus(game);

  const cardClasses = isLive
    ? "border-red-500/60 bg-[#1a1220] shadow-[0_0_0_1px_rgba(239,68,68,0.14),0_0_18px_rgba(239,68,68,0.10)]"
    : isFinal
    ? "border-slate-700/80 bg-[#172033]"
    : "border-slate-700/80 bg-[#172033]";

  const statusClasses = isLive ? "text-red-300" : "text-slate-400";

  return (
    <div className={`rounded-2xl border ${cardClasses} ${compact ? "px-3 py-2" : "px-3 py-3"}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {game.round_name ?? "Tournament Game"}
        </div>
        <div className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${statusClasses}`}>
          {statusLabel}
        </div>
      </div>

      <div className="grid gap-2">
        <div
          className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${
            isFinal && game.away_score !== null && game.home_score !== null && game.away_score > game.home_score
              ? "border-green-500/60 bg-green-500/10 text-green-200"
              : isFinal && game.away_score !== null && game.home_score !== null && game.away_score < game.home_score
              ? "border-red-500/60 bg-red-500/10 text-red-200 line-through"
              : "border-slate-700/80 bg-[#0f172a] text-white"
          }`}
        >
          <div className="flex min-w-0 items-center gap-2">
            <TeamLogo teamName={awayName} size={18} />
            <span className="truncate text-sm font-semibold">{awayName}</span>
          </div>
          <div className="text-sm font-bold">{game.away_score ?? "—"}</div>
        </div>

        <div
          className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${
            isFinal && game.home_score !== null && game.away_score !== null && game.home_score > game.away_score
              ? "border-green-500/60 bg-green-500/10 text-green-200"
              : isFinal && game.home_score !== null && game.away_score !== null && game.home_score < game.away_score
              ? "border-red-500/60 bg-red-500/10 text-red-200 line-through"
              : "border-slate-700/80 bg-[#0f172a] text-white"
          }`}
        >
          <div className="flex min-w-0 items-center gap-2">
            <TeamLogo teamName={homeName} size={18} />
            <span className="truncate text-sm font-semibold">{homeName}</span>
          </div>
          <div className="text-sm font-bold">{game.home_score ?? "—"}</div>
        </div>
      </div>
    </div>
  );
}

function EmptyStateCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 bg-[#0f172a] px-4 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <div className="text-base font-semibold text-white">{title}</div>
      <div className="mt-2 text-sm text-slate-400">{body}</div>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { data: members },
    { data: picks },
    { data: teamResults },
    { data: games },
    { data: teams },
    { data: externalGames },
  ] = await Promise.all([
    supabase.from("league_members").select("*").order("draft_slot", { ascending: true }),
    supabase.from("picks").select("*").order("overall_pick", { ascending: true }),
    supabase.from("team_results").select("*"),
    supabase
      .from("games")
      .select("id, round_name, winning_team_id, losing_team_id, created_at, external_game_id, status")
      .order("created_at", { ascending: false })
      .limit(12),
    supabase.from("teams").select("id, school_name, seed, region"),
    supabase
      .from("external_game_sync")
      .select(
        "id, external_game_id, home_score, away_score, espn_status, espn_period, espn_clock, start_time, round_name, home_team_name, away_team_name, mapped_home_team_id, mapped_away_team_id"
      )
      .order("start_time", { ascending: true }),
  ]);

  const typedMembers = (members ?? []) as Member[];
  const typedPicks = (picks ?? []) as Pick[];
  const typedResults = (teamResults ?? []) as TeamResult[];
  const typedGames = (games ?? []) as Game[];
  const typedTeams = (teams ?? []) as Team[];
  const typedExternalGames = (externalGames ?? []) as ExternalGameSync[];

  const teamMap = new Map<string, string>(typedTeams.map((team) => [team.id, team.school_name]));
  const externalGameMap = new Map<string, ExternalGameSync>(
    typedExternalGames.map((game) => [game.external_game_id, game])
  );

  const latestUpdated = typedGames[0]?.created_at ?? null;

  const forecasts: ManagerForecast[] = computeLeagueForecasts({
    members: typedMembers as ForecastMember[],
    picks: typedPicks as ForecastPick[],
    teams: typedTeams as ForecastTeam[],
    teamResults: typedResults as ForecastTeamResult[],
    games: typedGames as ForecastGame[],
  }).sort((a: ManagerForecast, b: ManagerForecast) => {
    if (b.currentPoints !== a.currentPoints) return b.currentPoints - a.currentPoints;
    if (b.liveTeams !== a.liveTeams) return b.liveTeams - a.liveTeams;
    return b.maxFinalPoints - a.maxFinalPoints;
  });

  const roundTargets: Record<string, number> = {
    "Round of 64": 32,
    "Round of 32": 16,
    "Sweet 16": 8,
    "Elite Eight": 4,
    "Final Four": 2,
    Championship: 1,
  };

  const roundProgress = Object.entries(roundTargets).map(([round, total]) => ({
    short:
      round === "Round of 64"
        ? "R64"
        : round === "Round of 32"
        ? "R32"
        : round === "Sweet 16"
        ? "S16"
        : round === "Elite Eight"
        ? "E8"
        : round === "Final Four"
        ? "F4"
        : "Title",
    round,
    total,
    completed: typedGames.filter((game) => game.round_name === round).length,
  }));

  const mobileRecentResults = typedGames.slice(0, 4);
  const desktopRecentResults = typedGames.slice(0, 6);

  const liveGames = typedExternalGames.filter((game) => isLiveStatus(game.espn_status));
  const nextGame =
    typedExternalGames.find(
      (game) =>
        isScheduledStatus(game.espn_status) &&
        !!game.start_time &&
        new Date(game.start_time).getTime() >= Date.now()
    ) ?? null;

  const todaysGames = typedExternalGames.filter((game) => {
    if (!game.start_time) return false;

    const gameDate = new Date(game.start_time).toLocaleDateString("en-US", {
      timeZone: "America/New_York",
    });

    const todayDate = new Date().toLocaleDateString("en-US", {
      timeZone: "America/New_York",
    });

    return gameDate === todayDate;
  });

  const todaysLiveGames = todaysGames.filter((game) => isLiveStatus(game.espn_status));
  const todaysUpcomingGames = todaysGames.filter((game) => isScheduledStatus(game.espn_status));
  const todaysFinalGames = todaysGames.filter((game) => isFinalStatus(game.espn_status));

  const leader = forecasts[0] ?? null;
  const mostLiveTeams = forecasts.reduce<ManagerForecast | null>((best, current) => {
    if (!best) return current;
    if (current.liveTeams > best.liveTeams) return current;
    if (current.liveTeams === best.liveTeams && current.currentPoints > best.currentPoints) {
      return current;
    }
    return best;
  }, null);

  const closestRaceDiff =
    forecasts.length >= 2 ? Math.abs(forecasts[0].currentPoints - forecasts[1].currentPoints) : 0;

  const slateSections = [
    { key: "live", label: "Live", games: todaysLiveGames, tone: "text-red-300" },
    { key: "upcoming", label: "Upcoming", games: todaysUpcomingGames, tone: "text-blue-300" },
    { key: "final", label: "Final", games: todaysFinalGames, tone: "text-slate-400" },
  ].filter((section) => section.games.length > 0);

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <AutoRefreshClient intervalMs={15000} hiddenIntervalMs={60000} />

      <section className="mb-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Dashboard
            </div>
            <h2 className="mt-1 text-3xl font-bold text-white sm:text-4xl">
              League Pulse
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              Fast view of standings, live action, and what matters next.
            </p>
          </div>

          <div className="text-sm text-slate-400">
            {latestUpdated
              ? `Updated ${formatEasternDateTime(latestUpdated)}`
              : "No results entered yet"}
          </div>
        </div>
      </section>

      {liveGames.length > 0 ? (
        <SectionShell
          title="Live Now"
          subtitle="Active tournament games happening right now."
          rightLabel="Live"
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {liveGames.map((game) => (
              <SlateGameCard
                key={game.external_game_id}
                game={game}
                teamMap={teamMap}
              />
            ))}
          </div>
        </SectionShell>
      ) : (
        <SectionShell
          title="No Games Live Right Now"
          subtitle={
            nextGame
              ? "Nothing is currently in progress. The next scheduled tip is below."
              : "No active games are in the current feed window."
          }
        >
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="rounded-2xl border border-dashed border-slate-700 bg-[#0f172a] px-4 py-5">
              <div className="text-base font-semibold text-white">
                Live scoreboard is standing by
              </div>
              <div className="mt-2 text-sm text-slate-400">
                Once a game tips, this area will automatically turn into your live game tracker.
              </div>
            </div>

            {nextGame ? (
              <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 px-4 py-4 text-sm text-blue-200">
                Next Tip • {nextGame.start_time ? formatEasternDateTime(nextGame.start_time) : "Scheduled"}
              </div>
            ) : null}
          </div>
        </SectionShell>
      )}

      <div className="mt-5">
        {nextGame ? (
          <SectionShell
            title="Next Tip"
            subtitle="Next scheduled tournament game on deck."
          >
            <div className="rounded-2xl border border-slate-700/80 bg-[#172033] p-4">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {nextGame.round_name ?? "Tournament Game"}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <TeamLogo teamName={getGameTeams(nextGame, teamMap).awayName} size={22} />
                    <span className="text-sm font-semibold text-white">
                      {getGameTeams(nextGame, teamMap).awayName}
                    </span>
                  </div>
                  <span className="text-slate-500">vs</span>
                  <div className="flex items-center gap-2">
                    <TeamLogo teamName={getGameTeams(nextGame, teamMap).homeName} size={22} />
                    <span className="text-sm font-semibold text-white">
                      {getGameTeams(nextGame, teamMap).homeName}
                    </span>
                  </div>
                </div>

                <div className="text-sm font-semibold text-slate-300">
                  {nextGame.start_time ? formatEasternDateTime(nextGame.start_time) : "Scheduled"}
                </div>
              </div>
            </div>
          </SectionShell>
        ) : null}
      </div>

      <section className="my-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile
          label="Leader"
          value={leader ? leader.displayName : "—"}
          subtext={leader ? `${leader.currentPoints} points` : "No standings yet"}
        />
        <SummaryTile
          label="Most Live Teams"
          value={mostLiveTeams ? mostLiveTeams.displayName : "—"}
          subtext={mostLiveTeams ? `${mostLiveTeams.liveTeams} still alive` : "No active teams"}
        />
        <SummaryTile
          label="Closest Race"
          value={forecasts.length >= 2 ? `${closestRaceDiff} pts` : "—"}
          subtext={
            forecasts.length >= 2
              ? `${forecasts[0].displayName} vs ${forecasts[1].displayName}`
              : "Need two managers"
          }
        />
        <SummaryTile
          label="Today’s Games"
          value={todaysGames.length}
          subtext={
            todaysGames.length > 0
              ? `${todaysLiveGames.length} live • ${todaysUpcomingGames.length} upcoming • ${todaysFinalGames.length} final`
              : "No games in today’s slate"
          }
        />
      </section>

      <SectionShell
        title="League at a Glance"
        subtitle="Fast standings read with current totals and upside."
        rightLabel="10-second read"
      >
        <div className="space-y-3">
          {forecasts.map((forecast: ManagerForecast, index: number) => (
            <div
              key={forecast.memberId}
              className="rounded-3xl border border-slate-700/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(23,32,51,0.96))] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="text-sm font-semibold text-slate-400">#{index + 1}</div>
                  <ManagerBadge name={forecast.displayName} />
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-400">Points</div>
                  <div className="text-xl font-bold text-white">
                    {forecast.currentPoints}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                <MiniStat label="Alive" value={forecast.liveTeams} />
                <MiniStat label="Out" value={forecast.eliminatedTeams} />
                <MiniStat label="Upside" value={forecast.remainingUpside} />
                <div className="hidden sm:block">
                  <MiniStat label="Max Final" value={forecast.maxFinalPoints} />
                </div>
              </div>

              <div className="mt-2 text-xs text-slate-400 sm:hidden">
                Max Final {forecast.maxFinalPoints}
              </div>
            </div>
          ))}
        </div>
      </SectionShell>

      <section className="my-5 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <SectionShell title="Tournament Progress">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {roundProgress.map((round) => (
              <div
                key={round.round}
                className="rounded-2xl border border-slate-700/80 bg-[#172033] px-3 py-3 text-center"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {round.short}
                </div>
                <div className="mt-1 text-lg font-bold text-white">
                  {round.completed}/{round.total}
                </div>
              </div>
            ))}
          </div>
        </SectionShell>

        <SectionShell title="Quick Totals">
          <div className="grid grid-cols-2 gap-2">
            <MiniStat label="Results" value={typedGames.length} />
            <MiniStat
              label="Teams Scored"
              value={typedResults.filter((r) => r.total_points > 0).length}
            />
            <MiniStat
              label="Live Managers"
              value={forecasts.filter((f) => f.liveTeams > 0).length}
            />
            <MiniStat label="Picks Made" value={typedPicks.length} />
          </div>
        </SectionShell>
      </section>

      <SectionShell
        title="Today’s Slate"
        subtitle="Today’s tournament action grouped by status."
        rightLabel={todaysGames.length > 0 ? `${todaysGames.length} games` : "No games today"}
      >
        {todaysGames.length === 0 ? (
          <EmptyStateCard
            title="No tournament games scheduled today"
            body="When games land in today’s feed window, they’ll appear here grouped into live, upcoming, and final."
          />
        ) : (
          <div className="space-y-5">
            {slateSections.map((section) => (
              <div key={section.key}>
                <div className={`mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] ${section.tone}`}>
                  {section.label}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {section.games.map((game) => (
                    <SlateGameCard
                      key={`${section.key}-${game.external_game_id}`}
                      game={game}
                      teamMap={teamMap}
                      compact
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionShell>

      <div className="mt-5">
        <SectionShell
          title="Latest Results"
          subtitle="Most recent official games recorded in the app."
          rightLabel="Recent official results"
        >
          {typedGames.length === 0 ? (
            <EmptyStateCard
              title="No official results recorded yet"
              body="Once completed games are promoted into the app, they’ll appear here with scorelines and winner/loser styling."
            />
          ) : (
            <>
              <div className="grid gap-2 sm:hidden">
                {mobileRecentResults.map((game) => {
                  const externalGame =
                    game.external_game_id ? externalGameMap.get(game.external_game_id) ?? null : null;

                  const homeName =
                    externalGame?.mapped_home_team_id
                      ? teamMap.get(externalGame.mapped_home_team_id) ??
                        externalGame.home_team_name ??
                        "Home"
                      : externalGame?.home_team_name ??
                        teamMap.get(game.winning_team_id ?? "") ??
                        "Home";

                  const awayName =
                    externalGame?.mapped_away_team_id
                      ? teamMap.get(externalGame.mapped_away_team_id) ??
                        externalGame.away_team_name ??
                        "Away"
                      : externalGame?.away_team_name ??
                        teamMap.get(game.losing_team_id ?? "") ??
                        "Away";

                  const homeScore = externalGame?.home_score ?? null;
                  const awayScore = externalGame?.away_score ?? null;
                  const statusLabel = getDisplayStatus(externalGame, game.status);

                  const awayWon =
                    homeScore !== null && awayScore !== null ? awayScore > homeScore : false;
                  const homeWon =
                    homeScore !== null && awayScore !== null ? homeScore > awayScore : false;

                  return (
                    <div
                      key={game.id}
                      className="rounded-2xl border border-slate-700/80 bg-[#172033] px-3 py-2"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                          {game.round_name}
                        </div>
                        <div className="text-[11px] text-slate-500">{statusLabel}</div>
                      </div>

                      <div className="grid gap-1.5">
                        <div
                          className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${
                            awayWon
                              ? "border-green-500/60 bg-green-500/10 text-green-200"
                              : homeWon
                              ? "border-red-500/60 bg-red-500/10 text-red-200 line-through"
                              : "border-slate-700/80 bg-[#0f172a] text-white"
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <TeamLogo teamName={awayName} size={18} />
                            <span className="truncate text-sm font-semibold">{awayName}</span>
                          </div>
                          <div className="text-sm font-bold">{awayScore ?? "—"}</div>
                        </div>

                        <div
                          className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${
                            homeWon
                              ? "border-green-500/60 bg-green-500/10 text-green-200"
                              : awayWon
                              ? "border-red-500/60 bg-red-500/10 text-red-200 line-through"
                              : "border-slate-700/80 bg-[#0f172a] text-white"
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <TeamLogo teamName={homeName} size={18} />
                            <span className="truncate text-sm font-semibold">{homeName}</span>
                          </div>
                          <div className="text-sm font-bold">{homeScore ?? "—"}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden grid-cols-2 gap-3 sm:grid lg:grid-cols-3">
                {desktopRecentResults.map((game) => {
                  const externalGame =
                    game.external_game_id ? externalGameMap.get(game.external_game_id) ?? null : null;

                  const homeName =
                    externalGame?.mapped_home_team_id
                      ? teamMap.get(externalGame.mapped_home_team_id) ??
                        externalGame.home_team_name ??
                        "Home"
                      : externalGame?.home_team_name ??
                        teamMap.get(game.winning_team_id ?? "") ??
                        "Home";

                  const awayName =
                    externalGame?.mapped_away_team_id
                      ? teamMap.get(externalGame.mapped_away_team_id) ??
                        externalGame.away_team_name ??
                        "Away"
                      : externalGame?.away_team_name ??
                        teamMap.get(game.losing_team_id ?? "") ??
                        "Away";

                  const homeScore = externalGame?.home_score ?? null;
                  const awayScore = externalGame?.away_score ?? null;
                  const statusLabel = getDisplayStatus(externalGame, game.status);

                  const awayWon =
                    homeScore !== null && awayScore !== null ? awayScore > homeScore : false;
                  const homeWon =
                    homeScore !== null && awayScore !== null ? homeScore > awayScore : false;

                  return (
                    <div
                      key={game.id}
                      className="rounded-2xl border border-slate-700/80 bg-[#172033] px-3 py-3"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                          {game.round_name}
                        </div>
                        <div className="text-[11px] text-slate-500">{statusLabel}</div>
                      </div>

                      <div className="grid gap-2">
                        <div
                          className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${
                            awayWon
                              ? "border-green-500/60 bg-green-500/10 text-green-200"
                              : homeWon
                              ? "border-red-500/60 bg-red-500/10 text-red-200 line-through"
                              : "border-slate-700/80 bg-[#0f172a] text-white"
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <TeamLogo teamName={awayName} size={18} />
                            <span className="truncate text-sm font-semibold">{awayName}</span>
                          </div>
                          <div className="text-sm font-bold">{awayScore ?? "—"}</div>
                        </div>

                        <div
                          className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${
                            homeWon
                              ? "border-green-500/60 bg-green-500/10 text-green-200"
                              : awayWon
                              ? "border-red-500/60 bg-red-500/10 text-red-200 line-through"
                              : "border-slate-700/80 bg-[#0f172a] text-white"
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <TeamLogo teamName={homeName} size={18} />
                            <span className="truncate text-sm font-semibold">{homeName}</span>
                          </div>
                          <div className="text-sm font-bold">{homeScore ?? "—"}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </SectionShell>
      </div>
    </div>
  );
}