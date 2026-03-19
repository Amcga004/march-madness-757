import { createClient } from "@/lib/supabase/server";
import ScoresGameCard, {
  type ScoresGameCardGame,
} from "../components/ScoresGameCard";

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

function buildScoresCardGame(
  game: ExternalGameSync,
  teamMap: Map<string, Team>,
  managerByTeamId: Map<string, string>
): ScoresGameCardGame {
  const homeTeam = game.mapped_home_team_id ? teamMap.get(game.mapped_home_team_id) ?? null : null;
  const awayTeam = game.mapped_away_team_id ? teamMap.get(game.mapped_away_team_id) ?? null : null;

  return {
    external_game_id: game.external_game_id,
    espn_status: game.espn_status,
    espn_period: game.espn_period,
    espn_clock: game.espn_clock,
    start_time: game.start_time,
    round_name: game.round_name,
    home_team_name: homeTeam?.school_name ?? game.home_team_name ?? "Home",
    away_team_name: awayTeam?.school_name ?? game.away_team_name ?? "Away",
    home_score: game.home_score,
    away_score: game.away_score,
    raw_payload: game.raw_payload,
    home_seed: homeTeam?.seed ?? null,
    away_seed: awayTeam?.seed ?? null,
    home_manager: game.mapped_home_team_id
      ? managerByTeamId.get(game.mapped_home_team_id) ?? null
      : null,
    away_manager: game.mapped_away_team_id
      ? managerByTeamId.get(game.mapped_away_team_id) ?? null
      : null,
    bracket_href: getBracketHref(game, teamMap),
  };
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

  const ownedLiveGames = liveGames.filter(
    (game) =>
      (game.mapped_home_team_id && managerByTeamId.get(game.mapped_home_team_id)) ||
      (game.mapped_away_team_id && managerByTeamId.get(game.mapped_away_team_id))
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

      {ownedLiveGames.length > 0 ? (
        <section className="mb-3 rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            League Spotlight
          </div>

          <div className="flex flex-wrap gap-2">
            {ownedLiveGames.slice(0, 6).map((game) => {
              const cardGame = buildScoresCardGame(game, teamMap, managerByTeamId);
              return (
                <span
                  key={game.external_game_id}
                  className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200"
                >
                  {cardGame.away_team_name} vs {cardGame.home_team_name}
                </span>
              );
            })}
          </div>
        </section>
      ) : null}

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
                <ScoresGameCard
                  key={game.external_game_id}
                  game={buildScoresCardGame(game, teamMap, managerByTeamId)}
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
                <ScoresGameCard
                  key={game.external_game_id}
                  game={buildScoresCardGame(game, teamMap, managerByTeamId)}
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
                  <ScoresGameCard
                    key={game.external_game_id}
                    game={buildScoresCardGame(game, teamMap, managerByTeamId)}
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