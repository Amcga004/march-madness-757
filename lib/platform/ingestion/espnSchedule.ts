import { upsertEvent } from "@/lib/platform/eventLifecycle";
import { upsertTeam, registerMapping } from "@/lib/platform/identityMap";
import { recordSyncSuccess, recordSyncFailure, saveSnapshot } from "@/lib/platform/sourceRegistry";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";

const SPORT_CONFIG = {
  nba: {
    url: `${ESPN_BASE}/basketball/nba/scoreboard`,
    sourceKey: "espn_nba",
    sportKey: "nba",
    season: "2024-25",
  },
  mlb: {
    url: `${ESPN_BASE}/baseball/mlb/scoreboard`,
    sourceKey: "espn_mlb",
    sportKey: "mlb",
    season: "2025",
  },
  ncaab: {
    url: `${ESPN_BASE}/basketball/mens-college-basketball/scoreboard`,
    sourceKey: "espn_ncaab",
    sportKey: "ncaab",
    season: "2025",
  },
} as const;

type SportKey = keyof typeof SPORT_CONFIG;

async function fetchEspnScoreboard(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`ESPN fetch failed: ${res.status}`);
  return res.json();
}

async function ingestEspnSport(sport: SportKey) {
  const config = SPORT_CONFIG[sport];
  const data = await fetchEspnScoreboard(config.url);

  await saveSnapshot(config.sourceKey, config.sportKey, "scoreboard", data);

  const events = data.events ?? [];
  let created = 0;
  let updated = 0;

  for (const event of events) {
    const competition = event.competitions?.[0];
    if (!competition) continue;

    const homeCompetitor = competition.competitors?.find((c: any) => c.homeAway === "home");
    const awayCompetitor = competition.competitors?.find((c: any) => c.homeAway === "away");

    if (!homeCompetitor || !awayCompetitor) continue;

    const homeName = homeCompetitor.team?.displayName ?? homeCompetitor.team?.name;
    const awayName = awayCompetitor.team?.displayName ?? awayCompetitor.team?.name;
    const homeAbbr = homeCompetitor.team?.abbreviation;
    const awayAbbr = awayCompetitor.team?.abbreviation;
    const homeEspnId = homeCompetitor.team?.id;
    const awayEspnId = awayCompetitor.team?.id;

    // Upsert teams and register ESPN identity mappings
    if (homeName && homeEspnId) {
      const canonicalId = await upsertTeam({
        sportKey: config.sportKey,
        canonicalName: homeName,
        abbreviation: homeAbbr,
        location: homeCompetitor.team?.location,
      });
      await registerMapping({
        entityType: "team",
        canonicalId,
        sourceKey: config.sourceKey,
        sourceId: homeEspnId,
        sourceName: homeName,
        sportKey: config.sportKey,
      });
    }

    if (awayName && awayEspnId) {
      const canonicalId = await upsertTeam({
        sportKey: config.sportKey,
        canonicalName: awayName,
        abbreviation: awayAbbr,
        location: awayCompetitor.team?.location,
      });
      await registerMapping({
        entityType: "team",
        canonicalId,
        sourceKey: config.sourceKey,
        sourceId: awayEspnId,
        sourceName: awayName,
        sportKey: config.sportKey,
      });
    }

    // Upsert the event
    const result = await upsertEvent({
      sportKey: config.sportKey,
      eventType: "game",
      externalId: event.id,
      externalSource: config.sourceKey,
      name: event.name ?? `${awayName} @ ${homeName}`,
      shortName: event.shortName ?? `${awayAbbr} @ ${homeAbbr}`,
      season: config.season,
      startsAt: competition.date,
      venue: competition.venue?.fullName,
      location: competition.venue?.address?.city,
      metadata: {
        espnEventId: event.id,
        homeTeamId: homeEspnId,
        awayTeamId: awayEspnId,
        statusType: event.status?.type?.name,
        statusDescription: event.status?.type?.description,
      },
    });

    if (result.created) created++;
    else updated++;
  }

  return { sport, eventsFound: events.length, created, updated };
}

export async function ingestAllEspnSchedules() {
  const results = [];

  for (const sport of ["nba", "mlb", "ncaab"] as SportKey[]) {
    const config = SPORT_CONFIG[sport];
    try {
      const result = await ingestEspnSport(sport);
      await recordSyncSuccess(config.sourceKey);
      results.push({ ...result, ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await recordSyncFailure(config.sourceKey, message);
      results.push({ sport, ok: false, error: message });
    }
  }

  return results;
}
