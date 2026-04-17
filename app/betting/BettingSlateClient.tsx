"use client";

import { useState, useMemo } from "react";
import AuthButton from "@/app/components/AuthButton";
import GolfTournamentCard from "./GolfTournamentCard";

const SPORT_LABELS: Record<string, string> = {
  nba: "NBA",
  mlb: "MLB",
  ncaab: "CBB",
  pga: "Golf",
};

const BOOKS_PRIORITY = [
  "draftkings",
  "fanduel",
  "betmgm",
  "caesars",
  "williamhill_us",
  "pointsbetus",
  "bet365",
];

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
  fair: { color: "var(--color-text-secondary)", label: "Fair" },
  lean_avoid: { color: "#D97706", label: "Lean avoid" },
  avoid: { color: "#DC2626", label: "Avoid" },
};

const MODEL_LABELS: Record<string, string> = {
  dunks_and_threes: "Dunks & Threes",
  kenpom: "KenPom",
  baseball_savant: "Market proxy",
};

interface Props {
  date: string;
  sport: string;
  odds: any[];
  signals: any[] | null;
  consensus: any[];
  mlbStartersByTeam: Record<string, { pitcher: string; confirmed: boolean }>;
  golfLeaderboard: any[];
  golfTournamentName: string;
  golfRoundStatus: string;
  teamLogos: any[];
  user: { id: string; email?: string } | null;
}

export default function BettingSlateClient({
  date, sport, odds, signals, consensus, mlbStartersByTeam, golfLeaderboard, golfTournamentName, golfRoundStatus, teamLogos, user,
}: Props) {
  const [activeSport, setActiveSport] = useState(sport);
  const [activeMarket, setActiveMarket] = useState("h2h");
  const [expandedGame, setExpandedGame] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const prev = new Date(new Date(date + "T12:00:00").getTime() - 86400000).toISOString().split("T")[0];
  const next = new Date(new Date(date + "T12:00:00").getTime() + 86400000).toISOString().split("T")[0];

  function formatDate(d: string) {
    if (d === today) return "Today";
    return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric",
    });
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
    }) + " ET";
  }

  function fmtOdds(price: number | null) {
    if (price === null || price === undefined) return "—";
    return price > 0 ? `+${price}` : `${price}`;
  }

  const games = useMemo(() => {
    const map = new Map<string, any>();
    for (const odd of odds) {
      if (!map.has(odd.external_game_id)) {
        map.set(odd.external_game_id, {
          id: odd.external_game_id,
          sportKey: odd.sport_key,
          homeTeam: odd.home_team,
          awayTeam: odd.away_team,
          commenceTime: odd.commence_time,
          odds: [],
          signals: [],
          consensus: null,
        });
      }
      map.get(odd.external_game_id).odds.push(odd);
    }
    for (const s of signals ?? []) {
      if (map.has(s.external_game_id)) {
        map.get(s.external_game_id).signals.push(s);
      }
    }
    for (const c of consensus) {
      if (map.has(c.external_game_id)) {
        map.get(c.external_game_id).consensus = c;
      }
    }
    return Array.from(map.values())
      .filter(g => activeSport === "all" || g.sportKey === activeSport)
      .sort((a, b) => new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime());
  }, [odds, signals, consensus, activeSport]);

  const bySport = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const g of games) {
      if (!groups[g.sportKey]) groups[g.sportKey] = [];
      groups[g.sportKey].push(g);
    }
    return groups;
  }, [games]);

  function getBookOdds(game: any, bookmaker: string) {
    return game.odds.find((o: any) => o.bookmaker === bookmaker && o.market_type === activeMarket);
  }

  function getRivers(game: any) {
    return game.odds.find((o: any) =>
      (o.bookmaker === "betrivers" || o.bookmaker === "rivers") &&
      o.market_type === activeMarket
    );
  }

  function getBest(game: any, side: "home" | "away" | "over" | "under") {
    const relevant = game.odds.filter((o: any) => o.market_type === activeMarket);
    let best: { price: number; bookmaker: string } | null = null;
    for (const o of relevant) {
      const price = side === "home" ? o.home_price
        : side === "away" ? o.away_price
        : side === "over" ? o.over_price
        : o.under_price;
      if (price === null || price === undefined) continue;
      if (!best || price > best.price) best = { price, bookmaker: o.bookmaker };
    }
    return best;
  }

  function getSignal(game: any, side: "home" | "away") {
    return game.signals.find((s: any) => s.signal_type === "h2h" && s.side === side);
  }

  function getTopSignal(game: any) {
    const h = getSignal(game, "home");
    const a = getSignal(game, "away");
    if (!h && !a) return null;
    if (!h) return a;
    if (!a) return h;
    return Math.abs(h.edge_pct) >= Math.abs(a.edge_pct) ? h : a;
  }

  function getMlbStarters(game: any) {
    if (game.sportKey !== "mlb") return null;
    const home = mlbStartersByTeam[game.homeTeam];
    const away = mlbStartersByTeam[game.awayTeam];
    if (!home && !away) return null;
    return {
      homePitcher: home?.pitcher ?? "TBD",
      awayPitcher: away?.pitcher ?? "TBD",
      homePitcherConfirmed: home?.confirmed ?? false,
      awayPitcherConfirmed: away?.confirmed ?? false,
    };
  }

  function getTeamLogo(teamName: string, sportKey: string): string | null {
    const team = teamLogos.find((t: any) => t.canonical_name === teamName);
    if (!team?.abbreviation) return null;
    const a = (team.abbreviation as string).toLowerCase();
    if (sportKey === "nba") return `https://a.espncdn.com/i/teamlogos/nba/500/${a}.png`;
    if (sportKey === "mlb") return `https://a.espncdn.com/i/teamlogos/mlb/500/${a}.png`;
    if (sportKey === "ncaab") return `https://a.espncdn.com/i/teamlogos/ncaa/500/${a}.png`;
    return null;
  }

  const navLink = (href: string, label: string, active: boolean) => (
    <a href={href} style={{
      fontSize: "13px",
      color: active ? "#EA6C0A" : "var(--color-text-secondary)",
      fontWeight: active ? 500 : 400,
      textDecoration: "none",
    }}>{label}</a>
  );

  const pill = (label: string, active: boolean, onClick: () => void) => (
    <button onClick={onClick} style={{
      border: `0.5px solid ${active ? "#EA6C0A80" : "var(--color-border-secondary)"}`,
      borderRadius: "5px",
      padding: "3px 11px",
      fontSize: "12px",
      cursor: "pointer",
      background: active ? "#EA6C0A12" : "transparent",
      color: active ? "#EA6C0A" : "var(--color-text-secondary)",
    }}>{label}</button>
  );

  const gridCols = "minmax(160px, 1.8fr) 65px 120px 90px 90px 90px 90px 120px 80px";

  return (
    <div style={{
      width: "100%",
      maxWidth: "1200px",
      margin: "0 auto",
      padding: "20px 24px",
      fontSize: "14px",
      color: "#F1F3F5",
      background: "#0D1117",
      minHeight: "100vh",
    }}>

      {/* Nav */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingBottom: "14px", borderBottom: "0.5px solid #1E2433", marginBottom: "16px",
        background: "#0D1117",
      }}>
        <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
          <img
            src="/logo-icon.png"
            alt="EdgePulse"
            height={36}
            width={36}
            style={{ display: "block", objectFit: "contain" }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <span style={{
            fontSize: "17px",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            marginLeft: "10px",
            fontFamily: "Inter, ui-sans-serif, sans-serif",
          }}>
            <span style={{ color: "#EA6C0A" }}>Edge</span>
            <span className="logo-pulse">Pulse</span>
          </span>
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          {navLink("/betting", "Betting", true)}
          {navLink("/fantasy", "Fantasy", false)}
          {user && navLink("/my-bets", "My Bets", false)}
          <AuthButton />
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "14px", flexWrap: "wrap", background: "#0D1117" }}>
        {pill("All", activeSport === "all", () => setActiveSport("all"))}
        {pill("NBA", activeSport === "nba", () => setActiveSport("nba"))}
        {pill("MLB", activeSport === "mlb", () => setActiveSport("mlb"))}
        {pill("CBB", activeSport === "ncaab", () => setActiveSport("ncaab"))}
        <div style={{ width: "1px", height: "16px", background: "var(--color-border-tertiary)", margin: "0 2px" }} />
        {pill("Moneyline", activeMarket === "h2h", () => setActiveMarket("h2h"))}
        {pill("Spread", activeMarket === "spreads", () => setActiveMarket("spreads"))}
        {pill("Total", activeMarket === "totals", () => setActiveMarket("totals"))}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px" }}>
          <a href={`/betting?date=${prev}&sport=${activeSport}`} style={{ color: "#EA6C0A", textDecoration: "none", fontSize: "14px" }}>‹</a>
          <span style={{ fontSize: "12px", color: "var(--color-text-secondary)", minWidth: "80px", textAlign: "center" }}>
            {formatDate(date)}
          </span>
          <a href={`/betting?date=${next}&sport=${activeSport}`} style={{ color: "#EA6C0A", textDecoration: "none", fontSize: "14px" }}>›</a>
        </div>
      </div>

      {/* No games */}
      {games.length === 0 && (
        <div style={{ padding: "60px 0", textAlign: "center", color: "var(--color-text-secondary)" }}>
          No games found for this date.
        </div>
      )}

      {/* Games by sport */}
      {Object.keys(bySport).map(sportKey => (
        <div key={sportKey} style={{ marginBottom: "28px" }}>

          {/* Sport header */}
          <div style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "#EA6C0A",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            padding: "12px 8px 6px",
            borderBottom: "2px solid #EA6C0A20",
            marginBottom: "0",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}>
            {SPORT_LABELS[sportKey] ?? sportKey}
          </div>

          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: gridCols, padding: "5px 8px 4px", gap: "8px", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
            {([
              { label: "Matchup" },
              { label: "Time" },
              { label: "Best line", tooltip: "Best available price across all tracked sportsbooks" },
              { label: "DraftKings", color: "#53d337" },
              { label: "FanDuel", color: "#1493ff" },
              { label: "BetMGM", color: "#c9a84c" },
              { label: "Rivers", color: "#e63946" },
              { label: "Edge", tooltip: "Edge = model probability minus market implied probability" },
              { label: "" },
            ] as { label: string; tooltip?: string; color?: string }[]).map((col, i) => (
              <span key={i} style={{
                fontSize: "10px",
                color: "#6B7280",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                display: "flex",
                alignItems: "center",
                justifyContent: i >= 3 && i <= 6 ? "center" : "flex-start",
                gap: "3px",
              }}>
                {col.color ? (
                  <span style={{
                    fontSize: "10px",
                    fontWeight: 600,
                    color: col.color,
                    letterSpacing: "0.02em",
                  }}>{col.label}</span>
                ) : (
                  <>
                    {col.label}
                    {col.tooltip && (
                      <span title={col.tooltip} style={{
                        width: "12px", height: "12px",
                        borderRadius: "50%",
                        border: "1px solid #374151",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "8px",
                        color: "#6B7280",
                        cursor: "help",
                        flexShrink: 0,
                      }}>i</span>
                    )}
                  </>
                )}
              </span>
            ))}
          </div>

          {/* Rows */}
          {bySport[sportKey].map(game => {
            const expanded = expandedGame === game.id;
            const bestAway = getBest(game, "away");
            const bestHome = getBest(game, "home");
            const dk = getBookOdds(game, "draftkings");
            const fd = getBookOdds(game, "fanduel");
            const topSignal = getTopSignal(game);
            return (
              <div key={game.id}>
                <div
                  onClick={() => setExpandedGame(expanded ? null : game.id)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: gridCols,
                    alignItems: "center",
                    padding: "10px 8px",
                    borderBottom: "0.5px solid var(--color-border-tertiary)",
                    gap: "8px",
                    cursor: "pointer",
                    background: bySport[sportKey].indexOf(game) % 2 === 0
                      ? "transparent"
                      : "rgba(255,255,255,0.02)",
                    borderRadius: "4px",
                  }}
                >
                  {/* Matchup */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {getTeamLogo(game.awayTeam, game.sportKey) && (
                        <img
                          src={getTeamLogo(game.awayTeam, game.sportKey)!}
                          alt={game.awayTeam}
                          width={16}
                          height={16}
                          style={{ objectFit: "contain", opacity: 0.9 }}
                        />
                      )}
                      <span style={{
                        color: "#94A3B8",
                        fontWeight: 500,
                        fontSize: "14px",
                        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
                      }}>
                        {game.awayTeam}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {getTeamLogo(game.homeTeam, game.sportKey) && (
                        <img
                          src={getTeamLogo(game.homeTeam, game.sportKey)!}
                          alt={game.homeTeam}
                          width={16}
                          height={16}
                          style={{ objectFit: "contain", opacity: 0.9 }}
                        />
                      )}
                      <span style={{
                        fontWeight: 600,
                        fontSize: "14px",
                        color: "#F1F3F5",
                        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
                      }}>
                        {game.homeTeam}
                      </span>
                    </div>
                    {game.sportKey === "mlb" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "1px", marginTop: "3px" }}>
                        <span style={{ fontSize: "11px", color: "#6B7280" }}>
                          {(() => {
                            const p = getMlbStarters(game);
                            const away = p?.awayPitcher ?? "TBD";
                            const home = p?.homePitcher ?? "TBD";
                            const awayConfirmed = p?.awayPitcherConfirmed ?? false;
                            const homeConfirmed = p?.homePitcherConfirmed ?? false;
                            return (
                              <>
                                <span style={{ color: awayConfirmed ? "#9CA3AF" : "#D97706" }}>{away}</span>
                                <span style={{ color: "#4B5563" }}> vs </span>
                                <span style={{ color: homeConfirmed ? "#9CA3AF" : "#D97706" }}>{home}</span>
                                {(!awayConfirmed || !homeConfirmed) && (
                                  <span style={{ color: "#D97706" }}> · probable</span>
                                )}
                              </>
                            );
                          })()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Time */}
                  <span style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>
                    {formatTime(game.commenceTime)}
                  </span>

                  {/* Best line */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    <span style={{ fontSize: "12px" }}>
                      <strong>{fmtOdds(bestAway?.price ?? null)}</strong>
                      {bestAway && <span style={{ color: "var(--color-text-secondary)", fontSize: "10px" }}> {BOOK_LABELS[bestAway.bookmaker] ?? bestAway.bookmaker}</span>}
                    </span>
                    <span style={{ fontSize: "12px" }}>
                      <strong>{fmtOdds(bestHome?.price ?? null)}</strong>
                      {bestHome && <span style={{ color: "var(--color-text-secondary)", fontSize: "10px" }}> {BOOK_LABELS[bestHome.bookmaker] ?? bestHome.bookmaker}</span>}
                    </span>
                  </div>

                  {/* DraftKings */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px", alignItems: "center" }}>
                    {activeMarket === "h2h" && <>
                      <span style={{ fontSize: "13px", fontWeight: 500 }}>{dk ? fmtOdds(dk.away_price) : "—"}</span>
                      <span style={{ fontSize: "13px", fontWeight: 500 }}>{dk ? fmtOdds(dk.home_price) : "—"}</span>
                    </>}
                    {activeMarket === "spreads" && <>
                      <span style={{ fontSize: "13px", fontWeight: 500 }}>{dk ? (dk.spread_away !== null ? `${dk.spread_away > 0 ? "+" : ""}${dk.spread_away}` : "—") : "—"}</span>
                      <span style={{ fontSize: "13px", fontWeight: 500 }}>{dk ? (dk.spread_home !== null ? `${dk.spread_home > 0 ? "+" : ""}${dk.spread_home}` : "—") : "—"}</span>
                    </>}
                    {activeMarket === "totals" && <>
                      <span style={{ fontSize: "13px", fontWeight: 500 }}>{dk ? fmtOdds(dk.over_price) : "—"}</span>
                      <span style={{ fontSize: "13px", fontWeight: 500 }}>{dk ? fmtOdds(dk.under_price) : "—"}</span>
                    </>}
                  </div>

                  {/* FanDuel */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px", alignItems: "center" }}>
                    {activeMarket === "h2h" && <>
                      <span style={{ fontSize: "13px", fontWeight: 500 }}>{fd ? fmtOdds(fd.away_price) : "—"}</span>
                      <span style={{ fontSize: "13px", fontWeight: 500 }}>{fd ? fmtOdds(fd.home_price) : "—"}</span>
                    </>}
                    {activeMarket === "spreads" && <>
                      <span style={{ fontSize: "13px", fontWeight: 500 }}>{fd ? (fd.spread_away !== null ? `${fd.spread_away > 0 ? "+" : ""}${fd.spread_away}` : "—") : "—"}</span>
                      <span style={{ fontSize: "13px", fontWeight: 500 }}>{fd ? (fd.spread_home !== null ? `${fd.spread_home > 0 ? "+" : ""}${fd.spread_home}` : "—") : "—"}</span>
                    </>}
                    {activeMarket === "totals" && <>
                      <span style={{ fontSize: "13px", fontWeight: 500 }}>{fd ? fmtOdds(fd.over_price) : "—"}</span>
                      <span style={{ fontSize: "13px", fontWeight: 500 }}>{fd ? fmtOdds(fd.under_price) : "—"}</span>
                    </>}
                  </div>

                  {/* BetMGM */}
                  {(() => {
                    const mgm = getBookOdds(game, "betmgm");
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px", alignItems: "center" }}>
                        {activeMarket === "h2h" && <>
                          <span style={{ fontSize: "13px", fontWeight: 500 }}>{mgm ? fmtOdds(mgm.away_price) : "—"}</span>
                          <span style={{ fontSize: "13px", fontWeight: 500 }}>{mgm ? fmtOdds(mgm.home_price) : "—"}</span>
                        </>}
                        {activeMarket === "spreads" && <>
                          <span style={{ fontSize: "13px", fontWeight: 500 }}>{mgm ? (mgm.spread_away !== null ? `${mgm.spread_away > 0 ? "+" : ""}${mgm.spread_away}` : "—") : "—"}</span>
                          <span style={{ fontSize: "13px", fontWeight: 500 }}>{mgm ? (mgm.spread_home !== null ? `${mgm.spread_home > 0 ? "+" : ""}${mgm.spread_home}` : "—") : "—"}</span>
                        </>}
                        {activeMarket === "totals" && <>
                          <span style={{ fontSize: "13px", fontWeight: 500 }}>{mgm ? fmtOdds(mgm.over_price) : "—"}</span>
                          <span style={{ fontSize: "13px", fontWeight: 500 }}>{mgm ? fmtOdds(mgm.under_price) : "—"}</span>
                        </>}
                      </div>
                    );
                  })()}

                  {/* Rivers */}
                  {(() => {
                    const rivers = getRivers(game);
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px", alignItems: "center" }}>
                        {activeMarket === "h2h" && <>
                          <span style={{ fontSize: "13px", fontWeight: 500 }}>{rivers ? fmtOdds(rivers.away_price) : "—"}</span>
                          <span style={{ fontSize: "13px", fontWeight: 500 }}>{rivers ? fmtOdds(rivers.home_price) : "—"}</span>
                        </>}
                        {activeMarket === "spreads" && <>
                          <span style={{ fontSize: "13px", fontWeight: 500 }}>{rivers ? (rivers.spread_away !== null ? `${rivers.spread_away > 0 ? "+" : ""}${rivers.spread_away}` : "—") : "—"}</span>
                          <span style={{ fontSize: "13px", fontWeight: 500 }}>{rivers ? (rivers.spread_home !== null ? `${rivers.spread_home > 0 ? "+" : ""}${rivers.spread_home}` : "—") : "—"}</span>
                        </>}
                        {activeMarket === "totals" && <>
                          <span style={{ fontSize: "13px", fontWeight: 500 }}>{rivers ? fmtOdds(rivers.over_price) : "—"}</span>
                          <span style={{ fontSize: "13px", fontWeight: 500 }}>{rivers ? fmtOdds(rivers.under_price) : "—"}</span>
                        </>}
                      </div>
                    );
                  })()}

                  {/* Edge */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    {user ? (
                      topSignal ? (
                        <>
                          <span style={{ fontSize: "13px", fontWeight: 500, color: TIER_CONFIG[topSignal.tier]?.color }}>
                            {topSignal.edge_pct > 0 ? "+" : ""}{topSignal.edge_pct}%
                          </span>
                          <span style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}>
                            {TIER_CONFIG[topSignal.tier]?.label} · {topSignal.side === "home" ? game.homeTeam.split(" ").pop() : game.awayTeam.split(" ").pop()}
                          </span>
                        </>
                      ) : (
                        <span style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>—</span>
                      )
                    ) : (
                      <a href="/login" style={{
                        fontSize: "11px", color: "var(--color-text-secondary)",
                        textDecoration: "none", display: "flex", alignItems: "center", gap: "3px",
                      }}>
                        <span>🔒</span> Sign in
                      </a>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px", alignItems: "flex-start" }}>
                    {user && topSignal && (
                      <span style={{ fontSize: "11px", color: "#16A34A", fontWeight: 500, cursor: "pointer" }}
                        onClick={e => e.stopPropagation()}>
                        + Slip
                      </span>
                    )}
                    <span style={{ fontSize: "11px", color: "#EA6C0A", cursor: "pointer" }}>
                      {expanded ? "Close ↑" : "View →"}
                    </span>
                  </div>
                </div>

                {/* Expanded detail */}
                {expanded && (
                  <div style={{
                    padding: "16px 0 20px",
                    borderBottom: "0.5px solid var(--color-border-tertiary)",
                    background: "#111827",
                  }}>
                    <div style={{ padding: "0 8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>

                      {/* Left: signal + probability */}
                      <div>
                        {/* Signal card */}
                        {user ? (
                          topSignal ? (
                            <div style={{ marginBottom: "16px" }}>
                              <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-secondary)", marginBottom: "8px", fontWeight: 500 }}>
                                Signal
                              </div>
                              <div style={{
                                padding: "10px 12px",
                                background: "#1A2236",
                                borderRadius: "8px",
                                border: "0.5px solid var(--color-border-tertiary)",
                              }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                                  <span style={{ fontSize: "13px", fontWeight: 500 }}>
                                    {topSignal.side === "home" ? game.homeTeam : game.awayTeam} · Moneyline
                                  </span>
                                  <span style={{ fontSize: "14px", fontWeight: 500, color: TIER_CONFIG[topSignal.tier]?.color }}>
                                    {topSignal.edge_pct > 0 ? "+" : ""}{topSignal.edge_pct}% edge
                                  </span>
                                </div>
                                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                                  <span style={{
                                    fontSize: "10px", fontWeight: 500,
                                    padding: "2px 8px", borderRadius: "4px",
                                    background: `${TIER_CONFIG[topSignal.tier]?.color}18`,
                                    color: TIER_CONFIG[topSignal.tier]?.color,
                                  }}>
                                    {TIER_CONFIG[topSignal.tier]?.label}
                                  </span>
                                  <span style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>
                                    Best: {fmtOdds(topSignal.best_price)} {BOOK_LABELS[topSignal.best_bookmaker] ?? topSignal.best_bookmaker}
                                  </span>
                                  <span style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>
                                    EV: {topSignal.ev_value > 0 ? "+" : ""}${topSignal.ev_value?.toFixed(2)} / $100
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div style={{ marginBottom: "16px", padding: "10px 12px", background: "#1A2236", borderRadius: "8px", border: "0.5px solid var(--color-border-tertiary)" }}>
                              <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>No signal available for this game.</span>
                            </div>
                          )
                        ) : (
                          <div style={{
                            padding: "14px", background: "#1A2236",
                            borderRadius: "8px", border: "0.5px solid var(--color-border-tertiary)",
                            textAlign: "center", marginBottom: "16px",
                          }}>
                            <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", margin: "0 0 8px" }}>
                              Sign in to see edge, probability, and signals
                            </p>
                            <a href="/login" style={{ fontSize: "12px", color: "#EA6C0A", fontWeight: 500, textDecoration: "none" }}>
                              Sign in free →
                            </a>
                          </div>
                        )}

                        {/* Win probability */}
                        {user && game.consensus && (
                          <div>
                            <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-secondary)", marginBottom: "8px", fontWeight: 500 }}>
                              Win probability
                            </div>
                            {[
                              {
                                label: `Model (${MODEL_LABELS[game.consensus.model_source] ?? game.consensus.model_source})`,
                                value: game.consensus.consensus_home_win_prob,
                                color: "#EA6C0A",
                              },
                              {
                                label: "Market implied",
                                value: game.consensus.market_implied_home_prob,
                                color: "var(--color-border-secondary)",
                              },
                            ].map((row, i) => (
                              <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                                <span style={{ fontSize: "11px", color: "var(--color-text-secondary)", width: "168px", flexShrink: 0 }}>
                                  {row.label}
                                </span>
                                <div style={{ flex: 1, height: "5px", background: "var(--color-border-tertiary)", borderRadius: "3px", overflow: "hidden" }}>
                                  <div style={{
                                    width: `${Math.round((row.value ?? 0) * 100)}%`,
                                    height: "100%",
                                    background: row.color,
                                    borderRadius: "3px",
                                  }} />
                                </div>
                                <span style={{ fontSize: "11px", fontWeight: 500, width: "34px", textAlign: "right" }}>
                                  {Math.round((row.value ?? 0) * 100)}%
                                </span>
                              </div>
                            ))}
                            <div style={{ fontSize: "10px", color: "var(--color-text-secondary)", marginTop: "6px" }}>
                              Confidence: {game.consensus.confidence_tier}
                              {game.consensus.model_available ? " · Independent model" : " · Market proxy"}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right: book comparison */}
                      <div>
                        <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-secondary)", marginBottom: "8px", fontWeight: 500 }}>
                          Lines across books
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
                          {BOOKS_PRIORITY.map(bookmaker => {
                            const o = getBookOdds(game, bookmaker);
                            if (!o) return null;
                            const isBestAway = bestAway?.bookmaker === bookmaker;
                            const isBestHome = bestHome?.bookmaker === bookmaker;

                            let awayVal: number | null = null;
                            let homeVal: number | null = null;

                            if (activeMarket === "h2h") {
                              awayVal = o.away_price;
                              homeVal = o.home_price;
                            } else if (activeMarket === "spreads") {
                              awayVal = o.spread_away;
                              homeVal = o.spread_home;
                            } else if (activeMarket === "totals") {
                              awayVal = o.over_price;
                              homeVal = o.under_price;
                            }

                            return (
                              <div key={bookmaker} style={{
                                padding: "8px 10px",
                                background: "#1A2236",
                                borderRadius: "6px",
                                border: "0.5px solid var(--color-border-tertiary)",
                              }}>
                                <div style={{ fontSize: "10px", color: "var(--color-text-secondary)", marginBottom: "4px" }}>
                                  {BOOK_LABELS[bookmaker]}
                                </div>
                                <div style={{ fontSize: "13px", fontWeight: 500, color: isBestAway ? "#16A34A" : "#F1F3F5" }}>
                                  {activeMarket === "spreads" ? awayVal ?? "—" : fmtOdds(awayVal)}
                                </div>
                                <div style={{ fontSize: "13px", fontWeight: 500, color: isBestHome ? "#16A34A" : "#F1F3F5" }}>
                                  {activeMarket === "spreads" ? homeVal ?? "—" : fmtOdds(homeVal)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {golfLeaderboard.length > 0 && (
        <GolfTournamentCard
          tournamentName={golfTournamentName}
          roundStatus={golfRoundStatus}
          players={golfLeaderboard}
        />
      )}

      {/* Footer CTA */}
      {!user && games.length > 0 && (
        <div style={{
          padding: "14px 0",
          borderTop: "0.5px solid var(--color-border-tertiary)",
          fontSize: "12px",
          color: "#6B7280",
        }}>
          Signals and edge calculations require a free account.{" "}
          <a href="/login" style={{ color: "#EA6C0A", textDecoration: "none" }}>Sign in free →</a>
        </div>
      )}
    </div>
  );
}
