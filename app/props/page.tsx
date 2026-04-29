import PropsClient from "./PropsClient";
import { getLogicalGameDate } from "@/lib/utils/dateUtils";
import { createServiceClient } from "@/lib/supabase/service";

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
  // Season stats
  wins: number | null;
  losses: number | null;
  era: string | null;
  whip: string | null;
  strikeOuts: number | null;
  inningsPitched: string | null;
}

export interface BatterProjection {
  name: string;
  team: string;
  slot: number;
  position: string;
  isProjected: boolean;
  xwoba: number | null;
  xba: number | null;
  xslg: number | null;
  barrelPct: number | null;
  hardHitPct: number | null;
  exitVelo: number | null;
  projectedTotalBases: number | null;
  hrProb: number | null;
  rbiProb: number | null;
  // Season stats for display
  seasonAVG: string | null;
  seasonSLG: string | null;
  seasonHR: number | null;
  seasonRBI: number | null;
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
  yrfiProb: number | null;
  hasLineups: boolean;
  // Logos + records
  homeLogo: string | null;
  awayLogo: string | null;
  homeRecord: string | null;
  awayRecord: string | null;
  // Consensus + signals
  consensusHomeWinProb: number | null;
  consensusAwayWinProb: number | null;
  marketHomeWinProb: number | null;
  marketAwayWinProb: number | null;
  bestEdgeSignal: { side: string; teamName: string; edgePct: number; tier: string } | null;
}

export interface NBAGameInfo { homeTeam: string; awayTeam: string; gameTime: string; }
export interface NHLGameInfo { homeTeam: string; awayTeam: string; gameTime: string; }

function buildPitcherProjection(name: string, team: string, fg: any, mlbStats?: any): PitcherProjection {
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

  return {
    name, team, xfip, kPct, bbPct, swStrPct, hr9, projectedKs, projectedHits, projectedER,
    wins: mlbStats?.wins ?? null,
    losses: mlbStats?.losses ?? null,
    era: mlbStats?.era ?? null,
    whip: mlbStats?.whip ?? null,
    strikeOuts: mlbStats?.strikeOuts ?? null,
    inningsPitched: mlbStats?.inningsPitched ?? null,
  };
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

  const xwoba = sv ? (parseFloat(sv.xwoba ?? sv.est_woba ?? "") || null) : null;
  const xba = sv ? (parseFloat(sv.xba ?? sv.est_ba ?? "") || null) : null;
  const xslg = sv ? (parseFloat(sv.xslg ?? sv.est_slg ?? "") || null) : null;
  const barrelPct = sv ? (parseFloat(sv.barrel_batted_rate ?? sv.brl_percent ?? sv["barrel%"] ?? sv.barrel_rate ?? "") || null) : null;
  const hardHitPct = sv ? (parseFloat(sv.hard_hit_percent ?? sv.hard_hit ?? sv.hh_percent ?? "") || null) : null;
  const exitVelo = sv ? (parseFloat(sv.avg_hit_speed ?? sv.launch_speed ?? sv.exit_velocity_avg ?? sv.avg_exit_velocity ?? "") || null) : null;

  const projectedTotalBases = xslg != null ? Math.round(xslg * AVG_PA_PER_GAME * 10) / 10 : null;

  // Season stats from Savant CSV
  const seasonAVG = sv ? (sv.ba ?? sv.batting_avg ?? sv.avg ?? null) : null;
  const seasonSLG = sv ? (sv.slg ?? sv.slugging_avg ?? sv.slg_percent ?? null) : null;
  const seasonHR = sv ? (parseInt(sv.home_run ?? sv.hr ?? "") || null) : null;
  const seasonRBI = sv ? (parseInt(sv.rbi ?? "") || null) : null;

  const oppHr9Factor = oppHr9 != null ? 1 + (oppHr9 - LEAGUE_AVG_HR9) / LEAGUE_AVG_HR9 : 1;
  const avgPA = AVG_PA_PER_GAME;
  // Slot factor: cleanup (3-5) gets RBI bump, top/bottom of order slightly lower
  const slotFactor = slot <= 2 ? 0.90 : slot <= 5 ? 1.10 : slot <= 7 ? 1.00 : 0.85;

  // HR: conservative — DK implies ~12%, we target ~8-10%
  const hrPerPA = barrelPct != null
    ? (barrelPct / 100) * 0.42 * oppHr9Factor
    : (xslg != null ? xslg * 0.03 : null);
  const hrProb = hrPerPA != null
    ? Math.round((1 - Math.pow(1 - hrPerPA, avgPA)) * 1000) / 1000
    : null;

  // RBI: conservative — DK implies ~28-30%, we target ~22-25%
  const rbiProb = xwoba != null
    ? Math.min(0.45, Math.round(xwoba * 0.70 * slotFactor * 1000) / 1000)
    : null;

  return { name, team, slot, position, isProjected: (player as any)?.isProjected ?? false, xwoba, xba, xslg, barrelPct, hardHitPct, exitVelo, projectedTotalBases, hrProb, rbiProb, seasonAVG, seasonSLG, seasonHR, seasonRBI };
}

export default async function PropsPage() {
  const today = getLogicalGameDate();
  const dateStr = today.replace(/-/g, "");

  const supabase = createServiceClient();

  const [scheduleRes, savantBattersRes, savantPitchersRes, fgPitchersRes, nbaScheduleRes, nhlScheduleRes, consensusRes, signalsRes, pitcherStatsRes, dtGamesRes, dtPlayersRes, dtProjectionsRes] = await Promise.all([
    fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}&hydrate=probablePitcher,lineups`, { cache: "no-store" }).then(r => r.json()).catch(() => ({ dates: [] })),
    fetch(`https://baseballsavant.mlb.com/leaderboard/expected_statistics?type=batter&year=2026&min=20&position=&team=&csv=true`, { next: { revalidate: 3600 } }).then(r => r.text()).catch(() => ""),
    fetch(`https://baseballsavant.mlb.com/leaderboard/expected_statistics?type=pitcher&year=2026&min=10&position=&team=&csv=true`, { next: { revalidate: 3600 } }).then(r => r.text()).catch(() => ""),
    fetch(`https://www.fangraphs.com/api/leaders/major-league/data?age=0&pos=all&stats=pit&lg=all&qual=0&season=2026&season1=2026&ind=0&team=0&pageitems=500`, { next: { revalidate: 3600 } }).then(r => r.json()).catch(() => ({ data: [] })),
    fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${dateStr}`, { cache: "no-store" }).then(r => r.json()).catch(() => ({ events: [] })),
    fetch(`https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=${dateStr}`, { cache: "no-store" }).then(r => r.json()).catch(() => ({ events: [] })),
    supabase.from("consensus").select("*").eq("game_date", today).eq("sport_key", "mlb"),
    supabase.from("signals").select("*").eq("game_date", today).eq("sport_key", "mlb").eq("suppressed", false),
    fetch(`https://statsapi.mlb.com/api/v1/stats?stats=season&group=pitching&season=2026&sportId=1&limit=1000&playerPool=All`, { next: { revalidate: 3600 } }).then(r => r.json()).catch(() => ({ splits: [] })),
    fetch(
      `https://dunksandthrees.com/api/v1/game-predictions?date=${today}`,
      { headers: { Authorization: process.env.DUNKS_AND_THREES_API_KEY ?? "" }, cache: "no-store" }
    ).then(r => r.json()).catch(() => []),
    fetch(
      `https://dunksandthrees.com/api/v1/players?date=${today}`,
      { headers: { Authorization: process.env.DUNKS_AND_THREES_API_KEY ?? "" }, cache: "no-store" }
    ).then(async r => { const t = await r.text(); console.log("[dt-players-status]", r.status, t.slice(0, 300)); return null; }).catch(() => null),
    fetch(
      `https://dunksandthrees.com/api/v1/epm?season=2026`,
      { headers: { Authorization: process.env.DUNKS_AND_THREES_API_KEY ?? "" }, cache: "no-store" }
    ).then(async r => { const t = await r.text(); console.log("[dt-epm-status]", r.status, t.slice(0, 300)); return null; }).catch(() => null),
  ]);

  console.log("[dt-players] response type:", typeof dtPlayersRes, Array.isArray(dtPlayersRes) ? "array len:" + dtPlayersRes?.length : JSON.stringify(dtPlayersRes)?.slice(0, 300));
  console.log("[dt-projections] response type:", typeof dtProjectionsRes, Array.isArray(dtProjectionsRes) ? "array len:" + dtProjectionsRes?.length : JSON.stringify(dtProjectionsRes)?.slice(0, 300));
  if (Array.isArray(dtPlayersRes) && dtPlayersRes.length > 0) {
    console.log("[dt-players] first player keys:", Object.keys(dtPlayersRes[0]).join(", "));
    console.log("[dt-players] first player sample:", JSON.stringify(dtPlayersRes[0]).slice(0, 600));
  }
  if (Array.isArray(dtProjectionsRes) && dtProjectionsRes.length > 0) {
    console.log("[dt-projections] first item keys:", Object.keys(dtProjectionsRes[0]).join(", "));
    console.log("[dt-projections] first item sample:", JSON.stringify(dtProjectionsRes[0]).slice(0, 600));
  }

  // Build consensus and signals lookup maps
  function normalizeTeam(name: string) {
    return name.toLowerCase().trim().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ");
  }

  const consensusMap = new Map<string, any>();
  for (const c of consensusRes.data ?? []) {
    const key = `${normalizeTeam(c.away_team)}|${normalizeTeam(c.home_team)}`;
    consensusMap.set(key, c);
  }

  const signalsMap = new Map<string, any[]>();
  for (const s of signalsRes.data ?? []) {
    const key = `${normalizeTeam(s.away_team)}|${normalizeTeam(s.home_team)}`;
    if (!signalsMap.has(key)) signalsMap.set(key, []);
    signalsMap.get(key)!.push(s);
  }

  // Fetch ESPN MLB scoreboard for logos + records
  const espnScoreboard = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${dateStr}`,
    { cache: "no-store" }
  ).then(r => r.json()).catch(() => ({ events: [] }));

  const espnGameMap = new Map<string, any>();
  for (const event of espnScoreboard.events ?? []) {
    const comp = event.competitions?.[0];
    const home = comp?.competitors?.find((c: any) => c.homeAway === "home");
    const away = comp?.competitors?.find((c: any) => c.homeAway === "away");
    if (!home || !away) continue;
    const key = `${normalizeTeam(away.team?.displayName ?? "")}|${normalizeTeam(home.team?.displayName ?? "")}`;
    espnGameMap.set(key, {
      homeLogo: home.team?.logo ?? null,
      awayLogo: away.team?.logo ?? null,
      homeRecord: home.records?.[0]?.summary ?? null,
      awayRecord: away.records?.[0]?.summary ?? null,
      homeColor: home.team?.color ? `#${home.team.color}` : null,
      awayColor: away.team?.color ? `#${away.team.color}` : null,
    });
  }

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

  // Debug: log first batter row keys to verify CSV column names
  if (savantBatters.length > 0) {
    console.log("[savant-batter-cols]", Object.keys(savantBatters[0]).join(", "));
    console.log("[savant-batter-sample]", JSON.stringify(savantBatters[0]));
  }

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

  // Build pitcher stats map by player name
  const mlbPitcherStatsMap = new Map<string, any>();
  const pitcherSplits = pitcherStatsRes?.stats?.[0]?.splits ?? [];
  console.log("[mlb-pitcher-stats] splits count:", pitcherSplits.length, "| sample:", JSON.stringify(pitcherSplits[0] ?? null));
  for (const split of pitcherSplits) {
    const name = (split.player?.fullName ?? "").toLowerCase();
    const stat = split.stat ?? {};
    if (name) {
      mlbPitcherStatsMap.set(name, {
        wins: stat.wins ?? null,
        losses: stat.losses ?? null,
        era: stat.era ?? null,
        whip: stat.whip ?? null,
        strikeOuts: stat.strikeOuts ?? null,
        inningsPitched: stat.inningsPitched ?? null,
        hitsPer9Inn: stat.hitsPer9Inn ?? null,
        obp: stat.obp ?? null,
      });
    }
  }

  // Fetch roster for a team as lineup fallback (top PA players)
  async function fetchTeamRoster(teamId: number): Promise<any[]> {
    try {
      const res = await fetch(
        `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=active&season=2026&hydrate=person(stats(type=season,group=hitting,season=2026))`,
        { next: { revalidate: 1800 } }
      );
      if (!res.ok) return [];
      const data = await res.json();
      const roster = data.roster ?? [];
      return roster
        .filter((p: any) => p.position?.code !== "1") // exclude pitchers
        .sort((a: any, b: any) => {
          const aPA = a.person?.stats?.[0]?.splits?.[0]?.stat?.plateAppearances ?? 0;
          const bPA = b.person?.stats?.[0]?.splits?.[0]?.stat?.plateAppearances ?? 0;
          return bPA - aPA;
        })
        .slice(0, 9)
        .map((p: any) => ({
          fullName: p.person?.fullName ?? "",
          primaryPosition: { abbreviation: p.position?.abbreviation ?? "?" },
          isProjected: true,
          plateAppearances: p.person?.stats?.[0]?.splits?.[0]?.stat?.plateAppearances ?? 0,
        }));
    } catch {
      return [];
    }
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

      if (homePitcherName && !homeFg) console.log("[fg-miss] home pitcher not found:", homePitcherName);
      if (awayPitcherName && !awayFg) console.log("[fg-miss] away pitcher not found:", awayPitcherName);

      // Fuzzy fallback: match by last name if exact match fails
      function fuzzyFgLookup(name: string | null): any {
        if (!name) return null;
        const exact = fgPitcherMap.get(name.toLowerCase());
        if (exact) return exact;
        const lastName = name.toLowerCase().split(" ").pop() ?? "";
        if (lastName.length < 3) return null;
        for (const [key, val] of fgPitcherMap) {
          if (key.endsWith(" " + lastName) || key === lastName) return val;
        }
        return null;
      }

      const homeFgResolved = homeFg ?? fuzzyFgLookup(homePitcherName);
      const awayFgResolved = awayFg ?? fuzzyFgLookup(awayPitcherName);

      if (homePitcherName && !homeFgResolved) console.log("[fg-still-miss] home:", homePitcherName);
      if (awayPitcherName && !awayFgResolved) console.log("[fg-still-miss] away:", awayPitcherName);

      const homePitcher = homePitcherName ? buildPitcherProjection(homePitcherName, homeTeam, homeFgResolved, mlbPitcherStatsMap.get(homePitcherName.toLowerCase()) ?? null) : null;
      const awayPitcher = awayPitcherName ? buildPitcherProjection(awayPitcherName, awayTeam, awayFgResolved, mlbPitcherStatsMap.get(awayPitcherName.toLowerCase()) ?? null) : null;

      // F5 win prob for home team
      const homeF5WinProb =
        homePitcher?.xfip != null && awayPitcher?.xfip != null
          ? Math.max(0.36, Math.min(0.64, 0.5 + (awayPitcher.xfip - homePitcher.xfip) * 0.06))
          : null;

      const homeLineupRaw: any[] = game.lineups?.homePlayers ?? [];
      const awayLineupRaw: any[] = game.lineups?.awayPlayers ?? [];
      const lineupsConfirmed = homeLineupRaw.length > 0 || awayLineupRaw.length > 0;

      // Fallback to roster if lineup not posted
      const homeTeamId: number = game.teams?.home?.team?.id ?? 0;
      const awayTeamId: number = game.teams?.away?.team?.id ?? 0;

      const [homeFallback, awayFallback] = lineupsConfirmed
        ? [[], []]
        : await Promise.all([
            homeLineupRaw.length === 0 && homeTeamId ? fetchTeamRoster(homeTeamId) : Promise.resolve([]),
            awayLineupRaw.length === 0 && awayTeamId ? fetchTeamRoster(awayTeamId) : Promise.resolve([]),
          ]);

      const effectiveHomeLineup = homeLineupRaw.length > 0 ? homeLineupRaw : homeFallback;
      const effectiveAwayLineup = awayLineupRaw.length > 0 ? awayLineupRaw : awayFallback;
      const hasLineups = effectiveHomeLineup.length > 0 || effectiveAwayLineup.length > 0;

      const homeLineup: BatterProjection[] = effectiveHomeLineup
        .filter((p: any) => (p?.fullName ?? p?.person?.fullName ?? ""))
        .map((p: any, i: number) => {
          const sv = savantBatterMap.get((p?.fullName ?? p?.person?.fullName ?? "").toLowerCase()) ?? null;
          return buildBatterProjection(p, homeTeam, i + 1, sv, awayPitcher?.hr9 ?? null);
        })
        .filter(b => b.name);

      const awayLineup: BatterProjection[] = effectiveAwayLineup
        .filter((p: any) => (p?.fullName ?? p?.person?.fullName ?? ""))
        .map((p: any, i: number) => {
          const sv = savantBatterMap.get((p?.fullName ?? p?.person?.fullName ?? "").toLowerCase()) ?? null;
          return buildBatterProjection(p, awayTeam, i + 1, sv, homePitcher?.hr9 ?? null);
        })
        .filter(b => b.name);

      // YRFI model: P(at least 1 run scored in 1st inning by either team)
      const top5HomeXwoba = homeLineup.slice(0, 5).map(b => b.xwoba).filter(x => x != null) as number[];
      const top5AwayXwoba = awayLineup.slice(0, 5).map(b => b.xwoba).filter(x => x != null) as number[];
      const avgHomeXwoba = top5HomeXwoba.length > 0 ? top5HomeXwoba.reduce((a, b) => a + b, 0) / top5HomeXwoba.length : 0.320;
      const avgAwayXwoba = top5AwayXwoba.length > 0 ? top5AwayXwoba.reduce((a, b) => a + b, 0) / top5AwayXwoba.length : 0.320;

      const pHomeScores1st = awayPitcher?.xfip != null
        ? Math.max(0.12, Math.min(0.58,
            0.265
            + (awayPitcher.xfip - LEAGUE_AVG_XFIP) * 0.035
            + (avgHomeXwoba - 0.320) * 0.18
            + ((awayPitcher.bbPct ?? 0.08) - 0.08) * 0.40
          ))
        : 0.28;

      const pAwayScores1st = homePitcher?.xfip != null
        ? Math.max(0.12, Math.min(0.58,
            0.265
            + (homePitcher.xfip - LEAGUE_AVG_XFIP) * 0.035
            + (avgAwayXwoba - 0.320) * 0.18
            + ((homePitcher.bbPct ?? 0.08) - 0.08) * 0.40
          ))
        : 0.28;

      const yrfiProb = (awayPitcher?.xfip != null || homePitcher?.xfip != null)
        ? Math.round((1 - (1 - pHomeScores1st) * (1 - pAwayScores1st)) * 1000) / 1000
        : null;

      const homeF1RunProb = pHomeScores1st;
      const awayF1RunProb = pAwayScores1st;

      // Lookup ESPN data for logos/records
      const espnKey = `${normalizeTeam(awayTeam)}|${normalizeTeam(homeTeam)}`;
      const espnData = espnGameMap.get(espnKey) ?? null;

      // Lookup consensus + signals
      const consensus = consensusMap.get(espnKey) ?? null;
      const gameSignals = signalsMap.get(espnKey) ?? [];

      // Find best edge signal
      const bestEdgeSignal = (() => {
        if (gameSignals.length === 0) return null;
        const best = gameSignals.reduce((a: any, b: any) =>
          Math.abs(b.edge_pct ?? 0) > Math.abs(a.edge_pct ?? 0) ? b : a
        );
        if (!best || (best.edge_pct ?? 0) === 0) return null;
        return {
          side: best.side,
          teamName: best.side === "home" ? homeTeam : awayTeam,
          edgePct: best.edge_pct,
          tier: best.edge_tier ?? best.tier ?? "no_edge",
        };
      })();

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
        yrfiProb,
        hasLineups,
        homeLogo: espnData?.homeLogo ?? null,
        awayLogo: espnData?.awayLogo ?? null,
        homeRecord: espnData?.homeRecord ?? null,
        awayRecord: espnData?.awayRecord ?? null,
        consensusHomeWinProb: consensus?.consensus_home_win_prob ?? null,
        consensusAwayWinProb: consensus?.consensus_away_win_prob ?? null,
        marketHomeWinProb: consensus?.market_implied_home_prob ?? null,
        marketAwayWinProb: consensus?.market_implied_away_prob ?? null,
        bestEdgeSignal,
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
