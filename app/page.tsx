import { createClient } from "@/lib/supabase/server";
import ManagerBadge from "./components/ManagerBadge";
import TeamLogo from "./components/TeamLogo";
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
  raw_payload: unknown;
};

type TeamStats = {
  fgPct: string;
  threePtPct: string;
  ftPct: string;
  rebounds: string;
  assists: string;
  turnovers: string;
};

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-xl border border-slate-700/80 bg-[#172033] px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="text-[9px] uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-bold text-white">{value}</div>
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
    <div className="rounded-2xl border border-slate-700/80 bg-[#111827]/90 p-2.5 shadow-[0_10px_22px_rgba(0,0,0,0.22)]">
      <div className="text-[9px] uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-base font-bold leading-tight text-white">{value}</div>
      {subtext ? <div className="mt-0.5 text-[11px] text-slate-300">{subtext}</div> : null}
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
    <section className="rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white sm:text-base">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-[11px] text-slate-300 sm:text-xs">{subtitle}</p> : null}
        </div>
        {rightLabel ? <div className="text-[10px] text-slate-400">{rightLabel}</div> : null}
      </div>
      {children}
    </section>
  );
}

function CompactDetailsSection({
  title,
  rightLabel,
  defaultOpen = false,
  children,
}: {
  title: string;
  rightLabel?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.22)]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white sm:text-base">{title}</div>
          {rightLabel ? (
            <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-400">
              {rightLabel}
            </div>
          ) : null}
        </div>
        <div className="shrink-0 text-slate-300 transition-transform duration-200 group-open:rotate-180">
          ▼
        </div>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
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

function getGameTeams(game: ExternalGameSync, teamMap: Map<string, string>) {
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

function parseRawPayload(rawPayload: unknown): any | null {
  if (!rawPayload) return null;

  if (typeof rawPayload === "string") {
    try {
      return JSON.parse(rawPayload);
    } catch {
      return null;
    }
  }

  if (typeof rawPayload === "object") {
    return rawPayload;
  }

  return null;
}

function getCompetitorsFromPayload(rawPayload: unknown): any[] {
  const parsed = parseRawPayload(rawPayload);
  return parsed?.competitions?.[0]?.competitors ?? [];
}

function findCompetitorBySide(rawPayload: unknown, side: "home" | "away") {
  const competitors = getCompetitorsFromPayload(rawPayload);
  return competitors.find((competitor: any) => competitor?.homeAway === side) ?? null;
}

function getStatDisplayValue(competitor: any, statName: string) {
  const stats = competitor?.statistics ?? [];
  const match = stats.find((stat: any) => stat?.name === statName);
  return match?.displayValue ?? "—";
}

function getTeamStats(rawPayload: unknown, side: "home" | "away"): TeamStats | null {
  const competitor = findCompetitorBySide(rawPayload, side);
  if (!competitor) return null;

  return {
    fgPct: getStatDisplayValue(competitor, "fieldGoalPct"),
    threePtPct: getStatDisplayValue(competitor, "threePointFieldGoalPct"),
    ftPct: getStatDisplayValue(competitor, "freeThrowPct"),
    rebounds: getStatDisplayValue(competitor, "rebounds"),
    assists: getStatDisplayValue(competitor, "assists"),
    turnovers: getStatDisplayValue(competitor, "turnovers"),
  };
}

function StatRow({
  label,
  awayValue,
  homeValue,
}: {
  label: string;
  awayValue: string;
  homeValue: string;
}) {
  return (
    <div className="grid grid-cols-[52px_1fr_1fr] items-center gap-2 rounded-xl border border-slate-700/80 bg-[#0f172a] px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </div>
      <div className="text-center text-xs font-semibold text-white">{awayValue}</div>
      <div className="text-center text-xs font-semibold text-white">{homeValue}</div>
    </div>
  );
}

function TeamStatsBlock({
  awayName,
  homeName,
  awayStats,
  homeStats,
}: {
  awayName: string;
  homeName: string;
  awayStats: TeamStats | null;
  homeStats: TeamStats | null;
}) {
  if (!awayStats || !homeStats) {
    return (
      <div className="rounded-xl border border-slate-700/80 bg-[#0f172a] px-3 py-3 text-xs text-slate-400">
        Team stats not available yet.
      </div>
    );
  }

  return (
    <div className="mt-2">
      <div className="mb-2 grid grid-cols-[52px_1fr_1fr] items-center gap-2 px-1">
        <div />
        <div className="truncate text-center text-[11px] font-semibold text-slate-300">
          {awayName}
        </div>
        <div className="truncate text-center text-[11px] font-semibold text-slate-300">
          {homeName}
        </div>
      </div>

      <div className="space-y-1.5">
        <StatRow label="FG%" awayValue={awayStats.fgPct} homeValue={homeStats.fgPct} />
        <StatRow label="3P%" awayValue={awayStats.threePtPct} homeValue={homeStats.threePtPct} />
        <StatRow label="FT%" awayValue={awayStats.ftPct} homeValue={homeStats.ftPct} />
        <StatRow label="REB" awayValue={awayStats.rebounds} homeValue={homeStats.rebounds} />
        <StatRow label="AST" awayValue={awayStats.assists} homeValue={homeStats.assists} />
        <StatRow label="TO" awayValue={awayStats.turnovers} homeValue={homeStats.turnovers} />
      </div>
    </div>
  );
}

function ExpandableSlateGameCard({
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

  const awayStats = getTeamStats(game.raw_payload, "away");
  const homeStats = getTeamStats(game.raw_payload, "home");
  const showStats = isLive || isFinal;

  const cardClasses = isLive
    ? "border-red-500/60 bg-[#1a1220] shadow-[0_0_0_1px_rgba(239,68,68,0.14),0_0_18px_rgba(239,68,68,0.10)]"
    : "border-slate-700/80 bg-[#172033]";

  const statusClasses = isLive ? "text-red-300" : "text-slate-400";

  return (
    <details className={`group rounded-2xl border ${cardClasses}`}>
      <summary className={`cursor-pointer list-none ${compact ? "px-2.5 py-2" : "px-3 py-2.5"}`}>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {game.round_name ?? "Tournament Game"}
          </div>
          <div className="flex items-center gap-2">
            <div className={`text-[9px] font-semibold uppercase tracking-[0.14em] ${statusClasses}`}>
              {statusLabel}
            </div>
            {(showStats && (awayStats || homeStats)) ? (
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-300 transition-transform duration-200 group-open:rotate-180">
                ▼
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-1.5">
          <div
            className={`flex items-center justify-between gap-2 rounded-xl border px-2.5 py-1.5 ${
              isFinal && game.away_score !== null && game.home_score !== null && game.away_score > game.home_score
                ? "border-green-500/60 bg-green-500/10 text-green-200"
                : isFinal && game.away_score !== null && game.home_score !== null && game.away_score < game.home_score
                ? "border-red-500/60 bg-red-500/10 text-red-200 line-through"
                : "border-slate-700/80 bg-[#0f172a] text-white"
            }`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <TeamLogo teamName={awayName} size={15} />
              <span className="truncate text-[13px] font-semibold">{awayName}</span>
            </div>
            <div className="text-[13px] font-bold">{game.away_score ?? "—"}</div>
          </div>

          <div
            className={`flex items-center justify-between gap-2 rounded-xl border px-2.5 py-1.5 ${
              isFinal && game.home_score !== null && game.away_score !== null && game.home_score > game.away_score
                ? "border-green-500/60 bg-green-500/10 text-green-200"
                : isFinal && game.home_score !== null && game.away_score !== null && game.home_score < game.away_score
                ? "border-red-500/60 bg-red-500/10 text-red-200 line-through"
                : "border-slate-700/80 bg-[#0f172a] text-white"
            }`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <TeamLogo teamName={homeName} size={15} />
              <span className="truncate text-[13px] font-semibold">{homeName}</span>
            </div>
            <div className="text-[13px] font-bold">{game.home_score ?? "—"}</div>
          </div>
        </div>
      </summary>

      {showStats ? (
        <div className="border-t border-slate-700/80 px-2.5 pb-2.5 pt-2">
          <TeamStatsBlock
            awayName={awayName}
            homeName={homeName}
            awayStats={awayStats}
            homeStats={homeStats}
          />
        </div>
      ) : null}
    </details>
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
    <div className="rounded-2xl border border-dashed border-slate-700 bg-[#0f172a] px-4 py-5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="mt-1.5 text-xs text-slate-400 sm:text-sm">{body}</div>
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
      .limit(20),
    supabase.from("teams").select("id, school_name, seed, region"),
    supabase
      .from("external_game_sync")
      .select(
        "id, external_game_id, home_score, away_score, espn_status, espn_period, espn_clock, start_time, round_name, home_team_name, away_team_name, mapped_home_team_id, mapped_away_team_id, raw_payload"
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

  const recentResults = typedGames.slice(0, 6);

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
  const topThree = forecasts.slice(0, 3);
  const remainingManagers = forecasts.slice(3);

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
    <div className="mx-auto max-w-7xl p-3 sm:p-4 md:p-6">
      <section className="mb-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Home
            </div>
            <h2 className="mt-1 text-2xl font-bold leading-tight text-white sm:text-3xl">
              League Pulse
            </h2>
          </div>

          <div className="text-right text-[10px] text-slate-400 sm:text-xs">
            {latestUpdated ? `Updated ${formatEasternDateTime(latestUpdated)}` : "No results yet"}
          </div>
        </div>
      </section>

      <section className="mb-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
        <SummaryTile
          label="Leader"
          value={leader ? leader.displayName : "—"}
          subtext={leader ? `${leader.currentPoints} pts` : "No standings yet"}
        />
        <SummaryTile
          label="Most Alive"
          value={mostLiveTeams ? mostLiveTeams.displayName : "—"}
          subtext={mostLiveTeams ? `${mostLiveTeams.liveTeams} alive` : "No active teams"}
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
          label="Today"
          value={todaysGames.length}
          subtext={
            todaysGames.length > 0
              ? `${todaysLiveGames.length} live • ${todaysUpcomingGames.length} next`
              : "No games today"
          }
        />
      </section>

      <div className="space-y-3">
        {liveGames.length > 0 ? (
          <SectionShell
            title="Live Now"
            subtitle="Tap a game card to expand team stats."
            rightLabel={`${liveGames.length} live`}
          >
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {liveGames.map((game) => (
                <ExpandableSlateGameCard
                  key={game.external_game_id}
                  game={game}
                  teamMap={teamMap}
                  compact
                />
              ))}
            </div>
          </SectionShell>
        ) : (
          <SectionShell
            title="Next Up"
            subtitle={nextGame ? "No games live. Next tip on deck." : "No live games in the current feed window."}
            rightLabel={nextGame?.start_time ? formatEasternDateTime(nextGame.start_time) : undefined}
          >
            {nextGame ? (
              <ExpandableSlateGameCard
                game={nextGame}
                teamMap={teamMap}
                compact
              />
            ) : (
              <EmptyStateCard
                title="No active games right now"
                body="Once games tip, this section becomes your live tracker."
              />
            )}
          </SectionShell>
        )}

        <SectionShell
          title="Top of the League"
          subtitle="Fast standings snapshot."
          rightLabel="Top 3"
        >
          <div className="space-y-2">
            {topThree.length === 0 ? (
              <EmptyStateCard
                title="No standings yet"
                body="Once games are recorded, manager standings will appear here."
              />
            ) : (
              topThree.map((forecast: ManagerForecast, index: number) => (
                <div
                  key={forecast.memberId}
                  className="rounded-2xl border border-slate-700/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(23,32,51,0.96))] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="text-sm font-semibold text-slate-400">#{index + 1}</div>
                      <ManagerBadge name={forecast.displayName} />
                    </div>

                    <div className="text-right">
                      <div className="text-[9px] text-slate-400">Points</div>
                      <div className="text-base font-bold text-white">
                        {forecast.currentPoints}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-4 gap-2">
                    <MiniStat label="Alive" value={forecast.liveTeams} />
                    <MiniStat label="Out" value={forecast.eliminatedTeams} />
                    <MiniStat label="Upside" value={forecast.remainingUpside} />
                    <MiniStat label="Max" value={forecast.maxFinalPoints} />
                  </div>
                </div>
              ))
            )}
          </div>

          {remainingManagers.length > 0 ? (
            <details className="mt-2 rounded-2xl border border-slate-700/80 bg-[#0f172a]/80 p-3">
              <summary className="cursor-pointer list-none text-sm font-semibold text-slate-200">
                Show full standings
              </summary>

              <div className="mt-3 space-y-2">
                {remainingManagers.map((forecast: ManagerForecast, index: number) => (
                  <div
                    key={forecast.memberId}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-700/80 bg-[#172033] px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="text-sm font-semibold text-slate-400">#{index + 4}</div>
                      <div className="truncate text-sm font-semibold text-white">
                        {forecast.displayName}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-300">
                      <span>{forecast.currentPoints} pts</span>
                      <span>{forecast.liveTeams} alive</span>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </SectionShell>

        <CompactDetailsSection
          title="Tournament Progress"
          rightLabel="Round tracking"
          defaultOpen={false}
        >
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {roundProgress.map((round) => (
              <div
                key={round.round}
                className="rounded-2xl border border-slate-700/80 bg-[#172033] px-2.5 py-2.5 text-center"
              >
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {round.short}
                </div>
                <div className="mt-0.5 text-sm font-bold text-white">
                  {round.completed}/{round.total}
                </div>
              </div>
            ))}
          </div>
        </CompactDetailsSection>