import { createServiceClient } from "@/lib/supabase/service";
import { recordSyncSuccess, recordSyncFailure } from "@/lib/platform/sourceRegistry";

// ─── NBA TEAM STATS ───────────────────────────────────────────────────────────

export async function ingestNbaTeamStats(season = "2024-25") {
  const supabase = createServiceClient();

  try {
    const res = await fetch(
      `https://stats.nba.com/stats/leaguedashteamstats?Conference=&DateFrom=&DateTo=&Division=&GameScope=&GameSegment=&LastNGames=0&LeagueID=00&Location=&MeasureType=Base&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlayerExperience=&PlayerPosition=&PlusMinus=N&Rank=N&Season=${season}&SeasonSegment=&SeasonType=Regular+Season&ShotClockRange=&StarterBench=&TeamID=0&TwoWay=0&VsConference=&VsDivision=`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Referer": "https://www.nba.com/",
          "Accept": "application/json",
        },
        next: { revalidate: 0 },
      }
    );

    if (!res.ok) throw new Error(`NBA Stats API failed: ${res.status}`);
    const data = await res.json();

    const headers: string[] = data.resultSets?.[0]?.headers ?? [];
    const rows: any[][] = data.resultSets?.[0]?.rowSet ?? [];

    if (headers.length === 0) throw new Error("No headers in NBA Stats response");

    let upserted = 0;

    for (const row of rows) {
      const stats: Record<string, any> = {};
      headers.forEach((h, i) => { stats[h] = row[i]; });

      const teamName = stats.TEAM_NAME;
      if (!teamName) continue;

      await supabase
        .from("team_stats_cache")
        .upsert(
          {
            sport_key: "nba",
            team_name: teamName,
            source_key: "espn_nba",
            season,
            stats: {
              gp: stats.GP,
              wins: stats.W,
              losses: stats.L,
              win_pct: stats.W_PCT,
              pts: stats.PTS,
              reb: stats.REB,
              ast: stats.AST,
              stl: stats.STL,
              blk: stats.BLK,
              tov: stats.TOV,
              fg_pct: stats.FG_PCT,
              fg3_pct: stats.FG3_PCT,
              ft_pct: stats.FT_PCT,
              plus_minus: stats.PLUS_MINUS,
              opp_pts: stats.OPP_PTS ?? null,
            },
            fetched_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "sport_key,team_name,source_key,season" }
        );

      upserted++;
    }

    await recordSyncSuccess("espn_nba");
    return { ok: true, teamsUpserted: upserted, season };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await recordSyncFailure("espn_nba", message);
    return { ok: false, error: message };
  }
}

// ─── MLB PITCHER STATS ────────────────────────────────────────────────────────

export async function ingestMlbPitcherStats(season = "2025") {
  const supabase = createServiceClient();

  try {
    const res = await fetch(
      `https://baseballsavant.mlb.com/leaderboard/custom?year=${season}&type=pitcher&filter=&min=10&selections=p_era,p_whip,xera,p_k_percent,p_bb_percent,p_game,p_formatted_ip&chart=false&x=p_era&y=p_era&r=no&csv=true`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 0 } }
    );

    if (!res.ok) throw new Error(`Baseball Savant fetch failed: ${res.status}`);
    const text = await res.text();
    const rows = text.trim().split("\n");

    if (rows.length < 2) throw new Error("No pitcher data returned");

    const headers = rows[0].replace(/"/g, "").split(",");
    let upserted = 0;

    for (let i = 1; i < rows.length; i++) {
      const values = rows[i].replace(/"/g, "").split(",");
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h.trim()] = values[idx]?.trim() ?? ""; });

      const lastName = row["last_name, first_name"]?.split(",")?.[0]?.trim();
      const firstName = row["last_name, first_name"]?.split(",")?.[1]?.trim();
      if (!lastName) continue;

      const playerName = `${firstName} ${lastName}`.trim();

      await supabase
        .from("pitcher_stats_cache")
        .upsert(
          {
            player_name: playerName,
            player_id: row["player_id"] ?? null,
            source_key: "baseball_savant",
            season,
            era: row["p_era"] ? parseFloat(row["p_era"]) : null,
            whip: row["p_whip"] ? parseFloat(row["p_whip"]) : null,
            xera: row["xera"] ? parseFloat(row["xera"]) : null,
            k_pct: row["p_k_percent"] ? parseFloat(row["p_k_percent"]) : null,
            bb_pct: row["p_bb_percent"] ? parseFloat(row["p_bb_percent"]) : null,
            games_started: row["p_game"] ? parseInt(row["p_game"]) : null,
            innings_pitched: row["p_formatted_ip"] ? parseFloat(row["p_formatted_ip"]) : null,
            fetched_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "player_name,source_key,season" }
        );

      upserted++;
    }

    await recordSyncSuccess("baseball_savant");
    return { ok: true, pitchersUpserted: upserted, season };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await recordSyncFailure("baseball_savant", message);
    return { ok: false, error: message };
  }
}

// ─── MLB PROBABLE STARTERS ────────────────────────────────────────────────────

export async function fetchMlbProbableStarters(date: string) {
  const supabase = createServiceClient();

  try {
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=probablePitcher`,
      { next: { revalidate: 0 } }
    );

    if (!res.ok) throw new Error(`MLB Stats API failed: ${res.status}`);
    const data = await res.json();

    const games = data.dates?.[0]?.games ?? [];
    const starters: Array<{
      gameId: number;
      homePitcher: string | null;
      awayPitcher: string | null;
      homePitcherConfirmed: boolean;
      awayPitcherConfirmed: boolean;
    }> = [];

    for (const game of games) {
      const homePitcher = game.teams?.home?.probablePitcher?.fullName ?? null;
      const awayPitcher = game.teams?.away?.probablePitcher?.fullName ?? null;

      starters.push({
        gameId: game.gamePk,
        homePitcher,
        awayPitcher,
        homePitcherConfirmed: !!homePitcher,
        awayPitcherConfirmed: !!awayPitcher,
      });
    }

    return { ok: true, starters, gamesFound: games.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { ok: false, error: message, starters: [] };
  }
}

// ─── ESPN TEAM STATS (CBB + MLB) ──────────────────────────────────────────────

export async function ingestEspnTeamStats(sport: "ncaab" | "mlb") {
  const supabase = createServiceClient();

  const espnSportPath =
    sport === "ncaab"
      ? "basketball/mens-college-basketball"
      : "baseball/mlb";

  const sourceKey = sport === "ncaab" ? "espn_ncaab" : "espn_mlb";
  const season = sport === "mlb" ? "2025" : "2025";

  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${espnSportPath}/teams?limit=100`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 0 } }
    );

    if (!res.ok) throw new Error(`ESPN teams fetch failed: ${res.status}`);
    const data = await res.json();

    const teams = data.sports?.[0]?.leagues?.[0]?.teams ?? [];
    let upserted = 0;

    for (const teamWrapper of teams) {
      const team = teamWrapper.team;
      if (!team?.displayName) continue;

      await supabase
        .from("team_stats_cache")
        .upsert(
          {
            sport_key: sport,
            team_name: team.displayName,
            source_key: sourceKey,
            season,
            stats: {
              espnId: team.id,
              abbreviation: team.abbreviation,
              location: team.location,
              record: team.record?.items?.[0]?.summary ?? null,
            },
            fetched_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "sport_key,team_name,source_key,season" }
        );

      upserted++;
    }

    await recordSyncSuccess(sourceKey);
    return { ok: true, teamsUpserted: upserted, sport };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await recordSyncFailure(sourceKey, message);
    return { ok: false, error: message };
  }
}

export async function ingestAllStats() {
  const today = new Date().toISOString().split("T")[0];
  const [nbaStats, mlbPitchers, mlbStarters, ncaabStats, mlbStats] = await Promise.all([
    ingestNbaTeamStats(),
    ingestMlbPitcherStats(),
    fetchMlbProbableStarters(today),
    ingestEspnTeamStats("ncaab"),
    ingestEspnTeamStats("mlb"),
  ]);

  return { nbaStats, mlbPitchers, mlbStarters, ncaabStats, mlbStats };
}
