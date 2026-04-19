"use server";

import { createServiceClient } from "@/lib/supabase/service";

export async function fetchSlateData(date: string, sport: string, userId: string | null) {
  const supabase = createServiceClient();

  // ESPN live data
  async function fetchEspn(path: string) {
    try {
      const res = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard`,
        { cache: "no-store" }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.events ?? [];
    } catch { return []; }
  }

  const [nbaEvents, mlbEventsRaw, ncaabEvents] = await Promise.all([
    sport === "all" || sport === "nba" ? fetchEspn("basketball/nba") : Promise.resolve([]),
    sport === "all" || sport === "mlb" ? fetchEspn("baseball/mlb") : Promise.resolve([]),
    sport === "all" || sport === "ncaab" ? fetchEspn("basketball/mens-college-basketball") : Promise.resolve([]),
  ]);

  function normalizeGame(event: any, sportKey: string) {
    const comp = event.competitions?.[0];
    const home = comp?.competitors?.find((c: any) => c.homeAway === "home");
    const away = comp?.competitors?.find((c: any) => c.homeAway === "away");
    if (!home || !away) return null;
    const state = event.status?.type?.state;
    const isLive = state === "in";
    const isFinal = state === "post";
    return {
      id: event.id,
      sportKey,
      homeTeam: home.team?.displayName,
      awayTeam: away.team?.displayName,
      homeAbbr: home.team?.abbreviation?.toLowerCase(),
      awayAbbr: away.team?.abbreviation?.toLowerCase(),
      homeLogo: home.team?.logo ?? null,
      awayLogo: away.team?.logo ?? null,
      homeScore: isLive || isFinal ? home.score : null,
      awayScore: isLive || isFinal ? away.score : null,
      commenceTime: comp?.date,
      isLive,
      isFinal,
      statusDetail: event.status?.type?.shortDetail ?? "",
      homeRecord: home.records?.[0]?.summary ?? null,
      awayRecord: away.records?.[0]?.summary ?? null,
      odds: [],
      signals: [],
      consensus: null,
    };
  }

  const allGames = [
    ...nbaEvents.map((e: any) => normalizeGame(e, "nba")),
    ...mlbEventsRaw.map((e: any) => normalizeGame(e, "mlb")),
    ...ncaabEvents.map((e: any) => normalizeGame(e, "ncaab")),
  ].filter(Boolean);
  console.log("[game-keys]", allGames.slice(0, 5).map((g: any) => `${g.awayTeam}|${g.homeTeam}`));

  // Enrich with odds
  const etStart = new Date(`${date}T04:00:00Z`);
  const etEnd = new Date(`${date}T04:00:00Z`);
  etEnd.setDate(etEnd.getDate() + 1);

  const { data: oddsData } = await supabase
    .from("market_odds")
    .select("*")
    .gte("commence_time", etStart.toISOString())
    .lt("commence_time", etEnd.toISOString());

  const oddsMap = new Map<string, any[]>();
  for (const odd of oddsData ?? []) {
    const key = `${odd.away_team}|${odd.home_team}`;
    if (!oddsMap.has(key)) oddsMap.set(key, []);
    oddsMap.get(key)!.push(odd);
  }

  // Enrich with signals (auth-gated)
  const signalsMap = new Map<string, any[]>();
  if (userId) {
    const { data: signalsData } = await supabase
      .from("signals")
      .select("*")
      .eq("game_date", date)
      .eq("suppressed", false);
    console.log("[signals-debug] userId:", userId, "count:", signalsData?.length ?? 0);
    for (const s of signalsData ?? []) {
      const key = `${s.away_team}|${s.home_team}`;
      if (!signalsMap.has(key)) signalsMap.set(key, []);
      signalsMap.get(key)!.push(s);
    }
    console.log("[signals-keys]", Array.from(signalsMap.keys()).slice(0, 5));
    console.log("[signals-map-size]", signalsMap.size);
  }

  // Enrich with consensus
  const { data: consensusData } = await supabase
    .from("consensus")
    .select("*")
    .eq("game_date", date);

  const consensusMap = new Map<string, any>();
  for (const c of consensusData ?? []) {
    consensusMap.set(`${c.away_team}|${c.home_team}`, c);
  }

  const enrichedGames = allGames.map((game: any) => {
    const key = `${game.awayTeam}|${game.homeTeam}`;
    return {
      ...game,
      odds: oddsMap.get(key) ?? [],
      signals: signalsMap.get(key) ?? [],
      consensus: consensusMap.get(key) ?? null,
    };
  });
  const gamesWithSignals = enrichedGames.filter((g: any) => g.signals?.length > 0);
  console.log("[games-with-signals]", gamesWithSignals.length, gamesWithSignals.map((g: any) => `${g.awayTeam}|${g.homeTeam}`));

  // MLB probable starters
  const startersResult = await fetch(
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=probablePitcher`,
    { cache: "no-store" }
  ).then(r => r.json()).catch(() => ({ dates: [] }));

  const mlbStartersByTeam: Record<string, { pitcher: string; confirmed: boolean }> = {};
  for (const dateEntry of startersResult.dates ?? []) {
    for (const game of dateEntry.games ?? []) {
      const homeName = game.teams?.home?.team?.name;
      const awayName = game.teams?.away?.team?.name;
      const homePitcher = game.teams?.home?.probablePitcher?.fullName ?? null;
      const awayPitcher = game.teams?.away?.probablePitcher?.fullName ?? null;
      if (homeName) mlbStartersByTeam[homeName] = { pitcher: homePitcher ?? "TBD", confirmed: !!homePitcher };
      if (awayName) mlbStartersByTeam[awayName] = { pitcher: awayPitcher ?? "TBD", confirmed: !!awayPitcher };
    }
  }

  return { enrichedGames, mlbStartersByTeam };
}

export async function fetchGolfLeaderboard(tournamentId: string) {
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = await res.json();

    const event = data.events?.[0];
    if (!event) return [];

    const competition = event.competitions?.[0];
    if (!competition) return [];

    if (competition?.competitors?.[0]) {
      const c = competition.competitors[0];
      console.log("[espn-golf-stats]", JSON.stringify({
        name: c.athlete?.displayName,
        stats: c.statistics,
        linescores: c.linescores?.slice(0, 3),
        score: c.score,
      }));
    }

    return (competition.competitors ?? [])
      .sort((a: any, b: any) => {
        const posA = parseInt(a.status?.position?.id ?? "999");
        const posB = parseInt(b.status?.position?.id ?? "999");
        return posA - posB;
      })
      .map((comp: any) => {
        const athlete = comp.athlete;
        const linescores = comp.linescores ?? [];
        const totalVsParStr = comp.score ?? "--";
        const totalVsPar = totalVsParStr === "E" ? 0
          : totalVsParStr === "--" ? null
          : parseInt(totalVsParStr);

        const activeLS = [...linescores].reverse().find((ls: any) =>
          ls.displayValue && ls.displayValue !== "-" && ls.displayValue !== "--"
        );

        const todayVsPar = (() => {
          if (!activeLS) return null;
          const v = activeLS.displayValue;
          if (!v || v === "-" || v === "--") return null;
          return v === "E" ? 0 : parseInt(v);
        })();

        const thru = (() => {
          if (!activeLS) return "--";
          const nested = activeLS.linescores?.length ?? 0;
          if (nested === 0 && (!activeLS.displayValue || activeLS.displayValue === "-" || activeLS.displayValue === "--")) return "--";
          if (nested === 0 && activeLS.value > 0) return "F";
          if (nested >= 18) return "F";
          if (nested > 0) return `${nested}`;
          return "--";
        })();

        const getRound = (num: number): number | null => {
          const ls = linescores[num - 1];
          if (!ls || !ls.value || ls.value === 0) return null;
          return ls.value;
        };

        const r3LS = linescores[2];
        const teeTime = (() => {
          if (!r3LS || r3LS.value > 0) return null;
          const stats = r3LS.statistics?.categories?.[0]?.stats;
          const teeStat = stats?.[stats.length - 1]?.displayValue;
          if (!teeStat || !teeStat.includes("Apr")) return null;
          try {
            const d = new Date(teeStat);
            return d.toLocaleTimeString("en-US", {
              hour: "numeric", minute: "2-digit", timeZone: "America/New_York"
            }) + " ET";
          } catch { return null; }
        })();

        return {
          position: comp.status?.position?.displayName ?? "—",
          name: athlete?.displayName ?? "Unknown",
          totalVsPar,
          todayVsPar,
          thru,
          teeTime,
          r1: getRound(1),
          r2: getRound(2),
          r3: getRound(3),
          r4: getRound(4),
        };
      });
  } catch (e) {
    console.error("[golf-espn] error:", e);
    return [];
  }
}
