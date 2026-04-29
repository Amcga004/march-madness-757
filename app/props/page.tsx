import PropsClient from "./PropsClient";
import { getLogicalGameDate } from "@/lib/utils/dateUtils";

export const dynamic = "force-dynamic";

const LEAGUE_AVG_XFIP = 4.20;
const LEAGUE_AVG_HR9 = 1.20;
const AVG_BATTERS_FACED = 21;
const AVG_PA_PER_GAME = 4.0;
const AVG_IP = 5.5;

export interface PitcherProjection {
  name: string;
  team: string;
  xfip: number | null;
  kPct: number | null;
  bbPct: number | null;
  swStrPct: number | null;
  hr9: number | null;
  projectedKs: number | null;
  projectedHits: number | null;
  projectedER: number | null;
}

export interface BatterProjection {
  name: string;
  team: string;
  slot: number;
  position: string;
  xwoba: number | null;
  xba: number | null;
  xslg: number | null;
  barrelPct: number | null;
  hardHitPct: number | null;
  exitVelo: number | null;
  projectedTotalBases: number | null;
  hrProb: number | null;
  rbiProb: number | null;
}

export interface GameProps {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  gameTime: string;
  homePitcher: PitcherProjection | null;
  awayPitcher: PitcherProjection | null;
  homeLineup: BatterProjection[];
  awayLineup: BatterProjection[];
  homeF1RunProb: number | null;
  awayF1RunProb: number | null;
  homeF5WinProb: number | null;
  hasLineups: boolean;
}

export interface NBAGameInfo { homeTeam: string; awayTeam: string; gameTime: string; }
export interface NHLGameInfo { homeTeam: string; awayTeam: string; gameTime: string; }

function buildPitcherProjection(name: string, team: string, fg: any): PitcherProjection {
  const kPct = fg ? (parseFloat(fg["K%"] ?? "") || null) : null;
  const bbPct = fg ? (parseFloat(fg["BB%"] ?? "") || null) : null;
  const xfip = fg ? (parseFloat(fg["xFIP"] ?? "") || null) : null;
  const swStrPct = fg ? (parseFloat(fg["SwStr%"] ?? "") || null) : null;
  const hr9 = fg ? (parseFloat(fg["HR/9"] ?? "") || null) : null;

  const projectedKs = kPct != null ? Math.round(kPct * AVG_BATTERS_FACED * 10) / 10 : null;
  const projectedHits = kPct != null && bbPct != null
    ? Math.round((1 - kPct - bbPct) * AVG_BATTERS_FACED * 0.30 * 10) / 10
    : null;
  const projectedER = xfip != null ? Math.round(xfip * AVG_IP / 9 * 10) / 10 : null;

  return { name, team, xfip, kPct, bbPct, swStrPct, hr9, projectedKs, projectedHits, projectedER };
}

function buildBatterProjection(
  player: any,
  team: string,
  slot: number,
  sv: any,
  oppHr9: number | null
): BatterProjection {
  const name: string = player?.fullName ?? player?.person?.fullName ?? "";
  const position: string = player?.primaryPosition?.abbreviation ?? player?.position?.abbreviation ?? "?";

  const xwoba = sv ? (parseFloat(sv.xwoba ?? "") || null) : null;
  const xba = sv ? (parseFloat(sv.xba ?? "") || null) : null;
  const xslg = sv ? (parseFloat(sv.xslg ?? "") || null) : null;
  const barrelPct = sv ? (parseFloat(sv.barrel_batted_rate ?? sv["barrel%"] ?? "") || null) : null;
  const hardHitPct = sv ? (parseFloat(sv.hard_hit_percent ?? "") || null) : null;
  const exitVelo = sv ? (parseFloat(sv.avg_hit_speed ?? sv.exit_velocity_avg ?? "") || null) : null;

  const projectedTotalBases = xslg != null ? Math.round(xslg * AVG_PA_PER_GAME * 10) / 10 : null;

  const oppHr9Factor = oppHr9 != null ? 1 + (oppHr9 - LEAGUE_AVG_HR9) / LEAGUE_AVG_HR9 : 1;
  const hrProb = barrelPct != null ? Math.round(barrelPct * 0.055 * oppHr9Factor * 1000) / 1000 : null;
  const rbiProb = xwoba != null ? Math.round(xwoba * 0.25 * 100) / 100 : null;

  return { name, team, slot, position, xwoba, xba, xslg, barrelPct, hardHitPct, exitVelo, projectedTotalBases, hrProb, rbiProb };
}

export default async function PropsPage() {
  const today = getLogicalGameDate();
  const dateStr = today.replace(/-/g, "");

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

  const fgPitcherMap = new Map<string, any>();
  for (const p of fgPitchersRes.data ?? []) {
    const name = (p.Name ?? "").replace(/<[^>]+>/g, "").trim().toLowerCase();
    if (name) fgPitcherMap.set(name, p);
  }

  const savantBatterMap = new Map<string, any>();
  for (const b of savantBatters) {
    const n1 = (b.last_name + " " + b.first_name).trim().toLowerCase();
    const n2 = (b.first_name + " " + b.last_name).trim().toLowerCase();
    if (n1) { savantBatterMap.set(n1, b); savantBatterMap.set(n2, b); }
  }

  const savantPitcherMap = new Map<string, any>();
  for (const p of savantPitchers) {
    const n1 = (p.last_name + " " + p.first_name).trim().toLowerCase();
    const n2 = (p.first_name + " " + p.last_name).trim().toLowerCase();
    if (n1) { savantPitcherMap.set(n1, p); savantPitcherMap.set(n2, p); }
  }

  const mlbGameProps: GameProps[] = [];

  for (const dateEntry of scheduleRes.dates ?? []) {
    for (const game of dateEntry.games ?? []) {
      const gameId = String(game.gamePk ?? Math.random());
      const homeTeam: string = game.teams?.home?.team?.name ?? "";
      const awayTeam: string = game.teams?.away?.team?.name ?? "";
      const rawTime: string = game.gameDate ?? "";
      const gameTime = rawTime
        ? new Date(rawTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) + " ET"
        : "";

      const homePitcherName: string | null = game.teams?.home?.probablePitcher?.fullName ?? null;
      const awayPitcherName: string | null = game.teams?.away?.probablePitcher?.fullName ?? null;

      const homeFg = homePitcherName ? fgPitcherMap.get(homePitcherName.toLowerCase()) ?? null : null;
      const awayFg = awayPitcherName ? fgPitcherMap.get(awayPitcherName.toLowerCase()) ?? null : null;

      const homePitcher = homePitcherName ? buildPitcherProjection(homePitcherName, homeTeam, homeFg) : null;
      const awayPitcher = awayPitcherName ? buildPitcherProjection(awayPitcherName, awayTeam, awayFg) : null;

      // F5 win prob for home team
      const homeF5WinProb =
        homePitcher?.xfip != null && awayPitcher?.xfip != null
          ? Math.max(0.28, Math.min(0.72, 0.5 + (awayPitcher.xfip - homePitcher.xfip) * 0.12))
          : null;

      // F1 run prob: chance either team scores in 1st inning
      const homeF1RunProb = awayPitcher?.xfip != null
        ? Math.max(0.10, Math.min(0.60, 0.28 + (awayPitcher.xfip - LEAGUE_AVG_XFIP) * 0.04))
        : null;
      const awayF1RunProb = homePitcher?.xfip != null
        ? Math.max(0.10, Math.min(0.60, 0.28 + (homePitcher.xfip - LEAGUE_AVG_XFIP) * 0.04))
        : null;

      const homeLineupRaw: any[] = game.lineups?.homePlayers ?? [];
      const awayLineupRaw: any[] = game.lineups?.awayPlayers ?? [];
      const hasLineups = homeLineupRaw.length > 0 || awayLineupRaw.length > 0;

      const homeLineup: BatterProjection[] = homeLineupRaw
        .map((p: any, i: number) => {
          const sv = savantBatterMap.get((p?.fullName ?? p?.person?.fullName ?? "").toLowerCase()) ?? null;
          return buildBatterProjection(p, homeTeam, i + 1, sv, awayPitcher?.hr9 ?? null);
        })
        .filter(b => b.name);

      const awayLineup: BatterProjection[] = awayLineupRaw
        .map((p: any, i: number) => {
          const sv = savantBatterMap.get((p?.fullName ?? p?.person?.fullName ?? "").toLowerCase()) ?? null;
          return buildBatterProjection(p, awayTeam, i + 1, sv, homePitcher?.hr9 ?? null);
        })
        .filter(b => b.name);

      mlbGameProps.push({
        gameId,
        homeTeam,
        awayTeam,
        gameTime,
        homePitcher,
        awayPitcher,
        homeLineup,
        awayLineup,
        homeF1RunProb,
        awayF1RunProb,
        homeF5WinProb,
        hasLineups,
      });
    }
  }

  const nbaGames: NBAGameInfo[] = [];
  for (const event of nbaScheduleRes.events ?? []) {
    const comp = event.competitions?.[0];
    const home = comp?.competitors?.find((c: any) => c.homeAway === "home");
    const away = comp?.competitors?.find((c: any) => c.homeAway === "away");
    if (!home || !away) continue;
    const t = comp?.date ?? "";
    nbaGames.push({
      homeTeam: home.team?.displayName ?? "",
      awayTeam: away.team?.displayName ?? "",
      gameTime: t ? new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) + " ET" : "",
    });
  }

  const nhlGames: NHLGameInfo[] = [];
  for (const event of nhlScheduleRes.events ?? []) {
    const comp = event.competitions?.[0];
    const home = comp?.competitors?.find((c: any) => c.homeAway === "home");
    const away = comp?.competitors?.find((c: any) => c.homeAway === "away");
    if (!home || !away) continue;
    const t = comp?.date ?? "";
    nhlGames.push({
      homeTeam: home.team?.displayName ?? "",
      awayTeam: away.team?.displayName ?? "",
      gameTime: t ? new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) + " ET" : "",
    });
  }

  return (
    <PropsClient
      date={today}
      mlbGameProps={mlbGameProps}
      nbaGames={nbaGames}
      nhlGames={nhlGames}
    />
  );
}
