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

  function normalizeTeam(name: string) {
    return name.toLowerCase().trim()
      .replace(/[^a-z0-9 ]/g, '')
      .replace(/\s+/g, ' ');
  }

  // Enrich with odds
  const todayET = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const isHistorical = date < todayET;

  const etStart = new Date(`${date}T04:00:00Z`);
  const etEnd = new Date(`${date}T04:00:00Z`);
  etEnd.setDate(etEnd.getDate() + 1);

  let oddsQuery = supabase
    .from("market_odds")
    .select("*")
    .gte("commence_time", etStart.toISOString())
    .lt("commence_time", etEnd.toISOString());

  if (isHistorical) oddsQuery = oddsQuery.eq("closing_line", true);

  const { data: oddsData } = await oddsQuery;

  const oddsMap = new Map<string, any[]>();
  for (const odd of oddsData ?? []) {
    const key = `${normalizeTeam(odd.away_team)}|${normalizeTeam(odd.home_team)}`;
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
    for (const s of signalsData ?? []) {
      const key = `${normalizeTeam(s.away_team)}|${normalizeTeam(s.home_team)}`;
      if (!signalsMap.has(key)) signalsMap.set(key, []);
      signalsMap.get(key)!.push(s);
    }
  }

  // Enrich with consensus
  const { data: consensusData } = await supabase
    .from("consensus")
    .select("*")
    .eq("game_date", date);

  const consensusMap = new Map<string, any>();
  for (const c of consensusData ?? []) {
    consensusMap.set(`${normalizeTeam(c.away_team)}|${normalizeTeam(c.home_team)}`, c);
  }

  const enrichedGames = allGames.map((game: any) => {
    const key = `${normalizeTeam(game.awayTeam)}|${normalizeTeam(game.homeTeam)}`;
    return {
      ...game,
      odds: oddsMap.get(key) ?? [],
      signals: signalsMap.get(key) ?? [],
      consensus: consensusMap.get(key) ?? null,
    };
  });

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

export async function savePick(pick: {
  userId: string;
  gameDate: string;
  externalGameId: string | null;
  awayTeam: string;
  homeTeam: string;
  sportKey: string;
  pickedTeam: string;
  pickOdds: number;
}) {
  const supabase = createServiceClient();
  const { error } = await supabase.from("bet_slip").insert({
    user_id: pick.userId,
    game_date: pick.gameDate,
    external_game_id: pick.externalGameId,
    away_team: pick.awayTeam,
    home_team: pick.homeTeam,
    sport_key: pick.sportKey,
    picked_team: pick.pickedTeam,
    pick_odds: pick.pickOdds,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function fetchMyPicks(userId: string) {
  const supabase = createServiceClient();
  const { data: picks } = await supabase
    .from("bet_slip")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!picks || picks.length === 0) return [];

  const todayET = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

  // Fetch ESPN final scores for each unique past game date
  const uniqueDates = [...new Set(picks.map((p: any) => p.game_date as string))].filter(d => d <= todayET);
  const scoresByGame: Record<string, { homeScore: number; awayScore: number; isFinal: boolean; isLive: boolean }> = {};

  for (const d of uniqueDates) {
    const dateStr = d.replace(/-/g, "");
    const sportPaths = ["basketball/nba", "baseball/mlb", "basketball/mens-college-basketball"];
    await Promise.all(sportPaths.map(async (path) => {
      try {
        const res = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard?dates=${dateStr}`,
          { next: { revalidate: 3600 } }
        );
        if (!res.ok) return;
        const data = await res.json();
        for (const event of data.events ?? []) {
          const comp = event.competitions?.[0];
          const home = comp?.competitors?.find((c: any) => c.homeAway === "home");
          const away = comp?.competitors?.find((c: any) => c.homeAway === "away");
          if (!home || !away) continue;
          const state = event.status?.type?.state;
          scoresByGame[event.id] = {
            homeScore: Number(home.score ?? 0),
            awayScore: Number(away.score ?? 0),
            isFinal: state === "post",
            isLive: state === "in",
          };
        }
      } catch {}
    }));
  }

  return picks.map((pick: any) => {
    const scores = pick.external_game_id ? scoresByGame[pick.external_game_id] : null;
    let result: "win" | "loss" | "live" | "pending" = "pending";
    if (scores?.isLive) {
      result = "live";
    } else if (scores?.isFinal) {
      const pickedHome = pick.picked_team === pick.home_team;
      result = pickedHome
        ? scores.homeScore > scores.awayScore ? "win" : "loss"
        : scores.awayScore > scores.homeScore ? "win" : "loss";
    }
    return { ...pick, result, scores };
  });
}
