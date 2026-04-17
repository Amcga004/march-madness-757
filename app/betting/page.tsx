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
  const today = new Date().toISOString().split("T")[0];
  const params = await searchParams;
  const date = params.date ?? today;
  const sport = params.sport ?? "all";

  const supabase = createServiceClient();

  let oddsQuery = supabase
    .from("market_odds")
    .select("*")
    .gte("commence_time", `${date}T00:00:00Z`)
    .lt("commence_time", `${date}T23:59:59Z`)
    .order("commence_time");

  if (sport !== "all") oddsQuery = oddsQuery.eq("sport_key", sport);
  const { data: odds } = await oddsQuery;

  let signals = null;
  if (user) {
    let sigQuery = supabase
      .from("signals")
      .select("*")
      .eq("game_date", date)
      .eq("suppressed", false)
      .order("edge_pct", { ascending: false });
    if (sport !== "all") sigQuery = sigQuery.eq("sport_key", sport);
    const { data } = await sigQuery;
    signals = data;
  }

  let consensusQuery = supabase
    .from("consensus")
    .select("*")
    .eq("game_date", date);
  if (sport !== "all") consensusQuery = consensusQuery.eq("sport_key", sport);
  const { data: consensus } = await consensusQuery;

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
    const tournamentId = (activeTournament.metadata as any)?.tournamentId;
    if (tournamentId) {
      const key = process.env.SPORTS_DATA_IO_KEY;
      const lbRes = await fetch(
        `https://api.sportsdata.io/golf/v2/json/Leaderboard/${tournamentId}?key=${key}`,
        { next: { revalidate: 120 } }
      ).then(r => r.json()).catch(() => null);

      console.log("[golf] tournament:", activeTournament?.name, "players:", lbRes?.Players?.length ?? 0);

      if (lbRes?.Players) {
        golfRoundStatus = lbRes.Name ?? activeTournament.name;

        golfLeaderboard = lbRes.Players
          .sort((a: any, b: any) => (a.Rank ?? 999) - (b.Rank ?? 999))
          .slice(0, 20)
          .map((p: any) => {
            const fullName = [p.FirstName, p.LastName].filter(Boolean).join(" ").trim()
              || [p.firstName, p.lastName].filter(Boolean).join(" ").trim()
              || p.Name
              || p.PlayerName
              || "Unknown";
            const rounds = p.Rounds ?? [];
            const getScore = (roundNum: number) => {
              const r = rounds.find((r: any) => r.Number === roundNum);
              return r?.Strokes ?? null;
            };
            return {
              position: p.Rank ?? "—",
              name: fullName,
              totalVsPar: p.TotalScore !== null && p.TotalScore !== undefined
                ? Math.round(Number(p.TotalScore))
                : null,
              todayVsPar: (() => {
                const lastRound = rounds[rounds.length - 1];
                if (!lastRound?.Strokes || !lastRound?.Par) return null;
                return lastRound.Strokes - lastRound.Par;
              })(),
              thru: (() => {
                const lastRound = rounds[rounds.length - 1];
                if (!lastRound) return "--";
                if (lastRound.HolesCompleted === 18) return "F";
                if (lastRound.HolesCompleted > 0) return `${lastRound.HolesCompleted}`;
                return "--";
              })(),
              r1: getScore(1),
              r2: getScore(2),
              r3: getScore(3),
              r4: getScore(4),
            };
          });
      }
    }
  }

  const { data: teamLogos } = await supabase
    .from("platform_teams")
    .select("canonical_name, abbreviation, sport_key, metadata")
    .in("sport_key", ["nba", "mlb", "ncaab"]);

  return (
    <BettingSlateClient
      date={date}
      sport={sport}
      odds={odds ?? []}
      signals={signals}
      consensus={consensus ?? []}
      mlbStartersByTeam={mlbStartersByTeam}
      golfLeaderboard={golfLeaderboard}
      golfTournamentName={activeTournament?.name ?? ""}
      golfRoundStatus={golfRoundStatus}
      teamLogos={teamLogos ?? []}
      user={user ? { id: user.id, email: user.email } : null}
    />
  );
}
