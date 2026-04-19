import { getUser } from "@/lib/auth/authHelpers";
import { createServiceClient } from "@/lib/supabase/service";
import BettingSlateClient from "./BettingSlateClient";

export const dynamic = "force-dynamic";

export default async function BettingPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; sport?: string }>;
}) {
  const user = await getUser();
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  }); // Returns YYYY-MM-DD in ET
  const params = await searchParams;
  const date = params.date ?? today;
  const sport = params.sport ?? "all";

  const supabase = createServiceClient();

  // Fetch full schedule from ESPN for each sport
  async function fetchEspnScoreboard(sportPath: string) {
    try {
      const res = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/scoreboard`,
        { next: { revalidate: 60 } }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.events ?? [];
    } catch { return []; }
  }

  const [nbaEvents, mlbEvents2, ncaabEvents] = await Promise.all([
    sport === "all" || sport === "nba" ? fetchEspnScoreboard("basketball/nba") : Promise.resolve([]),
    sport === "all" || sport === "mlb" ? fetchEspnScoreboard("baseball/mlb") : Promise.resolve([]),
    sport === "all" || sport === "ncaab" ? fetchEspnScoreboard("basketball/mens-college-basketball") : Promise.resolve([]),
  ]);

  // Normalize ESPN events into a consistent game format
  function normalizeEspnGame(event: any, sportKey: string) {
    const competition = event.competitions?.[0];
    const home = competition?.competitors?.find((c: any) => c.homeAway === "home");
    const away = competition?.competitors?.find((c: any) => c.homeAway === "away");
    if (!home || !away) return null;

    const statusType = event.status?.type;
    const isLive = statusType?.state === "in";
    const isFinal = statusType?.state === "post";
    const statusDetail = statusType?.shortDetail ?? statusType?.description ?? "";

    return {
      id: event.id,
      sportKey,
      homeTeam: home.team?.displayName,
      awayTeam: away.team?.displayName,
      homeAbbr: home.team?.abbreviation,
      awayAbbr: away.team?.abbreviation,
      homeLogo: home.team?.logo ?? null,
      awayLogo: away.team?.logo ?? null,
      homeScore: isLive || isFinal ? home.score : null,
      awayScore: isLive || isFinal ? away.score : null,
      commenceTime: competition?.date,
      isLive,
      isFinal,
      statusDetail,
      homeRecord: home.records?.[0]?.summary ?? null,
      awayRecord: away.records?.[0]?.summary ?? null,
    };
  }

  const allEspnGames = [
    ...nbaEvents.map((e: any) => normalizeEspnGame(e, "nba")),
    ...mlbEvents2.map((e: any) => normalizeEspnGame(e, "mlb")),
    ...ncaabEvents.map((e: any) => normalizeEspnGame(e, "ncaab")),
  ].filter(Boolean);

  // Fetch odds and index by team name for enrichment
  let oddsQuery = supabase
    .from("market_odds")
    .select("*")
    .gte("commence_time", `${date}T00:00:00Z`)
    .lt("commence_time", `${date}T23:59:59Z`);

  const { data: oddsData } = await oddsQuery;

  function normalizeTeam(name: string) {
    return name.toLowerCase().trim()
      .replace(/[^a-z0-9 ]/g, '')
      .replace(/\s+/g, ' ');
  }

  // Build odds lookup by normalized team names
  const oddsMap = new Map<string, any[]>();
  for (const odd of oddsData ?? []) {
    const key = `${normalizeTeam(odd.away_team)}|${normalizeTeam(odd.home_team)}`;
    if (!oddsMap.has(key)) oddsMap.set(key, []);
    oddsMap.get(key)!.push(odd);
  }

  // Fetch signals and join onto games directly
  const signalsMap = new Map<string, any[]>();
  if (user) {
    let sigQuery = supabase
      .from("signals")
      .select("*")
      .eq("game_date", date)
      .eq("suppressed", false)
      .order("edge_pct", { ascending: false });
    if (sport !== "all") sigQuery = sigQuery.eq("sport_key", sport);
    const { data: sigData } = await sigQuery;
    for (const s of sigData ?? []) {
      const key = `${normalizeTeam(s.away_team)}|${normalizeTeam(s.home_team)}`;
      if (!signalsMap.has(key)) signalsMap.set(key, []);
      signalsMap.get(key)!.push(s);
    }
  }

  // Fetch consensus and join onto games directly
  const consensusMap = new Map<string, any>();
  let consensusQuery = supabase
    .from("consensus")
    .select("*")
    .eq("game_date", date);
  if (sport !== "all") consensusQuery = consensusQuery.eq("sport_key", sport);
  const { data: consensusData } = await consensusQuery;
  for (const c of consensusData ?? []) {
    consensusMap.set(`${normalizeTeam(c.away_team)}|${normalizeTeam(c.home_team)}`, c);
  }

  // Merge ESPN games with odds, signals, and consensus
  const enrichedGames = allEspnGames.map((game: any) => {
    const key = `${normalizeTeam(game.awayTeam)}|${normalizeTeam(game.homeTeam)}`;
    return {
      ...game,
      odds: oddsMap.get(key) ?? [],
      signals: signalsMap.get(key) ?? [],
      consensus: consensusMap.get(key) ?? null,
    };
  });

  const startersResult = await fetch(
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=probablePitcher`,
    { next: { revalidate: 0 } }
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

  // Fetch active golf tournament and leaderboard
  const todayStr = new Date().toISOString();
  const { data: activeTournament } = await supabase
    .from("platform_events")
    .select("id, name, metadata, status, starts_at")
    .eq("sport_key", "pga")
    .lte("starts_at", todayStr)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let golfLeaderboard: any[] = [];
  let golfRoundStatus = "";

  if (activeTournament) {
    try {
      const res = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        const event = data.events?.[0];
        const competition = event?.competitions?.[0];

        golfRoundStatus = event?.status?.type?.shortDetail ?? "";

        if (competition) {
          golfLeaderboard = (competition.competitors ?? [])
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
        }
      }
    } catch (e) {
      console.error("[golf-espn] error:", e);
    }
  }

  const { data: teamLogos } = await supabase
    .from("platform_teams")
    .select("canonical_name, abbreviation, sport_key, metadata")
    .in("sport_key", ["nba", "mlb", "ncaab"]);

  return (
    <BettingSlateClient
      date={date}
      todayET={today}
      sport={sport}
      games={enrichedGames}
      teamLogos={teamLogos ?? []}
      mlbStartersByTeam={mlbStartersByTeam}
      golfLeaderboard={golfLeaderboard}
      golfTournamentName={activeTournament?.name ?? ""}
      golfTournamentId={String((activeTournament?.metadata as any)?.tournamentId ?? "")}
      golfRoundStatus={golfRoundStatus}
      user={user ? { id: user.id, email: user.email } : null}
    />
  );
}
