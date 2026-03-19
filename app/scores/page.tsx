import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TeamLogo from "../components/TeamLogo";

type Team = {
  id: string;
  school_name: string;
  seed: number;
  region: string;
};

type Pick = {
  id: string;
  member_id: string;
  team_id: string;
};

type Member = {
  id: string;
  display_name: string;
};

type ExternalGameSync = {
  id: string;
  external_game_id: string;
  espn_event_name: string | null;
  espn_status: string | null;
  espn_period: number | null;
  espn_clock: string | null;
  start_time: string | null;
  round_name: string | null;
  home_team_name: string | null;
  away_team_name: string | null;
  home_score: number | null;
  away_score: number | null;
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

function getTodayEasternDateString() {
  return new Date().toLocaleDateString("en-US", {
    timeZone: "America/New_York",
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

function getDisplayStatus(game: ExternalGameSync) {
  const status = game.espn_status ?? null;

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
    const clock = game.espn_clock && game.espn_clock !== "0:00" ? game.espn_clock : "";
    const period = game.espn_period && game.espn_period > 0 ? `${game.espn_period}H` : "";
    const pieces = [clock, period].filter(Boolean);

    return pieces.length > 0 ? `Live • ${pieces.join(" ")}` : "Live";
  }

  if (status === "STATUS_SCHEDULED" && game.start_time) {
    return formatEasternTime(game.start_time);
  }

  return status.replace("STATUS_", "").replaceAll("_", " ").trim();
}

function getGameTeams(game: ExternalGameSync, teamMap: Map<string, Team>) {
  const homeTeam = game.mapped_home_team_id
    ? teamMap.get(game.mapped_home_team_id) ?? null
    : null;

  const awayTeam = game.mapped_away_team_id
    ? teamMap.get(game.mapped_away_team_id) ?? null
    : null;

  return {
    homeName: homeTeam?.school_name ?? game.home_team_name ?? "Home",
    awayName: awayTeam?.school_name ?? game.away_team_name ?? "Away",
    homeSeed: homeTeam?.seed ?? null,
    awaySeed: awayTeam?.seed ?? null,
    homeRegion: homeTeam?.region ?? null,
    awayRegion: awayTeam?.region ?? null,
  };
}

function getRegionAnchor(region: string | null | undefined) {
  if (!region) return "finals-section";
  return `${region.toLowerCase()}-region`;
}

function getBracketHref(game: ExternalGameSync, teamMap: Map<string, Team>) {
  const homeRegion = game.mapped_home_team_id
    ? teamMap.get(game.mapped_home_team_id)?.region ?? null
    : null;

  const awayRegion = game.mapped_away_team_id
    ? teamMap.get(game.mapped_away_team_id)?.region ?? null
    : null;

  const roundName = game.round_name ?? "";

  if (roundName === "Final Four" || roundName === "Championship") {
    return "/bracket#finals-section";
  }

  const region = homeRegion ?? awayRegion;
  return `/bracket#${getRegionAnchor(region)}`;
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

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "live" | "upcoming" | "final";
}) {
  const classes =
    tone === "live"
      ? "border-red-500/40 bg-red-500/10 text-red-200"
      : tone === "upcoming"
      ? "border-blue-500/30 bg-blue-500/10 text-blue-200"
      : "border-slate-700/80 bg-[#172033] text-slate-200";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${classes}`}
    >
      {label}
    </span>
  );
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
    <div className="grid grid-cols-[56px_1fr_1fr] items-center gap-2 rounded-xl border border-slate-700/80 bg-[#0f172a] px-3 py-2">
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
    <div className="mt-2.5">
      <div className="mb-2 grid grid-cols-[56px_1fr_1fr] items-center gap-2 px-1">
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

function OwnershipTag({ manager }: { manager: string | null }) {
  if (!manager) return null;

  return (
    <div className="mt-0.5 text-[10px] font-medium text-slate-400">
      {manager}
    </div>
  );
}

function getOwnershipRank(game: ExternalGameSync, managerByTeamId: Map<string, string>) {
  const awayOwned = !!(game.mapped_away_team_id && managerByTeamId.get(game.mapped_away_team_id));
  const homeOwned = !!(game.mapped_home_team_id && managerByTeamId.get(game.mapped_home_team_id));

  if (awayOwned && homeOwned) return 2;
  if (awayOwned || homeOwned) return 1;
  return 0;
}

function sortGamesByLeagueRelevance(
  games: ExternalGameSync[],
  managerByTeamId: Map<string, string>
) {
  return [...games].sort((a, b) => {
    const ownershipDiff = getOwnershipRank(b, managerByTeamId) - getOwnershipRank(a, managerByTeamId);
    if (ownershipDiff !== 0) return ownershipDiff;

    const aTime = a.start_time ? new Date(a.start_time).getTime() : 0;
    const bTime = b.start_time ? new Date(b.start_time).getTime() : 0;
    return aTime - bTime;
  });
}

function ScoreGameCard({
  game,
  teamMap,
  managerByTeamId,
}: {
  game: ExternalGameSync;
  teamMap: Map<string, Team>;
  managerByTeamId: Map<string, string>;
}) {
  const isLive = isLiveStatus(game.espn_status);
  const isFinal = isFinalStatus(game.espn_status);
  const statusLabel = getDisplayStatus(game);
  const { homeName, awayName, homeSeed, awaySeed } = getGameTeams(game, teamMap);

  const awayManager =
    game.mapped_away_team_id ? managerByTeamId.get(game.mapped_away_team_id) ?? null : null;
  const homeManager =
    game.mapped_home_team_id ? managerByTeamId.get(game.mapped_home_team_id) ?? null : null;

  const awayWon =
    isFinal &&
    game.away_score !== null &&
    game.home_score !== null &&
    game.away_score > game.home_score;

  const homeWon =
    isFinal &&
    game.home_score !== null &&
    game.away_score !== null &&
    game.home_score > game.away_score;

  const cardClasses = isLive
    ? "border-red-500/60 bg-[#1a1220] shadow-[0_0_0_1px_rgba(239,68,68,0.14),0_0_18px_rgba(239,68,68,0.10)]"
    : "border-slate-700/80 bg-[#172033]";

  const statusClasses = isLive ? "text-red-300" : "text-slate-400";

  const awayStats = getTeamStats(game.raw_payload, "away");
  const homeStats = getTeamStats(game.raw_payload, "home");
  const showStats = isLive || isFinal;

  return (
    <div className={`rounded-2xl border px-3 py-3 ${cardClasses}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          {game.round_name ?? "Tournament Game"}
        </div>
        <div className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${statusClasses}`}>
          {statusLabel}
        </div>
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
          <div className="flex min-w-0 items-start gap-2">
            <TeamLogo teamName={awayName} size={16} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                {awaySeed ? `${awaySeed}. ` : ""}
                {awayName}
              </div>
              <OwnershipTag manager={awayManager} />
            </div>
          </div>
          <div className="text-sm font-bold">{game.away_score ?? "—"}</div>
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
          <div className="flex min-w-0 items-start gap-2">
            <TeamLogo teamName={homeName} size={16} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                {homeSeed ? `${homeSeed}. ` : ""}
                {homeName}
              </div>
              <OwnershipTag manager={homeManager} />
            </div>
          </div>
          <div className="text-sm font-bold">{game.home_score ?? "—"}</div>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-3">
        <div className="text-[11px] text-slate-400">
          {game.start_time ? formatEasternDateTime(game.start_time) : "Tip time pending"}
        </div>

        <Link
          href={getBracketHref(game, teamMap)}
          className="inline-flex items-center rounded-full border border-slate-700/80 bg-[#0f172a] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-200 transition hover:bg-[#162033]"
        >
          Bracket
        </Link>
      </div>

      {showStats ? (
        <details className="group mt-2 rounded-2xl border border-slate-700/80 bg-[#111827]/70 p-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
              Team Stats
            </div>
            <div className="shrink-0 text-slate-300 transition-transform duration-200 group-open:rotate-180">
              ▼
            </div>
          </summary>

          <TeamStatsBlock
            awayName={awayName}
            homeName={homeName}
            awayStats={awayStats}
            homeStats={homeStats}
          />
        </details>
      ) : null}
    </div>
  );
}

export default async function ScoresPage() {
  const supabase = await createClient();

  const [{ data: externalGames }, { data: teams }, { data: picks }, { data: members }] =
    await Promise.all([
      supabase
        .from("external_game_sync")
        .select(
          "id, external_game_id, espn_event_name, espn_status, espn_period, espn_clock, start_time, round_name, home_team_name, away_team_name, home_score, away_score, mapped_home_team_id, mapped_away_team_id, raw_payload"
        )
        .order("start_time", { ascending: true }),
      supabase.from("teams").select("id, school_name, seed, region"),
      supabase.from("picks").select("id, member_id, team_id"),
      supabase.from("league_members").select("id, display_name"),
    ]);

  const typedExternalGames = (externalGames ?? []) as ExternalGameSync[];
  const typedTeams = (teams ?? []) as Team[];
  const typedPicks = (picks ?? []) as Pick[];
  const typedMembers = (members ?? []) as Member[];

  const teamMap = new Map<string, Team>(typedTeams.map((team) => [team.id, team]));
  const memberNameById = new Map(typedMembers.map((member) => [member.id, member.display_name]));
  const managerByTeamId = new Map(
    typedPicks.map((pick) => [pick.team_id, memberNameById.get(pick.member_id) ?? "Unknown"])
  );

  const todayEastern = getTodayEasternDateString();

  const liveGames = sortGamesByLeagueRelevance(
    typedExternalGames.filter((game) => isLiveStatus(game.espn_status)),
    managerByTeamId
  );

  const todayGames = typedExternalGames.filter((game) => {
    if (!game.start_time) return false;

    const gameDate = new Date(game.start_time).toLocaleDateString("en-US", {
      timeZone: "America/New_York",
    });

    return gameDate === todayEastern;
  });

  const todayUpcomingGames = sortGamesByLeagueRelevance(
    todayGames.filter((game) => isScheduledStatus(game.espn_status)),
    managerByTeamId
  );

  const todayFinalGames = sortGamesByLeagueRelevance(
    todayGames.filter((game) => isFinalStatus(game.espn_status)),
    managerByTeamId
  );

  const nextGames = sortGamesByLeagueRelevance(
    typedExternalGames
      .filter(
        (game) =>
          isScheduledStatus(game.espn_status) &&
          !!game.start_time &&
          new Date(game.start_time).getTime() >= Date.now()
      )
      .slice(0, 8),
    managerByTeamId
  );

  return (
    <div className="mx-auto max-w-7xl p-3 sm:p-4 md:p-6">
      <section className="mb-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Scores
            </div>
            <h2 className="mt-1 text-2xl font-bold leading-tight text-white sm:text-3xl">
              Game Center
            </h2>
          </div>

          <div className="text-right text-[10px] text-slate-400 sm:text-xs">
            Auto-refreshing
          </div>
        </div>
      </section>

      <section className="mb-3 flex flex-wrap gap-2">
        <StatusPill label={`${liveGames.length} Live`} tone="live" />
        <StatusPill label={`${todayUpcomingGames.length} Upcoming`} tone="upcoming" />
        <StatusPill label={`${todayFinalGames.length} Final`} tone="final" />
      </section>

      <div className="space-y-3">
        <SectionShell
          title="Live Now"
          subtitle="League-owned games float to the top."
          rightLabel={liveGames.length > 0 ? `${liveGames.length} live` : "No live games"}
        >
          {liveGames.length === 0 ? (
            <EmptyStateCard
              title="No games are live right now"
              body="When games tip, they’ll show here first with live scores, ownership, and team stats."
            />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {liveGames.map((game) => (
                <ScoreGameCard
                  key={game.external_game_id}
                  game={game}
                  teamMap={teamMap}
                  managerByTeamId={managerByTeamId}
                />
              ))}
            </div>
          )}
        </SectionShell>

        <SectionShell
          title="Up Next"
          subtitle="Scheduled games on deck."
          rightLabel={nextGames.length > 0 ? `${nextGames.length} queued` : "No upcoming games"}
        >
          {nextGames.length === 0 ? (
            <EmptyStateCard
              title="No upcoming games in feed"
              body="Scheduled tournament games will appear here as they get closer."
            />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {nextGames.map((game) => (
                <ScoreGameCard
                  key={game.external_game_id}
                  game={game}
                  teamMap={teamMap}
                  managerByTeamId={managerByTeamId}
                />
              ))}
            </div>
          )}
        </SectionShell>

        <details className="group rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white sm:text-base">Finals Today</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-400">
                {todayFinalGames.length > 0 ? `${todayFinalGames.length} completed` : "No finals yet"}
              </div>
            </div>
            <div className="shrink-0 text-slate-300 transition-transform duration-200 group-open:rotate-180">
              ▼
            </div>
          </summary>

          <div className="mt-3">
            {todayFinalGames.length === 0 ? (
              <EmptyStateCard
                title="No completed games today"
                body="Final scores will stack here once today’s games finish."
              />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {todayFinalGames.map((game) => (
                  <ScoreGameCard
                    key={game.external_game_id}
                    game={game}
                    teamMap={teamMap}
                    managerByTeamId={managerByTeamId}
                  />
                ))}
              </div>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}