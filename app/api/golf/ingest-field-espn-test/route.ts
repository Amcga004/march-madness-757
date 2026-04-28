// TEST ONLY — diagnostic endpoint, no database writes, no auth required.
// Purpose: validate ESPN PGA scoreboard data quality before committing to it
// as a replacement for SportsData.io (quota exhausted).
// Remove or gate behind auth before shipping to production.

import { NextResponse } from "next/server";

const ESPN_SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard";

const DATE_PROBES = [
  { label: "current", url: ESPN_SCOREBOARD },
  { label: "20260430", url: `${ESPN_SCOREBOARD}?dates=20260430` },
  { label: "20260501", url: `${ESPN_SCOREBOARD}?dates=20260501` },
  { label: "20260502", url: `${ESPN_SCOREBOARD}?dates=20260502` },
];

async function fetchScoreboard(url: string): Promise<any[] | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data?.events) ? data.events : null;
  } catch {
    return null;
  }
}

function extractCompetitorName(competitor: any): string {
  // Team event: team.displayName = "Player1/Player2"
  // Individual event: athlete.displayName or team.displayName
  return (
    competitor?.athlete?.displayName ??
    competitor?.team?.displayName ??
    competitor?.id ??
    "unknown"
  );
}

function isTeamCompetitor(competitor: any): boolean {
  const name = competitor?.team?.displayName ?? "";
  return typeof name === "string" && name.includes("/");
}

export async function GET() {
  const fetchedAt = new Date().toISOString();

  // Fetch all date probes in parallel
  const results = await Promise.all(
    DATE_PROBES.map(async (probe) => {
      const events = await fetchScoreboard(probe.url);
      return { label: probe.label, events: events ?? [] };
    })
  );

  // Deduplicate events across all probes by event ID, tracking first-seen date label
  const seenIds = new Map<string, string>(); // eventId → first label
  const allEvents: any[] = [];

  for (const { label, events } of results) {
    for (const event of events) {
      const id: string = event?.id ?? "";
      if (!id) continue;
      if (!seenIds.has(id)) {
        seenIds.set(id, label);
        allEvents.push({ event, firstLabel: label });
      }
    }
  }

  // Build output per event
  const eventOutputs = allEvents.map(({ event, firstLabel }) => {
    const competition = event?.competitions?.[0] ?? {};
    const competitors: any[] = Array.isArray(competition.competitors)
      ? competition.competitors
      : [];

    const teamEventFlag = competitors.some(isTeamCompetitor);

    const samplePlayers = competitors.slice(0, 5).map((c: any) => ({
      name: extractCompetitorName(c),
      score: c?.score ?? null,
      order: c?.order ?? null,
      linescoreRounds: Array.isArray(c?.linescores) ? c.linescores.length : 0,
    }));

    const hasScores = competitors.some((c: any) => {
      const s = String(c?.score ?? "");
      return s !== "" && s !== "E" && s !== "0" && s !== "null";
    });

    // Try to get status
    const status = competition?.status?.type?.name ?? competition?.status?.type?.description ?? null;
    const statusState = competition?.status?.type?.state ?? null;

    // Extract date range of event
    const eventDate = competition?.date ?? event?.date ?? null;

    return {
      eventId: event?.id ?? null,
      eventName: event?.name ?? null,
      eventDate,
      status,
      statusState,
      competitorCount: competitors.length,
      isTeamEvent: teamEventFlag,
      hasScores,
      firstAvailableDate: firstLabel,
      samplePlayers,
    };
  });

  const individualCount = eventOutputs.filter((e) => !e.isTeamEvent).length;
  const teamCount = eventOutputs.filter((e) => e.isTeamEvent).length;

  return NextResponse.json({
    fetchedAt,
    probesChecked: DATE_PROBES.map((p) => p.label),
    events: eventOutputs,
    summary: `${eventOutputs.length} event(s) found — ${individualCount} individual, ${teamCount} team`,
  });
}
