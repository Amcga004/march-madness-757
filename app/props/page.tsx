import { getUser } from "@/lib/auth/authHelpers";
import PropsClient from "./PropsClient";
import { getLogicalGameDate } from "@/lib/utils/dateUtils";

export const dynamic = "force-dynamic";

export default async function PropsPage() {
  const user = await getUser();
  const today = getLogicalGameDate();
  const dateStr = today.replace(/-/g, "");

  // ── Fetch today's MLB schedule with lineups + probable pitchers ──
  const [scheduleRes, savantBattersRes, savantPitchersRes, fgPitchersRes, nbaScheduleRes, nhlScheduleRes] = await Promise.all([
    fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}&hydrate=probablePitcher,lineups`, { cache: "no-store" }).then(r => r.json()).catch(() => ({ dates: [] })),
    fetch(`https://baseballsavant.mlb.com/leaderboard/expected_statistics?type=batter&year=2026&min=20&position=&team=&csv=true`, { next: { revalidate: 3600 } }).then(r => r.text()).catch(() => ""),
    fetch(`https://baseballsavant.mlb.com/leaderboard/expected_statistics?type=pitcher&year=2026&min=10&position=&team=&csv=true`, { next: { revalidate: 3600 } }).then(r => r.text()).catch(() => ""),
    fetch(`https://www.fangraphs.com/api/leaders/major-league/data?age=0&pos=all&stats=pit&lg=all&qual=0&season=2026&season1=2026&ind=0&team=0&pageitems=500`, { next: { revalidate: 3600 } }).then(r => r.json()).catch(() => ({ data: [] })),
    fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${dateStr}`, { cache: "no-store" }).then(r => r.json()).catch(() => ({ events: [] })),
    fetch(`https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=${dateStr}`, { cache: "no-store" }).then(r => r.json()).catch(() => ({ events: [] })),
  ]);

  function parseCSV(csv: string): Record<string, string>[] {
    const lines = csv.trim().split("\n");
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(h => h.replace(/"/g, "").trim());
    return lines.slice(1).map(line => {
      const vals = line.split(",").map(v => v.replace(/"/g, "").trim());
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
      return obj;
    });
  }

  const savantBatters = parseCSV(savantBattersRes);
  const savantPitchers = parseCSV(savantPitchersRes);

  // Build pitcher stat map from FanGraphs (xFIP, K%, SwStr%, BB%)
  const fgPitcherMap = new Map<string, any>();
  for (const p of fgPitchersRes.data ?? []) {
    const name = (p.Name ?? "").replace(/<[^>]+>/g, "").trim().toLowerCase();
    if (name) fgPitcherMap.set(name, p);
  }

  // Build savant batter map keyed by player name
  const savantBatterMap = new Map<string, any>();
  for (const b of savantBatters) {
    const name = (b.last_name + " " + b.first_name).trim().toLowerCase();
    const name2 = (b.first_name + " " + b.last_name).trim().toLowerCase();
    if (name) { savantBatterMap.set(name, b); savantBatterMap.set(name2, b); }
  }

  // Build savant pitcher map
  const savantPitcherMap = new Map<string, any>();
  for (const p of savantPitchers) {
    const name = (p.last_name + " " + p.first_name).trim().toLowerCase();
    const name2 = (p.first_name + " " + p.last_name).trim().toLowerCase();
    if (name) { savantPitcherMap.set(name, p); savantPitcherMap.set(name2, p); }
  }

  // ── MLB: collect today's games with pitchers + lineup players ──
  interface MLBPlayerProp {
    name: string;
    team: string;
    opponent: string;
    gameTime: string;
    position: string;
    xwoba: number | null;
    xba: number | null;
    xslg: number | null;
    barrelPct: number | null;
    hardHitPct: number | null;
    exitVelo: number | null;
    ev50: number | null;
    propScore: number;
    hrScore: number;
    kScore: number | null; // pitchers only
    xfip: number | null;   // pitchers only
    kPct: number | null;
    bbPct: number | null;
    isPitcher: boolean;
    confirmed: boolean; // lineup confirmed
  }

  const mlbProps: MLBPlayerProp[] = [];
  const mlbGames: Array<{ homeTeam: string; awayTeam: string; gameTime: string; homePitcher: string | null; awayPitcher: string | null }> = [];

  for (const dateEntry of scheduleRes.dates ?? []) {
    for (const game of dateEntry.games ?? []) {
      const homeTeam: string = game.teams?.home?.team?.name ?? "";
      const awayTeam: string = game.teams?.away?.team?.name ?? "";
      const gameTime: string = game.gameDate ?? "";
      const homePitcherName: string | null = game.teams?.home?.probablePitcher?.fullName ?? null;
      const awayPitcherName: string | null = game.teams?.away?.probablePitcher?.fullName ?? null;

      mlbGames.push({ homeTeam, awayTeam, gameTime, homePitcher: homePitcherName, awayPitcher: awayPitcherName });

      const formattedTime = gameTime ? new Date(gameTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) + " ET" : "";

      // Add pitchers
      for (const [pitcherName, team, opp] of [
        [homePitcherName, homeTeam, awayTeam],
        [awayPitcherName, awayTeam, homeTeam],
      ] as [string | null, string, string][]) {
        if (!pitcherName) continue;
        const nameLower = pitcherName.toLowerCase();
        const fg = fgPitcherMap.get(nameLower) ?? null;
        const sv = savantPitcherMap.get(nameLower) ?? null;

        const kPct = fg ? parseFloat(fg["K%"] ?? "0") : null;
        const bbPct = fg ? parseFloat(fg["BB%"] ?? "0") : null;
        const xfip = fg ? parseFloat(fg["xFIP"] ?? "0") : null;
        const swStrPct = fg ? parseFloat(fg["SwStr%"] ?? "0") : null;
        const xwoba = sv ? parseFloat(sv.xwoba ?? "0") : null;

        // K score: higher K%, lower xFIP, higher SwStr% = better K upside
        const kScore = kPct !== null && xfip !== null
          ? Math.round(((kPct * 0.5) + ((swStrPct ?? 0) * 0.3) + ((5.00 - Math.min(xfip, 5.0)) / 5.0 * 0.2)) * 1000) / 10
          : null;

        mlbProps.push({
          name: pitcherName,
          team,
          opponent: opp,
          gameTime: formattedTime,
          position: "SP",
          xwoba: xwoba,
          xba: null,
          xslg: null,
          barrelPct: null,
          hardHitPct: null,
          exitVelo: null,
          ev50: null,
          propScore: 0,
          hrScore: 0,
          kScore,
          xfip,
          kPct,
          bbPct,
          isPitcher: true,
          confirmed: true,
        });
      }

      // Add hitters from lineups if available
      const homeLineup: any[] = game.lineups?.homePlayers ?? [];
      const awayLineup: any[] = game.lineups?.awayPlayers ?? [];

      const allLineuped: Array<{ player: any; team: string; opp: string; confirmed: boolean }> = [
        ...homeLineup.map((p: any) => ({ player: p, team: homeTeam, opp: awayTeam, confirmed: true })),
        ...awayLineup.map((p: any) => ({ player: p, team: awayTeam, opp: homeTeam, confirmed: true })),
      ];

      for (const { player, team, opp, confirmed } of allLineuped) {
        const playerName: string = player?.fullName ?? player?.person?.fullName ?? "";
        if (!playerName) continue;
        const nameLower = playerName.toLowerCase();
        const sv = savantBatterMap.get(nameLower) ?? null;

        const xwoba = sv ? parseFloat(sv.xwoba ?? "0") : null;
        const xba = sv ? parseFloat(sv.xba ?? "0") : null;
        const xslg = sv ? parseFloat(sv.xslg ?? "0") : null;
        const barrelPct = sv ? parseFloat(sv.barrel_batted_rate ?? sv["barrel%"] ?? "0") : null;
        const hardHitPct = sv ? parseFloat(sv.hard_hit_percent ?? "0") : null;
        const exitVelo = sv ? parseFloat(sv.avg_hit_speed ?? sv.exit_velocity_avg ?? "0") : null;
        const ev50 = sv ? parseFloat(sv.ev50 ?? "0") : null;

        // Overall prop score (0-100 scale)
        const propScore = xwoba !== null
          ? Math.round(((xwoba * 0.4) + ((barrelPct ?? 0) / 100 * 0.3) + ((hardHitPct ?? 0) / 100 * 0.2) + ((exitVelo ?? 88) / 110 * 0.1)) * 100)
          : 0;

        // HR score — barrels + hard hit + EV
        const hrScore = Math.round(((barrelPct ?? 0) * 0.5) + ((hardHitPct ?? 0) * 0.3) + ((exitVelo ?? 0) / 110 * 20));

        mlbProps.push({
          name: playerName,
          team,
          opponent: opp,
          gameTime: formattedTime,
          position: player?.primaryPosition?.abbreviation ?? player?.position?.abbreviation ?? "?",
          xwoba,
          xba,
          xslg,
          barrelPct,
          hardHitPct,
          exitVelo,
          ev50,
          propScore,
          hrScore,
          kScore: null,
          xfip: null,
          kPct: null,
          bbPct: null,
          isPitcher: false,
          confirmed,
        });
      }
    }
  }

  // ── NBA: collect today's games ──
  interface NBAGameInfo {
    homeTeam: string;
    awayTeam: string;
    gameTime: string;
    homeId: string;
    awayId: string;
  }
  const nbaGames: NBAGameInfo[] = [];
  for (const event of nbaScheduleRes.events ?? []) {
    const comp = event.competitions?.[0];
    const home = comp?.competitors?.find((c: any) => c.homeAway === "home");
    const away = comp?.competitors?.find((c: any) => c.homeAway === "away");
    if (!home || !away) continue;
    const gameTime = comp?.date ?? "";
    nbaGames.push({
      homeTeam: home.team?.displayName ?? "",
      awayTeam: away.team?.displayName ?? "",
      homeId: home.team?.id ?? "",
      awayId: away.team?.id ?? "",
      gameTime: gameTime ? new Date(gameTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) + " ET" : "",
    });
  }

  // ── NHL: collect today's games ──
  interface NHLGameInfo {
    homeTeam: string;
    awayTeam: string;
    gameTime: string;
  }
  const nhlGames: NHLGameInfo[] = [];
  for (const event of nhlScheduleRes.events ?? []) {
    const comp = event.competitions?.[0];
    const home = comp?.competitors?.find((c: any) => c.homeAway === "home");
    const away = comp?.competitors?.find((c: any) => c.homeAway === "away");
    if (!home || !away) continue;
    const gameTime = comp?.date ?? "";
    nhlGames.push({
      homeTeam: home.team?.displayName ?? "",
      awayTeam: away.team?.displayName ?? "",
      gameTime: gameTime ? new Date(gameTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) + " ET" : "",
    });
  }

  // Sort MLB props
  const topHitters = [...mlbProps]
    .filter(p => !p.isPitcher && p.xwoba !== null && p.xwoba > 0)
    .sort((a, b) => b.propScore - a.propScore)
    .slice(0, 20);

  const topHRCandidates = [...mlbProps]
    .filter(p => !p.isPitcher && p.barrelPct !== null && p.barrelPct > 0)
    .sort((a, b) => b.hrScore - a.hrScore)
    .slice(0, 15);

  const topKPitchers = [...mlbProps]
    .filter(p => p.isPitcher && p.kScore !== null)
    .sort((a, b) => (b.kScore ?? 0) - (a.kScore ?? 0))
    .slice(0, 10);

  const topTotalBases = [...mlbProps]
    .filter(p => !p.isPitcher && p.xslg !== null && p.xslg > 0)
    .sort((a, b) => (b.xslg ?? 0) - (a.xslg ?? 0))
    .slice(0, 15);

  return (
    <PropsClient
      date={today}
      topHitters={topHitters}
      topHRCandidates={topHRCandidates}
      topKPitchers={topKPitchers}
      topTotalBases={topTotalBases}
      mlbGames={mlbGames}
      nbaGames={nbaGames}
      nhlGames={nhlGames}
      hasLineups={mlbProps.filter(p => !p.isPitcher && p.confirmed).length > 0}
    />
  );
}
