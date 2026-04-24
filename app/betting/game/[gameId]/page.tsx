import { createServiceClient } from "@/lib/supabase/service";
import { getLogicalGameDate } from "@/lib/utils/dateUtils";
import Link from "next/link";

export const dynamic = "force-dynamic";

const BOOK_LABELS: Record<string, string> = {
  draftkings: "DraftKings",
  fanduel: "FanDuel",
  betmgm: "BetMGM",
  caesars: "Caesars",
  williamhill_us: "bet365",
  pointsbetus: "PointsBet",
  bet365: "bet365",
};

const TIER_CONFIG: Record<string, { color: string; label: string }> = {
  strong_value: { color: "#16A34A", label: "Strong value" },
  lean_value: { color: "#65A30D", label: "Lean value" },
  fair: { color: "#6B7280", label: "Fair" },
  lean_avoid: { color: "#D97706", label: "Lean avoid" },
  avoid: { color: "#DC2626", label: "Avoid" },
};

const MODEL_LABELS: Record<string, string> = {
  dunks_and_threes: "Dunks & Threes",
  kenpom: "KenPom",
  baseball_savant: "Market proxy",
  mlb_fangraphs_model: "FanGraphs",
  nhl_stats_api: "NHL Stats",
};

function fmtOdds(price: number | null): string {
  if (price === null || price === undefined) return "—";
  return price > 0 ? `+${price}` : `${price}`;
}

function fmtPct(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return `${Math.round(v * 100)}%`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
    }) + " ET";
  } catch { return "—"; }
}

export default async function GameDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ gameId: string }>;
  searchParams: Promise<{ sport?: string; date?: string }>;
}) {
  const { gameId } = await params;
  const sp = await searchParams;
  const sportKey = sp.sport ?? "nba";
  const today = getLogicalGameDate();
  const date = sp.date ?? today;

  // Fetch ESPN game data
  const sportPaths: Record<string, string> = {
    nba: "basketball/nba",
    mlb: "baseball/mlb",
    nhl: "hockey/nhl",
    ncaab: "basketball/mens-college-basketball",
  };
  const espnPath = sportPaths[sportKey] ?? "basketball/nba";
  const dateStr = date.replace(/-/g, "");

  let espnGame: any = null;
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${espnPath}/scoreboard?dates=${dateStr}`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const data = await res.json();
      espnGame = (data.events ?? []).find((e: any) => e.id === gameId) ?? null;
    }
  } catch {}

  const competition = espnGame?.competitions?.[0];
  const homeComp = competition?.competitors?.find((c: any) => c.homeAway === "home");
  const awayComp = competition?.competitors?.find((c: any) => c.homeAway === "away");
  const homeName = homeComp?.team?.displayName ?? "";
  const awayName = awayComp?.team?.displayName ?? "";
  const isLive = espnGame?.status?.type?.state === "in";
  const isFinal = espnGame?.status?.type?.state === "post";
  const statusDetail = espnGame?.status?.type?.shortDetail ?? "";
  const homeLogo: string | null = homeComp?.team?.logo ?? null;
  const awayLogo: string | null = awayComp?.team?.logo ?? null;
  const homeScore = (isLive || isFinal) ? homeComp?.score ?? null : null;
  const awayScore = (isLive || isFinal) ? awayComp?.score ?? null : null;
  const homeRecord = homeComp?.records?.[0]?.summary ?? null;
  const awayRecord = awayComp?.records?.[0]?.summary ?? null;

  function normalizeTeam(name: string) {
    return name.toLowerCase().trim().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ");
  }
  const gameKey = `${normalizeTeam(awayName)}|${normalizeTeam(homeName)}`;

  const supabase = createServiceClient();
  const isHistorical = date < today;

  const etStart = new Date(`${date}T04:00:00Z`);
  const etEnd = new Date(`${date}T04:00:00Z`);
  etEnd.setDate(etEnd.getDate() + 1);

  let oddsQuery = supabase
    .from("market_odds")
    .select("*")
    .gte("commence_time", etStart.toISOString())
    .lt("commence_time", etEnd.toISOString())
    .eq("sport_key", sportKey);
  if (isHistorical) oddsQuery = oddsQuery.eq("closing_line", true);

  const [{ data: allOdds }, { data: consensusData }, { data: signalsData }] = await Promise.all([
    oddsQuery,
    supabase.from("consensus").select("*").eq("game_date", date).eq("sport_key", sportKey),
    supabase.from("signals").select("*").eq("game_date", date).eq("sport_key", sportKey).eq("suppressed", false),
  ]);

  // Match by team name
  const gameOdds = (allOdds ?? []).filter((o: any) => {
    const k = `${normalizeTeam(o.away_team)}|${normalizeTeam(o.home_team)}`;
    return k === gameKey;
  });
  const consensus = (consensusData ?? []).find((c: any) => {
    const k = `${normalizeTeam(c.away_team)}|${normalizeTeam(c.home_team)}`;
    return k === gameKey;
  }) ?? null;
  const signals = (signalsData ?? []).filter((s: any) => {
    const k = `${normalizeTeam(s.away_team)}|${normalizeTeam(s.home_team)}`;
    return k === gameKey;
  });

  // Best moneyline per bookmaker
  const h2hByBook = new Map<string, any>();
  for (const o of gameOdds.filter((o: any) => o.market_type === "h2h")) {
    h2hByBook.set(o.bookmaker, o);
  }
  const h2hRows = [...h2hByBook.values()].sort((a, b) => {
    const pa = Math.max(a.home_price ?? -9999, a.away_price ?? -9999);
    const pb = Math.max(b.home_price ?? -9999, b.away_price ?? -9999);
    return pb - pa;
  });

  const totalsRows = (() => {
    const byBook = new Map<string, any>();
    for (const o of gameOdds.filter((o: any) => o.market_type === "totals")) {
      byBook.set(o.bookmaker, o);
    }
    return [...byBook.values()];
  })();

  const spreadsRows = (() => {
    const byBook = new Map<string, any>();
    for (const o of gameOdds.filter((o: any) => o.market_type === "spreads")) {
      byBook.set(o.bookmaker, o);
    }
    return [...byBook.values()];
  })();

  // Fetch ESPN summary + MLB starters in parallel
  const [summaryRaw, startersRaw] = await Promise.all([
    fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${espnPath}/summary?event=${gameId}`,
      { cache: "no-store" }
    ).then(r => r.ok ? r.json() : null).catch(() => null),
    sportKey === "mlb"
      ? fetch(
          `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=probablePitcher`,
          { cache: "no-store" }
        ).then(x => x.json()).catch(() => ({ dates: [] }))
      : Promise.resolve({ dates: [] }),
  ]);

  // MLB starters
  const mlbStarters: Record<string, { pitcher: string; confirmed: boolean }> = {};
  for (const de of startersRaw?.dates ?? []) {
    for (const g of de.games ?? []) {
      const hn = g.teams?.home?.team?.name;
      const an = g.teams?.away?.team?.name;
      const hp = g.teams?.home?.probablePitcher?.fullName ?? null;
      const ap = g.teams?.away?.probablePitcher?.fullName ?? null;
      if (hn) mlbStarters[hn] = { pitcher: hp ?? "TBD", confirmed: !!hp };
      if (an) mlbStarters[an] = { pitcher: ap ?? "TBD", confirmed: !!ap };
    }
  }
  const homePitcher = mlbStarters[homeName];
  const awayPitcher = mlbStarters[awayName];

  // ESPN Summary data
  type InjuryEntry = { teamName: string; playerName: string; status: string; description: string };
  const summaryInjuries: InjuryEntry[] = [];
  let pickcenter: { spread: number | null; overUnder: number | null; awayMoneyLine: number | null; homeMoneyLine: number | null } | null = null;
  let articleHeadline: string | null = null;
  const newsItems: Array<{ headline: string }> = [];
  let liveHomeWinPct: number | null = null;
  type BoxTeam = { teamName: string; homeAway: string; stats: Array<{ name: string; value: string }> };
  const boxscoreTeams: BoxTeam[] = [];

  if (summaryRaw) {
    // Injuries
    for (const teamInj of summaryRaw.injuries ?? []) {
      const teamName: string = teamInj.team?.displayName ?? "";
      for (const inj of teamInj.injuries ?? []) {
        const playerName: string = inj.athlete?.displayName ?? "";
        const status: string = inj.status ?? "";
        const description: string = inj.type?.description ?? status;
        if (playerName) summaryInjuries.push({ teamName, playerName, status, description });
      }
    }

    // Pickcenter (consensus line from ESPN)
    const pc = summaryRaw.pickcenter?.[0];
    if (pc) {
      pickcenter = {
        spread: pc.spread ?? null,
        overUnder: pc.overUnder ?? null,
        awayMoneyLine: pc.awayTeamOdds?.moneyLine ?? null,
        homeMoneyLine: pc.homeTeamOdds?.moneyLine ?? null,
      };
    }

    // Article headline for final games
    if (summaryRaw.article?.headline) articleHeadline = summaryRaw.article.headline;

    // News (up to 3)
    for (const n of (summaryRaw.news ?? []).slice(0, 3)) {
      if (n.headline) newsItems.push({ headline: n.headline });
    }

    // Live win probability
    const wp: any[] = summaryRaw.winprobability ?? [];
    if (wp.length > 0) liveHomeWinPct = wp[wp.length - 1]?.homeWinPercentage ?? null;

    // Boxscore (final games)
    if (isFinal) {
      for (const team of summaryRaw.boxscore?.teams ?? []) {
        const teamName: string = team.team?.displayName ?? "";
        const homeAway: string = team.homeAway ?? "";
        const stats: Array<{ name: string; value: string }> = [];
        for (const stat of team.statistics ?? []) {
          const val: string = stat.displayValue ?? "";
          if (val && val !== "0" && val !== "-" && val !== "--") {
            stats.push({ name: stat.label ?? stat.name ?? "", value: val });
          }
        }
        if (stats.length > 0) boxscoreTeams.push({ teamName, homeAway, stats });
      }
    }
  }

  const homeWon = isFinal && homeScore !== null && awayScore !== null && Number(homeScore) > Number(awayScore);
  const awayWon = isFinal && homeScore !== null && awayScore !== null && Number(awayScore) > Number(homeScore);

  const homeSignal = signals.find((s: any) => s.side === "home") ?? null;
  const awaySignal = signals.find((s: any) => s.side === "away") ?? null;

  return (
    <div style={{
      maxWidth: "680px",
      margin: "0 auto",
      padding: "clamp(12px, 4vw, 32px)",
      fontSize: "14px",
      color: "#F1F3F5",
      background: "#0D1117",
      minHeight: "100vh",
    }}>
      {/* Back nav */}
      <div style={{ marginBottom: "16px" }}>
        <Link href={`/betting?sport=${sportKey}&date=${date}`} style={{
          fontSize: "13px", color: "#6B7280", textDecoration: "none",
        }}>← Back</Link>
      </div>

      {/* Game header */}
      <div style={{
        background: "#161B22",
        border: "1px solid #21262D",
        borderRadius: "12px",
        padding: "16px",
        marginBottom: "16px",
      }}>
        {/* Status */}
        <div style={{ textAlign: "center", marginBottom: "12px" }}>
          {isFinal ? (
            <span style={{ fontSize: "11px", color: "#6B7280" }}>Final</span>
          ) : isLive ? (
            <span style={{ fontSize: "11px", color: "#EA6C0A", fontWeight: 600 }}>{statusDetail}</span>
          ) : (
            <span style={{ fontSize: "11px", color: "#6B7280" }}>{formatTime(competition?.date ?? null)}</span>
          )}
        </div>

        {/* Teams */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {/* Away */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", flex: 1 }}>
            {awayLogo && <img src={awayLogo} alt={awayName} width={40} height={40} style={{ objectFit: "contain" }} />}
            <span style={{ fontSize: "13px", fontWeight: 600, color: awayWon ? "#F1F3F5" : "#94A3B8", textAlign: "center" }}>{awayName}</span>
            {awayRecord && <span style={{ fontSize: "10px", color: "#4B5563" }}>{awayRecord}</span>}
          </div>

          {/* Score / vs */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", padding: "0 12px" }}>
            {(isLive || isFinal) && awayScore !== null && homeScore !== null ? (
              <>
                <span style={{ fontSize: "28px", fontWeight: 700, color: "#F1F3F5", letterSpacing: "0.05em" }}>
                  {awayScore} – {homeScore}
                </span>
              </>
            ) : (
              <span style={{ fontSize: "18px", color: "#4B5563", fontWeight: 400 }}>vs</span>
            )}
          </div>

          {/* Home */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", flex: 1 }}>
            {homeLogo && <img src={homeLogo} alt={homeName} width={40} height={40} style={{ objectFit: "contain" }} />}
            <span style={{ fontSize: "13px", fontWeight: 600, color: homeWon ? "#F1F3F5" : "#94A3B8", textAlign: "center" }}>{homeName}</span>
            {homeRecord && <span style={{ fontSize: "10px", color: "#4B5563" }}>{homeRecord}</span>}
          </div>
        </div>

        {/* MLB pitchers */}
        {sportKey === "mlb" && (awayPitcher || homePitcher) && (
          <div style={{ textAlign: "center", marginTop: "12px", fontSize: "12px", color: "#6B7280" }}>
            <span style={{ color: awayPitcher?.confirmed ? "#9CA3AF" : "#D97706" }}>{awayPitcher?.pitcher ?? "TBD"}</span>
            <span style={{ color: "#4B5563" }}> vs </span>
            <span style={{ color: homePitcher?.confirmed ? "#9CA3AF" : "#D97706" }}>{homePitcher?.pitcher ?? "TBD"}</span>
          </div>
        )}

        {/* Pickcenter consensus line (pre-game) */}
        {!isFinal && pickcenter && (pickcenter.spread !== null || pickcenter.overUnder !== null) && (
          <div style={{ display: "flex", justifyContent: "center", gap: "16px", marginTop: "12px", paddingTop: "10px", borderTop: "0.5px solid #21262D" }}>
            {pickcenter.spread !== null && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "10px", color: "#4B5563", marginBottom: "2px" }}>Spread</div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#F1F3F5" }}>
                  {pickcenter.spread > 0 ? `+${pickcenter.spread}` : pickcenter.spread}
                </div>
              </div>
            )}
            {pickcenter.overUnder !== null && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "10px", color: "#4B5563", marginBottom: "2px" }}>O/U</div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#F1F3F5" }}>{pickcenter.overUnder}</div>
              </div>
            )}
            {pickcenter.awayMoneyLine !== null && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "10px", color: "#4B5563", marginBottom: "2px" }}>{awayName.split(" ").pop()} ML</div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#F1F3F5" }}>{fmtOdds(pickcenter.awayMoneyLine)}</div>
              </div>
            )}
            {pickcenter.homeMoneyLine !== null && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "10px", color: "#4B5563", marginBottom: "2px" }}>{homeName.split(" ").pop()} ML</div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#F1F3F5" }}>{fmtOdds(pickcenter.homeMoneyLine)}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Model edge section */}
      {consensus && (
        <div style={{
          background: "#161B22",
          border: "1px solid #21262D",
          borderRadius: "12px",
          padding: "16px",
          marginBottom: "16px",
        }}>
          <div style={{ fontSize: "11px", color: "#EA6C0A", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>
            Model Edge · {MODEL_LABELS[consensus.model_source] ?? consensus.model_source}
          </div>

          {/* Win probabilities */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            {[
              { team: awayName, prob: consensus.consensus_away_win_prob, signal: awaySignal },
              { team: homeName, prob: consensus.consensus_home_win_prob, signal: homeSignal },
            ].map(({ team, prob, signal }) => (
              <div key={team} style={{
                flex: 1,
                background: "#0D1117",
                borderRadius: "8px",
                padding: "10px",
                border: signal ? `1px solid ${TIER_CONFIG[signal.tier]?.color ?? "#21262D"}40` : "1px solid #21262D",
              }}>
                <div style={{ fontSize: "11px", color: "#6B7280", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {team.split(" ").pop()}
                </div>
                <div style={{ fontSize: "20px", fontWeight: 700, color: "#F1F3F5" }}>{fmtPct(prob)}</div>
                {signal && (
                  <>
                    <div style={{ fontSize: "12px", color: TIER_CONFIG[signal.tier]?.color ?? "#6B7280", fontWeight: 600, marginTop: "4px" }}>
                      {signal.edge_pct > 0 ? "+" : ""}{signal.edge_pct}% edge
                    </div>
                    <div style={{ fontSize: "10px", color: "#6B7280", marginTop: "2px" }}>
                      {TIER_CONFIG[signal.tier]?.label}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Market vs model comparison */}
          <div style={{ display: "flex", gap: "8px" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "10px", color: "#4B5563", marginBottom: "2px" }}>Market implied</div>
              <div style={{ fontSize: "12px", color: "#6B7280" }}>
                {awayName.split(" ").pop()} {fmtPct(consensus.market_implied_away_prob)} / {homeName.split(" ").pop()} {fmtPct(consensus.market_implied_home_prob)}
              </div>
            </div>
            <div style={{ flex: 1, textAlign: "right" }}>
              <div style={{ fontSize: "10px", color: "#4B5563", marginBottom: "2px" }}>Confidence</div>
              <div style={{ fontSize: "12px", color: consensus.confidence_tier === "high" ? "#65A30D" : "#6B7280" }}>
                {consensus.confidence_tier === "high" ? "High" : consensus.confidence_tier === "market_only" ? "Market only" : "Low"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Moneyline odds */}
      {h2hRows.length > 0 && (
        <div style={{
          background: "#161B22",
          border: "1px solid #21262D",
          borderRadius: "12px",
          padding: "16px",
          marginBottom: "16px",
        }}>
          <div style={{ fontSize: "11px", color: "#EA6C0A", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>
            Moneyline
          </div>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px", gap: "8px", marginBottom: "6px" }}>
            <span style={{ fontSize: "10px", color: "#4B5563" }}>Book</span>
            <span style={{ fontSize: "10px", color: "#4B5563", textAlign: "center" }}>{awayName.split(" ").pop()}</span>
            <span style={{ fontSize: "10px", color: "#4B5563", textAlign: "center" }}>{homeName.split(" ").pop()}</span>
          </div>
          {h2hRows.map((row: any) => (
            <div key={row.bookmaker} style={{
              display: "grid",
              gridTemplateColumns: "1fr 80px 80px",
              gap: "8px",
              padding: "6px 0",
              borderTop: "0.5px solid #21262D",
            }}>
              <span style={{ fontSize: "12px", color: "#6B7280" }}>{BOOK_LABELS[row.bookmaker] ?? row.bookmaker}</span>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#F1F3F5", textAlign: "center" }}>{fmtOdds(row.away_price)}</span>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#F1F3F5", textAlign: "center" }}>{fmtOdds(row.home_price)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Spreads */}
      {spreadsRows.length > 0 && (
        <div style={{
          background: "#161B22",
          border: "1px solid #21262D",
          borderRadius: "12px",
          padding: "16px",
          marginBottom: "16px",
        }}>
          <div style={{ fontSize: "11px", color: "#EA6C0A", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>
            Spread
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px", gap: "8px", marginBottom: "6px" }}>
            <span style={{ fontSize: "10px", color: "#4B5563" }}>Book</span>
            <span style={{ fontSize: "10px", color: "#4B5563", textAlign: "center" }}>{awayName.split(" ").pop()}</span>
            <span style={{ fontSize: "10px", color: "#4B5563", textAlign: "center" }}>{homeName.split(" ").pop()}</span>
          </div>
          {spreadsRows.map((row: any) => (
            <div key={row.bookmaker} style={{
              display: "grid",
              gridTemplateColumns: "1fr 90px 90px",
              gap: "8px",
              padding: "6px 0",
              borderTop: "0.5px solid #21262D",
            }}>
              <span style={{ fontSize: "12px", color: "#6B7280" }}>{BOOK_LABELS[row.bookmaker] ?? row.bookmaker}</span>
              <span style={{ fontSize: "12px", color: "#F1F3F5", textAlign: "center" }}>
                {row.away_spread != null ? (row.away_spread > 0 ? `+${row.away_spread}` : row.away_spread) : "—"}
                {row.away_price != null && <span style={{ color: "#6B7280", fontSize: "10px" }}> ({fmtOdds(row.away_price)})</span>}
              </span>
              <span style={{ fontSize: "12px", color: "#F1F3F5", textAlign: "center" }}>
                {row.home_spread != null ? (row.home_spread > 0 ? `+${row.home_spread}` : row.home_spread) : "—"}
                {row.home_price != null && <span style={{ color: "#6B7280", fontSize: "10px" }}> ({fmtOdds(row.home_price)})</span>}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Totals */}
      {totalsRows.length > 0 && (
        <div style={{
          background: "#161B22",
          border: "1px solid #21262D",
          borderRadius: "12px",
          padding: "16px",
          marginBottom: "16px",
        }}>
          <div style={{ fontSize: "11px", color: "#EA6C0A", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>
            Total (O/U)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 80px 80px", gap: "8px", marginBottom: "6px" }}>
            <span style={{ fontSize: "10px", color: "#4B5563" }}>Book</span>
            <span style={{ fontSize: "10px", color: "#4B5563", textAlign: "center" }}>Line</span>
            <span style={{ fontSize: "10px", color: "#4B5563", textAlign: "center" }}>Over</span>
            <span style={{ fontSize: "10px", color: "#4B5563", textAlign: "center" }}>Under</span>
          </div>
          {totalsRows.map((row: any) => (
            <div key={row.bookmaker} style={{
              display: "grid",
              gridTemplateColumns: "1fr 60px 80px 80px",
              gap: "8px",
              padding: "6px 0",
              borderTop: "0.5px solid #21262D",
            }}>
              <span style={{ fontSize: "12px", color: "#6B7280" }}>{BOOK_LABELS[row.bookmaker] ?? row.bookmaker}</span>
              <span style={{ fontSize: "12px", color: "#EA6C0A", fontWeight: 600, textAlign: "center" }}>{row.line_value ?? "—"}</span>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#F1F3F5", textAlign: "center" }}>{fmtOdds(row.over_price)}</span>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#F1F3F5", textAlign: "center" }}>{fmtOdds(row.under_price)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Injury Report (pre-game only) */}
      {!isFinal && summaryInjuries.length > 0 && (
        <div style={{
          background: "#161B22",
          border: "1px solid #21262D",
          borderRadius: "12px",
          padding: "16px",
          marginBottom: "16px",
        }}>
          <div style={{ fontSize: "11px", color: "#EA6C0A", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>
            Injury Report
          </div>
          {summaryInjuries.map((inj, i) => {
            const isOut = /out|il|injured list/i.test(inj.status);
            const isDTD = /dtd|day-to-day/i.test(inj.status);
            const badgeColor = isOut ? "#DC2626" : isDTD ? "#D97706" : "#6B7280";
            return (
              <div key={i} style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "5px 0",
                borderTop: i > 0 ? "0.5px solid #1E2433" : "none",
              }}>
                <span style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  color: badgeColor,
                  background: `${badgeColor}18`,
                  padding: "2px 6px",
                  borderRadius: "4px",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}>{inj.status}</span>
                <span style={{ fontSize: "12px", color: "#F1F3F5", fontWeight: 500 }}>{inj.playerName}</span>
                <span style={{ fontSize: "11px", color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {inj.teamName.split(" ").pop()} · {inj.description}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Game Notes (pre-game) */}
      {!isFinal && (newsItems.length > 0 || articleHeadline) && (
        <div style={{
          background: "#161B22",
          border: "1px solid #21262D",
          borderRadius: "12px",
          padding: "16px",
          marginBottom: "16px",
        }}>
          <div style={{ fontSize: "11px", color: "#EA6C0A", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>
            Game Notes
          </div>
          {articleHeadline && (
            <div style={{ fontSize: "13px", color: "#F1F3F5", marginBottom: newsItems.length > 0 ? "10px" : 0, fontWeight: 500 }}>
              {articleHeadline}
            </div>
          )}
          {newsItems.map((n, i) => (
            <div key={i} style={{
              display: "flex",
              gap: "8px",
              padding: "5px 0",
              borderTop: i > 0 || articleHeadline ? "0.5px solid #1E2433" : "none",
            }}>
              <span style={{ fontSize: "11px", color: "#4B5563", flexShrink: 0, paddingTop: "1px" }}>•</span>
              <span style={{ fontSize: "12px", color: "#94A3B8" }}>{n.headline}</span>
            </div>
          ))}
        </div>
      )}

      {/* Box Score (final games only) */}
      {isFinal && boxscoreTeams.length > 0 && (
        <div style={{
          background: "#161B22",
          border: "1px solid #21262D",
          borderRadius: "12px",
          padding: "16px",
          marginBottom: "16px",
        }}>
          <div style={{ fontSize: "11px", color: "#EA6C0A", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>
            Final Stats
          </div>
          {boxscoreTeams.map((team, ti) => (
            <div key={ti} style={{ marginBottom: ti < boxscoreTeams.length - 1 ? "12px" : 0 }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "#9CA3AF", marginBottom: "6px" }}>{team.teamName}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {team.stats.slice(0, 8).map((stat, si) => (
                  <div key={si} style={{
                    background: "#0D1117",
                    borderRadius: "6px",
                    padding: "4px 8px",
                    minWidth: "52px",
                    textAlign: "center",
                  }}>
                    <div style={{ fontSize: "10px", color: "#4B5563", marginBottom: "1px" }}>{stat.name}</div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#F1F3F5" }}>{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Article headline for final games */}
      {isFinal && articleHeadline && (
        <div style={{
          background: "#161B22",
          border: "1px solid #21262D",
          borderRadius: "12px",
          padding: "16px",
          marginBottom: "16px",
        }}>
          <div style={{ fontSize: "11px", color: "#EA6C0A", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
            Recap
          </div>
          <div style={{ fontSize: "13px", color: "#F1F3F5", fontWeight: 500 }}>{articleHeadline}</div>
        </div>
      )}

      {/* No data fallback */}
      {!espnGame && !consensus && gameOdds.length === 0 && (
        <div style={{ textAlign: "center", color: "#4B5563", padding: "40px 0" }}>
          Game data not found
        </div>
      )}
    </div>
  );
}
