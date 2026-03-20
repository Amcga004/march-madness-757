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

function getOwnershipRank(game: ExternalGameSync, managerByTeamId: Map<string, string>) {
  const awayOwned = !!(game.mapped_away_team_id && managerByTeamId.get(game.mapped_away_team_id));
  const homeOwned = !!(game.mapped_home_team_id && managerByTeamId.get(game.mapped_home_team_id));

  if (awayOwned && homeOwned) return 2;
  if (awayOwned || homeOwned) return 1;
  return 0;
}

function getStatusPriority(game: ExternalGameSync) {
  if (isLiveStatus(game.espn_status)) return 3;
  if (isFinalStatus(game.espn_status)) return 2;
  return 1;
}

function sortGamesForDisplay(
  games: ExternalGameSync[],
  managerByTeamId: Map<string, string>
) {
  return [...games].sort((a, b) => {
    const priorityDiff = getStatusPriority(b) - getStatusPriority(a);
    if (priorityDiff !== 0) return priorityDiff;

    const ownershipDiff =
      getOwnershipRank(b, managerByTeamId) - getOwnershipRank(a, managerByTeamId);
    if (ownershipDiff !== 0) return ownershipDiff;

    const aTime = a.start_time ? new Date(a.start_time).getTime() : 0;
    const bTime = b.start_time ? new Date(b.start_time).getTime() : 0;
    return aTime - bTime;
  });
}

function getEasternDayId(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));

  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";

  return `${year}-${month}-${day}`;
}

function getEasternDateChipLabel(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "numeric",
    day: "numeric",
  });
}

function getEasternSectionTitle(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getTodayEasternDayId() {
  const now = new Date();
  return getEasternDayId(now.toISOString());
}

function groupGamesByEasternDate(
  games: ExternalGameSync[],
  managerByTeamId: Map<string, string>
) {
  const groups = new Map<
    string,
    {
      dayId: string;
      chipLabel: string;
      sectionTitle: string;
      games: ExternalGameSync[];
      firstStartTime: string | null;
    }
  >();

  for (const game of games) {
    if (!game.start_time) continue;

    const dayId = getEasternDayId(game.start_time);

    if (!groups.has(dayId)) {
      groups.set(dayId, {
        dayId,
        chipLabel: getEasternDateChipLabel(game.start_time),
        sectionTitle: getEasternSectionTitle(game.start_time),
        games: [],
        firstStartTime: game.start_time,
      });
    }

    const group = groups.get(dayId)!;
    group.games.push(game);

    if (
      group.firstStartTime === null ||
      new Date(game.start_time).getTime() < new Date(group.firstStartTime).getTime()
    ) {
      group.firstStartTime = game.start_time;
    }
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      games: sortGamesForDisplay(group.games, managerByTeamId),
    }))
    .sort((a, b) => {
      const aTime = a.firstStartTime ? new Date(a.firstStartTime).getTime() : 0;
      const bTime = b.firstStartTime ? new Date(b.firstStartTime).getTime() : 0;
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

function SectionShell({
  title,
  subtitle,
  rightLabel,
  children,
  id,
}: {
  title: string;
  subtitle?: string;
  rightLabel?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-28 rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.28)]"
    >
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

function DateJumpChip({
  href,
  label,
  isToday,
}: {
  href: string;
  label: string;
  isToday: boolean;
}) {
  return (
    <a
      href={href}
      className={`inline-flex shrink-0 items-center rounded-2xl border px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 ${
        isToday
          ? "border-blue-500/40 bg-blue-500/10 text-blue-200"
          : "border-slate-700/80 bg-[#172033] text-slate-200 hover:bg-[#1c2940]"
      }`}
    >
      {label}
    </a>
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

  const liveGames = typedExternalGames.filter((game) => isLiveStatus(game.espn_status));
  const finalGames = typedExternalGames.filter((game) => isFinalStatus(game.espn_status));
  const upcomingGames = typedExternalGames.filter((game) => isScheduledStatus(game.espn_status));

  const groupedGames = groupGamesByEasternDate(typedExternalGames, managerByTeamId);
  const todayDayId = getTodayEasternDayId();

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
        <StatusPill label={`${finalGames.length} Final`} tone="final" />
        <StatusPill label={`${upcomingGames.length} Upcoming`} tone="upcoming" />
      </section>

      {groupedGames.length > 0 ? (
        <section className="mb-4 rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Dates
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {groupedGames.map((group) => (
              <DateJumpChip
                key={group.dayId}
                href={`#date-${group.dayId}`}
                label={group.chipLabel}
                isToday={group.dayId === todayDayId}
              />
            ))}
          </div>
        </section>
      ) : null}

      {groupedGames.length === 0 ? (
        <SectionShell title="Scores" subtitle="Tournament games will appear here as they enter the feed.">
          <EmptyStateCard
            title="No games available"
            body="Once tournament games are scheduled or live, they’ll appear here automatically."
          />
        </SectionShell>
      ) : (
        <div className="space-y-3">
          {groupedGames.map((group) => {
            const liveCount = group.games.filter((game) => isLiveStatus(game.espn_status)).length;
            const finalCount = group.games.filter((game) => isFinalStatus(game.espn_status)).length;
            const scheduledCount = group.games.filter((game) => isScheduledStatus(game.espn_status)).length;

            return (
              <SectionShell
                key={group.dayId}
                id={`date-${group.dayId}`}
                title={group.dayId === todayDayId ? `Today • ${group.chipLabel}` : group.sectionTitle}
                subtitle="Live games float to the top, then finals, then upcoming."
                rightLabel={`${group.games.length} games`}
              >
                <div className="mb-3 flex flex-wrap gap-2">
                  {liveCount > 0 ? <StatusPill label={`${liveCount} Live`} tone="live" /> : null}
                  {finalCount > 0 ? <StatusPill label={`${finalCount} Final`} tone="final" /> : null}
                  {scheduledCount > 0 ? (
                    <StatusPill label={`${scheduledCount} Upcoming`} tone="upcoming" />
                  ) : null}
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {group.games.map((game) => (
                    <ScoresGameCard
                      key={game.external_game_id}
                      game={buildScoresCardGame(game, teamMap, managerByTeamId)}
                    />
                  ))}
                </div>
              </SectionShell>
            );
          })}
        </div>
      )}
    </div>
  );
}