import * as https from "https";

const SOURCES = {
  oddsApi: process.env.ODDS_API_KEY,
  sportsDataIo: process.env.SPORTS_DATA_IO_KEY,
  kenpom: process.env.KENPOM_API_KEY,
  dunksAndThrees: process.env.DUNKS_AND_THREES_API_KEY,
};

function get(url: string, headers?: Record<string, string>): Promise<{ body: string; status: number }> {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
        ...headers,
      },
    };
    https.get(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ body: data, status: res.statusCode ?? 0 }));
    }).on("error", reject);
  });
}

async function validateOddsApi() {
  console.log("\n=== THE ODDS API ===");
  if (!SOURCES.oddsApi) { console.log("❌ ODDS_API_KEY missing"); return; }
  try {
    const { body } = await get(
      `https://api.the-odds-api.com/v4/sports/?apiKey=${SOURCES.oddsApi}`
    );
    const data = JSON.parse(body);
    const sports = data.map((s: any) => s.key);
    const hasNBA = sports.includes("basketball_nba");
    const hasCBB = sports.includes("basketball_ncaab");
    const hasMLB = sports.includes("baseball_mlb");
    console.log(`✅ Connected. ${data.length} sports available.`);
    console.log(`NBA: ${hasNBA ? "✅" : "❌ (may be off-season)"} | CBB: ${hasCBB ? "✅" : "❌ (may be off-season)"} | MLB: ${hasMLB ? "✅" : "❌"}`);

    // Validate NBA odds structure
    if (hasNBA) {
      const { body: nbaBody } = await get(
        `https://api.the-odds-api.com/v4/sports/basketball_nba/odds/?apiKey=${SOURCES.oddsApi}&regions=us&markets=h2h,spreads,totals`
      );
      const nbaGames = JSON.parse(nbaBody);
      if (nbaGames.length > 0) {
        const g = nbaGames[0];
        const books = g.bookmakers?.map((b: any) => b.key) ?? [];
        const hasDK = books.includes("draftkings");
        const hasFD = books.includes("fanduel");
        console.log(`NBA sample: ${g.away_team} @ ${g.home_team}`);
        console.log(`Books: DraftKings ${hasDK ? "✅" : "❌"} | FanDuel ${hasFD ? "✅" : "❌"}`);
        console.log(`Markets: ${g.bookmakers?.[0]?.markets?.map((m: any) => m.key).join(", ")}`);
      } else {
        console.log("NBA: No games with odds right now (check timing)");
      }
    }
  } catch (e) {
    console.log("❌ Failed:", e);
  }
}

async function validateSportsDataIo() {
  console.log("\n=== SPORTSDATAIO GOLF ===");
  if (!SOURCES.sportsDataIo) { console.log("❌ SPORTS_DATA_IO_KEY missing"); return; }
  try {
    const { body } = await get(
      `https://api.sportsdata.io/golf/v2/json/Tournaments/2026?key=${SOURCES.sportsDataIo}`
    );
    const data = JSON.parse(body);
    console.log(`✅ Connected. ${data.length} tournaments in 2026.`);

    // Find next upcoming tournament
    const now = new Date();
    const upcoming = data
      .filter((t: any) => new Date(t.StartDate) >= now)
      .sort((a: any, b: any) => new Date(a.StartDate).getTime() - new Date(b.StartDate).getTime());

    if (upcoming.length > 0) {
      const next = upcoming[0];
      console.log(`Next tournament: ${next.Name}`);
      console.log(`  Start: ${next.StartDate} | Venue: ${next.Venue ?? "TBD"} | Purse: $${next.Purse?.toLocaleString() ?? "TBD"}`);
      console.log(`  TournamentID: ${next.TournamentID}`);

      // Try to get leaderboard for this tournament
      const { body: lbBody, status } = await get(
        `https://api.sportsdata.io/golf/v2/json/Leaderboard/${next.TournamentID}?key=${SOURCES.sportsDataIo}`
      );
      if (status === 200) {
        const lb = JSON.parse(lbBody);
        const players = lb.Players ?? [];
        console.log(`  Leaderboard: ✅ ${players.length} players in field`);
        if (players.length > 0) {
          console.log(`  Sample player: ${players[0].Name} | World Rank: ${players[0].WorldGolfRank ?? "N/A"}`);
        }
      } else {
        console.log(`  Leaderboard: Not yet available (status ${status}) - tournament hasn't started`);
      }
    }

    // Validate player profiles endpoint
    const { body: profilesBody, status: profileStatus } = await get(
      `https://api.sportsdata.io/golf/v2/json/Players?key=${SOURCES.sportsDataIo}`
    );
    if (profileStatus === 200) {
      const players = JSON.parse(profilesBody);
      console.log(`Player profiles: ✅ ${players.length} players`);
    }
  } catch (e) {
    console.log("❌ Failed:", e);
  }
}

async function validateKenpom() {
  console.log("\n=== KENPOM ===");
  if (!SOURCES.kenpom) { console.log("❌ KENPOM_API_KEY missing"); return; }

  // Test 1: Teams endpoint
  try {
    const { body, status } = await get(
      `https://kenpom.com/api.php?endpoint=teams&y=2025`,
      { "Authorization": `Bearer ${SOURCES.kenpom}` }
    );
    if (status === 200) {
      const data = JSON.parse(body);
      const teams = Array.isArray(data) ? data : data.teams ?? [];
      console.log(`✅ Teams endpoint: ${teams.length} teams`);
      if (teams.length > 0) {
        console.log(`  Sample: ${teams[0].TeamName} | ID: ${teams[0].TeamID} | Conf: ${teams[0].ConfShort}`);
      }
    } else {
      console.log(`❌ Teams endpoint returned status ${status}: ${body.slice(0, 100)}`);
    }
  } catch (e) {
    console.log("❌ Teams endpoint failed:", e);
  }

  // Test 2: Ratings endpoint
  try {
    const { body, status } = await get(
      `https://kenpom.com/api.php?endpoint=ratings&y=2025`,
      { "Authorization": `Bearer ${SOURCES.kenpom}` }
    );
    if (status === 200) {
      const data = JSON.parse(body);
      const teams = Array.isArray(data) ? data : [];
      console.log(`✅ Ratings endpoint: ${teams.length} teams`);
      if (teams.length > 0) {
        const t = teams[0];
        console.log(`  Sample: ${t.TeamName} | AdjEM: ${t.AdjEM} | AdjOE: ${t.AdjOE} | AdjDE: ${t.AdjDE} | Tempo: ${t.AdjTempo}`);
      }
    } else {
      console.log(`❌ Ratings endpoint returned status ${status}: ${body.slice(0, 100)}`);
    }
  } catch (e) {
    console.log("❌ Ratings endpoint failed:", e);
  }

  // Test 3: Fanmatch endpoint (game predictions) - use a recent date
  try {
    const { body, status } = await get(
      `https://kenpom.com/api.php?endpoint=fanmatch&d=2025-03-15`,
      { "Authorization": `Bearer ${SOURCES.kenpom}` }
    );
    if (status === 200) {
      const data = JSON.parse(body);
      const games = Array.isArray(data) ? data : [];
      console.log(`✅ Fanmatch endpoint: ${games.length} games on 2025-03-15`);
      if (games.length > 0) {
        const g = games[0];
        console.log(`  Sample: ${g.Visitor} @ ${g.Home}`);
        console.log(`  Predicted: ${g.VisitorPred} - ${g.HomePred} | Home WP: ${g.HomeWP}`);
      }
    } else {
      console.log(`❌ Fanmatch endpoint returned status ${status}: ${body.slice(0, 100)}`);
    }
  } catch (e) {
    console.log("❌ Fanmatch endpoint failed:", e);
  }
}

async function validateDunksAndThrees() {
  console.log("\n=== DUNKS & THREES ===");
  if (!SOURCES.dunksAndThrees) { console.log("❌ DUNKS_AND_THREES_API_KEY missing"); return; }

  const headers = {
    "Authorization": SOURCES.dunksAndThrees!,
    "Accept": "application/json",
  };

  // Test 1: Game predictions
  try {
    const { body, status } = await get(
      `https://dunksandthrees.com/api/v1/game-predictions`,
      headers
    );
    if (status === 200) {
      const data = JSON.parse(body);
      const games = Array.isArray(data) ? data : [];
      console.log(`✅ Game predictions: ${games.length} games`);
      if (games.length > 0) {
        const g = games[0];
        console.log(`  Sample: ${g.away_team_name} @ ${g.home_team_name}`);
        console.log(`  Predicted: ${g.p_away_score} - ${g.p_home_score} | Home WP: ${g.win_prob}`);
      }
    } else {
      console.log(`❌ Game predictions returned status ${status}: ${body.slice(0, 150)}`);
    }
  } catch (e) {
    console.log("❌ Game predictions failed:", e);
  }

  // Test 2: Team EPM
  try {
    const { body, status } = await get(
      `https://dunksandthrees.com/api/v1/team-epm`,
      headers
    );
    if (status === 200) {
      const data = JSON.parse(body);
      const teams = Array.isArray(data) ? data : [];
      console.log(`✅ Team EPM: ${teams.length} teams`);
      if (teams.length > 0) {
        const t = teams[0];
        console.log(`  Sample: ${t.team_market} ${t.team_name} | EPM: ${t.team_epm_game_optimized} | Record: ${t.team_record}`);
      }
    } else {
      console.log(`❌ Team EPM returned status ${status}: ${body.slice(0, 150)}`);
    }
  } catch (e) {
    console.log("❌ Team EPM failed:", e);
  }

  // Test 3: Season EPM (player ratings)
  try {
    const { body, status } = await get(
      `https://dunksandthrees.com/api/v1/season-epm?season=2025`,
      headers
    );
    if (status === 200) {
      const data = JSON.parse(body);
      const players = Array.isArray(data) ? data : [];
      console.log(`✅ Season EPM: ${players.length} players`);
      if (players.length > 0) {
        const p = players[0];
        console.log(`  Sample: ${p.player_name} | ${p.team_alias} | EPM: ${p.tot} | MPG: ${p.mpg}`);
      }
    } else {
      console.log(`❌ Season EPM returned status ${status}: ${body.slice(0, 150)}`);
    }
  } catch (e) {
    console.log("❌ Season EPM failed:", e);
  }
}

async function validateEspn() {
  console.log("\n=== ESPN (NO KEY) ===");
  const sports = [
    { name: "NBA", url: "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard" },
    { name: "MLB", url: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard" },
    { name: "CBB", url: "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard" },
  ];
  for (const sport of sports) {
    try {
      const { body } = await get(sport.url);
      const data = JSON.parse(body);
      const games = data.events ?? [];
      console.log(`✅ ${sport.name}: ${games.length} games on today's scoreboard`);
      if (games.length > 0) {
        const g = games[0];
        console.log(`  Sample: ${g.name} | Status: ${g.status?.type?.description}`);
      }
    } catch (e) {
      console.log(`❌ ${sport.name} failed:`, e);
    }
  }
}

async function validateBaseballSavant() {
  console.log("\n=== BASEBALL SAVANT (NO KEY) ===");
  try {
    const { body } = await get(
      "https://baseballsavant.mlb.com/leaderboard/custom?year=2025&type=pitcher&filter=&min=q&selections=p_era,p_whip,p_k_percent,p_bb_percent,xera&chart=false&x=p_era&y=p_era&r=no&csv=true"
    );
    const rows = body.trim().split("\n");
    console.log(`✅ Pitcher leaderboard: ${rows.length - 1} qualified pitchers`);
    console.log(`  Headers: ${rows[0].slice(0, 120)}`);
    if (rows.length > 1) {
      console.log(`  Sample row: ${rows[1].slice(0, 120)}`);
    }

    // Also test schedule endpoint
    const { body: schedBody } = await get(
      "https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2025-04-15&hydrate=probablePitcher"
    );
    const schedData = JSON.parse(schedBody);
    const games = schedData.dates?.[0]?.games ?? [];
    console.log(`✅ MLB schedule API: ${games.length} games on 2025-04-15`);
    if (games.length > 0) {
      const g = games[0];
      const homePitcher = g.teams?.home?.probablePitcher?.fullName ?? "TBD";
      const awayPitcher = g.teams?.away?.probablePitcher?.fullName ?? "TBD";
      console.log(`  Sample: ${g.teams?.away?.team?.name} @ ${g.teams?.home?.team?.name}`);
      console.log(`  Starters: ${awayPitcher} vs ${homePitcher}`);
    }
  } catch (e) {
    console.log("❌ Failed:", e);
  }
}

async function main() {
  console.log("PLATFORM SOURCE VALIDATION v2");
  console.log("==============================");
  await validateOddsApi();
  await validateSportsDataIo();
  await validateKenpom();
  await validateDunksAndThrees();
  await validateEspn();
  await validateBaseballSavant();
  console.log("\n=== VALIDATION COMPLETE ===");
}

main();
