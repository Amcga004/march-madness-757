import { createServiceClient } from "@/lib/supabase/service";
import { upsertEvent } from "@/lib/platform/eventLifecycle";
import { upsertTeam, registerMapping } from "@/lib/platform/identityMap";
import { recordNcaaGameResult, refreshNcaaStandings } from "@/lib/fantasy/ncaaScoring";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";

export async function syncNcaaTournamentBracket(season: string) {
  const supabase = createServiceClient();

  const res = await fetch(
    `${ESPN_BASE}/basketball/mens-college-basketball/scoreboard?limit=50`,
    { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 0 } }
  );
  if (!res.ok) throw new Error(`ESPN CBB fetch failed: ${res.status}`);
  const data = await res.json();

  const events = data.events ?? [];
  let gamesProcessed = 0;

  for (const event of events) {
    const competition = event.competitions?.[0];
    if (!competition) continue;

    const home = competition.competitors?.find((c: any) => c.homeAway === "home");
    const away = competition.competitors?.find((c: any) => c.homeAway === "away");
    if (!home || !away) continue;

    const homeName = home.team?.displayName;
    const awayName = away.team?.displayName;
    const homeEspnId = home.team?.id;
    const awayEspnId = away.team?.id;
    const homeSeed = home.curatedRank?.current ?? null;
    const awaySeed = away.curatedRank?.current ?? null;

    if (!homeName || !awayName) continue;

    if (homeEspnId) {
      const canonicalId = await upsertTeam({
        sportKey: "ncaab",
        canonicalName: homeName,
        abbreviation: home.team?.abbreviation,
        metadata: { seed: homeSeed, region: home.team?.location },
      });
      await registerMapping({
        entityType: "team",
        canonicalId,
        sourceKey: "espn_ncaab",
        sourceId: homeEspnId,
        sourceName: homeName,
        sportKey: "ncaab",
      });
    }

    if (awayEspnId) {
      const canonicalId = await upsertTeam({
        sportKey: "ncaab",
        canonicalName: awayName,
        abbreviation: away.team?.abbreviation,
        metadata: { seed: awaySeed, region: away.team?.location },
      });
      await registerMapping({
        entityType: "team",
        canonicalId,
        sourceKey: "espn_ncaab",
        sourceId: awayEspnId,
        sourceName: awayName,
        sportKey: "ncaab",
      });
    }

    await upsertEvent({
      sportKey: "ncaab",
      eventType: "game",
      externalId: event.id,
      externalSource: "espn_ncaab",
      name: event.name,
      shortName: event.shortName,
      season,
      startsAt: competition.date,
      venue: competition.venue?.fullName,
      location: competition.venue?.address?.city,
      metadata: {
        espnEventId: event.id,
        homeTeamId: homeEspnId,
        awayTeamId: awayEspnId,
        homeSeed,
        awaySeed,
        statusType: event.status?.type?.name,
        roundName: competition.notes?.[0]?.headline ?? null,
      },
    });

    gamesProcessed++;
  }

  return { ok: true, gamesProcessed };
}

export async function processNcaaGameResult(params: {
  leagueId: string;
  eventId: string;
  winnerEspnId: string;
  loserEspnId: string;
  winnerScore: number;
  loserScore: number;
  roundName: string;
}) {
  const supabase = createServiceClient();

  const { data: winnerMapping } = await supabase
    .from("source_identity_map")
    .select("canonical_id")
    .eq("source_key", "espn_ncaab")
    .eq("source_id", params.winnerEspnId)
    .eq("entity_type", "team")
    .maybeSingle();

  const { data: loserMapping } = await supabase
    .from("source_identity_map")
    .select("canonical_id")
    .eq("source_key", "espn_ncaab")
    .eq("source_id", params.loserEspnId)
    .eq("entity_type", "team")
    .maybeSingle();

  if (!winnerMapping || !loserMapping) {
    return { ok: false, error: "Could not resolve team canonical IDs" };
  }

  const { data: winnerTeam } = await supabase
    .from("platform_teams")
    .select("canonical_name, metadata")
    .eq("id", winnerMapping.canonical_id)
    .maybeSingle();

  const { data: loserTeam } = await supabase
    .from("platform_teams")
    .select("canonical_name, metadata")
    .eq("id", loserMapping.canonical_id)
    .maybeSingle();

  const winnerSeed = (winnerTeam?.metadata as any)?.seed ?? 0;
  const loserSeed = (loserTeam?.metadata as any)?.seed ?? 0;

  const result = await recordNcaaGameResult({
    leagueId: params.leagueId,
    eventId: params.eventId,
    result: {
      winnerCanonicalId: winnerMapping.canonical_id,
      winnerName: winnerTeam?.canonical_name ?? "Unknown",
      winnerSeed,
      loserSeed,
      winnerScore: params.winnerScore,
      roundName: params.roundName,
    },
  });

  await refreshNcaaStandings(params.leagueId, params.eventId);
  return { ok: true, ...result };
}

export async function autoOpenNcaaDraft(leagueId: string, eventId: string) {
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("fantasy_drafts")
    .select("id, status")
    .eq("league_id", leagueId)
    .maybeSingle();

  if (existing) return { ok: true, draftId: existing.id, alreadyExists: true };

  const { data: firstGame } = await supabase
    .from("platform_events")
    .select("starts_at")
    .eq("sport_key", "ncaab")
    .eq("status", "scheduled")
    .order("starts_at")
    .limit(1)
    .maybeSingle();

  let locksAt: string | undefined;
  if (firstGame?.starts_at) {
    const lockTime = new Date(firstGame.starts_at);
    lockTime.setMinutes(lockTime.getMinutes() - 10);
    locksAt = lockTime.toISOString();
  }

  const { data: draft, error } = await supabase
    .from("fantasy_drafts")
    .insert({
      league_id: leagueId,
      event_id: eventId,
      status: "open",
      draft_type: "snake",
      current_pick_number: 1,
      current_round: 1,
      total_rounds: 16,
      opens_at: new Date().toISOString(),
      locks_at: locksAt ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Failed to create NCAA draft: ${error.message}`);

  await supabase
    .from("fantasy_leagues")
    .update({
      status: "drafting",
      current_event_id: eventId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", leagueId);

  return { ok: true, draftId: draft!.id, locksAt };
}

export async function checkAndLockNcaaDrafts() {
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { data: draftsToLock } = await supabase
    .from("fantasy_drafts")
    .select("id, league_id")
    .in("status", ["open", "pending"])
    .lte("locks_at", now)
    .not("locks_at", "is", null);

  if (!draftsToLock || draftsToLock.length === 0) return { locked: 0 };

  let locked = 0;
  for (const draft of draftsToLock) {
    await supabase
      .from("fantasy_drafts")
      .update({ status: "locked", updated_at: now })
      .eq("id", draft.id);

    await supabase
      .from("fantasy_leagues")
      .update({ status: "active", updated_at: now })
      .eq("id", draft.league_id);

    locked++;
  }

  return { locked };
}
