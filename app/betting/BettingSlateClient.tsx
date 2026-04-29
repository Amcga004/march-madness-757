"use client";

// ⚠️ HYDRATION RULE: Never add console.log, Math.random(), Date.now(),
// or any non-deterministic code directly inside JSX or the render/map body.
// This causes React hydration errors (#418) because server and client
// produce different output.
//
// For debugging: always use useEffect(() => { console.log(...) }, [dep])
// useEffect runs client-side only after hydration — no mismatch possible.

import { useState, useMemo, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/browser";
import AuthButton from "@/app/components/AuthButton";
import GolfTournamentCard from "./GolfTournamentCard";
import { savePick, fetchMyPicks, deletePick, updateUnitSize, saveParlay, fetchMyParlays, deleteParlay, updateParlayUnit } from "./actions";

const SPORT_LABELS: Record<string, string> = {
  nba: "NBA",
  mlb: "MLB",
  nhl: "NHL",
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

const EDGE_TIER_CONFIG: Record<string, { color: string; label: string }> = {
  no_edge:      { color: "#6B7280", label: "No edge" },
  lean:         { color: "#6B7280", label: "Lean" },
  good_value:   { color: "#D97706", label: "Good value" },
  strong_value: { color: "#16A34A", label: "Strong value" },
};

const MODEL_LABELS: Record<string, string> = {
  dunks_and_threes: "Dunks & Threes",
  kenpom: "KenPom",
  baseball_savant: "Market proxy",
};

interface Props {
  date: string;
  todayET: string;
  sport: string;
  games: any[];
  mlbStartersByTeam: Record<string, { pitcher: string; confirmed: boolean }>;
  golfLeaderboard: any[];
  golfRawCompetitors: any[];
  golfTournamentName: string;
  golfTournamentId: string;
  golfRoundStatus: string;
  teamLogos: any[];
  user: { id: string; email?: string } | null;
}

export default function BettingSlateClient({
  date, todayET, sport, games, mlbStartersByTeam, golfLeaderboard, golfRawCompetitors, golfTournamentName, golfTournamentId, golfRoundStatus, teamLogos, user,
}: Props) {
  const [activeSport] = useState(sport);
  const [activeMarket, setActiveMarket] = useState("h2h");
  const pathname = usePathname();
  const [liveGames, setLiveGames] = useState(games);
  const [liveGolf, setLiveGolf] = useState(golfLeaderboard);

  const [currentUser, setCurrentUser] = useState(user);
  const userRef = useRef(currentUser);
  const [activeTab, setActiveTab] = useState<"slate" | "picks">("slate");
  const [slipModal, setSlipModal] = useState<{ game: any; selectedSide: "home" | "away" } | null>(null);
  const [myPicks, setMyPicks] = useState<any[] | null>(null);
  const [savingPick, setSavingPick] = useState(false);
  const [modalUnit, setModalUnit] = useState<number | string>('');
  const [customOdds, setCustomOdds] = useState<number | null>(null);
  const [timeFilter, setTimeFilter] = useState("all");
  const [parlayLegs, setParlayLegs] = useState<Array<{
    gameId: string
    awayTeam: string
    homeTeam: string
    sportKey: string
    gameDate: string
    pickedTeam: string
    odds: number
  }>>([]);
  const [showParlayTray, setShowParlayTray] = useState(false);
  const [parlayTrayExpanded, setParlayTrayExpanded] = useState(true);
  const [parlayUnit, setParlayUnit] = useState<number | string>('');
  const [savingParlay, setSavingParlay] = useState(false);
  const [myParlays, setMyParlays] = useState<any[] | null>(null);
  useEffect(() => { userRef.current = currentUser; }, [currentUser]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user && !currentUser) {
        setCurrentUser({ id: data.session.user.id, email: data.session.user.email });
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setCurrentUser({ id: session.user.id, email: session.user.email });
      } else {
        setCurrentUser(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const orlDet = liveGames.find((g: any) =>
      g.awayTeam?.includes("Orlando") || g.homeTeam?.includes("Detroit")
    );
    if (orlDet) {
      console.log("[ORL/DET debug]", {
        isLive: orlDet.isLive,
        isFinal: orlDet.isFinal,
        statusDetail: orlDet.statusDetail,
        signalsCount: orlDet.signals?.length ?? 0,
        signals: orlDet.signals,
      });
    }
  }, [liveGames]);

  useEffect(() => {
    if (activeTab === "picks" && currentUser) {
      if (myPicks === null) fetchMyPicks(currentUser.id).then(setMyPicks);
      if (myParlays === null) fetchMyParlays(currentUser.id).then(setMyParlays);
    }
  }, [activeTab, currentUser]);

  const today = todayET;
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

  const filteredGames = useMemo(() => {
    return liveGames
      .filter((g: any) => activeSport === "all" || g.sportKey === activeSport)
      .sort((a: any, b: any) => new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime());
  }, [liveGames, activeSport]);

  const bySport = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const g of filteredGames) {
      if (!groups[g.sportKey]) groups[g.sportKey] = [];
      groups[g.sportKey].push(g);
    }
    return groups;
  }, [filteredGames]);

  function preferClosing(odds: any[], game: any) {
    if (!game.isLive && !game.isFinal) return odds;
    const closing = odds.filter((o: any) => o.closing_line === true);
    return closing.length > 0 ? closing : odds;
  }

  function getBookOdds(game: any, bookmaker: string) {
    const pool = preferClosing(game.odds, game);
    return pool.find((o: any) => o.bookmaker === bookmaker && o.market_type === activeMarket);
  }

  function getRivers(game: any) {
    const pool = preferClosing(game.odds, game);
    return pool.find((o: any) =>
      (o.bookmaker === "betrivers" || o.bookmaker === "rivers") &&
      o.market_type === activeMarket
    );
  }

  function getBest(game: any, side: "home" | "away" | "over" | "under") {
    const relevant = preferClosing(game.odds, game).filter((o: any) => o.market_type === activeMarket);
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

  function calcParlayOdds(legs: Array<{ odds: number }>): number {
    const decimal = legs.reduce((acc, leg) => {
      const d = leg.odds > 0 ? (leg.odds / 100) + 1 : (100 / Math.abs(leg.odds)) + 1;
      return acc * d;
    }, 1);
    if (decimal >= 2) return Math.round((decimal - 1) * 100);
    return Math.round(-100 / (decimal - 1));
  }

  function getTopSignal(game: any) {
    if (!game.signals || game.signals.length === 0) return null;
    return game.signals.reduce((a: any, b: any) =>
      Math.abs(a.edge_pct) >= Math.abs(b.edge_pct) ? a : b
    );
  }


  function getTeamLogo(teamName: string, game: any, side: "home" | "away"): string | null {
    if (side === "home" && game.homeLogo) return game.homeLogo;
    if (side === "away" && game.awayLogo) return game.awayLogo;

    const team = teamLogos.find((t: any) => t.canonical_name === teamName);
    if (!team?.abbreviation) return null;
    const a = (team.abbreviation as string).toLowerCase();
    const { sportKey } = game;
    if (sportKey === "nba") return `https://a.espncdn.com/i/teamlogos/nba/500/${a}.png`;
    if (sportKey === "mlb") return `https://a.espncdn.com/i/teamlogos/mlb/500/${a}.png`;
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
    <>
    <style>{`
      * { box-sizing: border-box; }
      body { overflow-x: hidden; }
      .betting-page-root { max-width: 100vw; overflow-x: hidden; }
      .mobile-details-link { display: inline-block; font-size: 14px; color: #EA6C0A; margin-top: 4px; text-decoration: none; }
      .col-headers { display: grid; }
      .game-row-desktop { display: grid; }
      .game-row-mobile { display: none; }
      @media (max-width: 767px) {
        .col-headers { display: none !important; }
        .game-row-desktop { display: none !important; }
        .game-row-mobile { display: block !important; }
      }
      @media (max-width: 767px) {
        .golf-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .desktop-expand-panel { display: none !important; }
        .nav-links { display: none !important; }
        .nav-header { padding: 8px 12px !important; }
        .betting-page-root { padding-bottom: 80px !important; }
        .mobile-bottom-nav { display: flex !important; }
      }
      .mobile-bottom-nav {
        display: none;
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: #0D1117;
        border-top: 1px solid #21262D;
        padding: 8px 0 16px;
        z-index: 100;
      }
      .mobile-tab {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        color: #6B7280;
        text-decoration: none;
        font-size: 10px;
        flex: 1;
        padding: 4px 0;
      }
      .mobile-tab.active { color: #EA6C0A; }
    `}</style>
    <div className="betting-page-root" style={{
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
      <div className="nav-header" style={{
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
        <div className="nav-links" style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          {navLink("/betting", "Betting", pathname === "/betting")}
          {navLink("/fantasy", "Fantasy", pathname === "/fantasy")}
          <Link href="/props" style={{ fontSize: "12px", color: "#6B7280", textDecoration: "none", padding: "4px 10px", borderRadius: "12px", border: "1px solid #21262D", display: "inline-block" }}>Props ↗</Link>
          {currentUser && (
            <button onClick={() => setActiveTab(t => t === "picks" ? "slate" : "picks")} style={{
              fontSize: "13px",
              color: activeTab === "picks" ? "#EA6C0A" : "var(--color-text-secondary)",
              fontWeight: activeTab === "picks" ? 500 : 400,
              background: "transparent", border: "none", cursor: "pointer", padding: 0,
            }}>
              My Picks
            </button>
          )}
          <AuthButton />
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "14px", flexWrap: "wrap", background: "#0D1117" }}>
        {pill("All", activeSport === "all", () => { const u = new URL(window.location.href); u.searchParams.set("sport", "all"); window.location.href = u.toString(); })}
        {pill("NBA", activeSport === "nba", () => { const u = new URL(window.location.href); u.searchParams.set("sport", "nba"); window.location.href = u.toString(); })}
        {pill("NHL", activeSport === "nhl", () => { const u = new URL(window.location.href); u.searchParams.set("sport", "nhl"); window.location.href = u.toString(); })}
        {pill("MLB", activeSport === "mlb", () => { const u = new URL(window.location.href); u.searchParams.set("sport", "mlb"); window.location.href = u.toString(); })}
        {pill("CBB", activeSport === "ncaab", () => { const u = new URL(window.location.href); u.searchParams.set("sport", "ncaab"); window.location.href = u.toString(); })}
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

      {/* Tab switcher */}
      {currentUser && (
        <div style={{ display: "flex", gap: "0", marginBottom: "16px", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
          {(["slate", "picks"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: "8px 16px",
              fontSize: "12px",
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? "#EA6C0A" : "var(--color-text-secondary)",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === tab ? "2px solid #EA6C0A" : "2px solid transparent",
              cursor: "pointer",
              marginBottom: "-0.5px",
            }}>
              {tab === "slate" ? "Today's Slate" : "My Picks"}
            </button>
          ))}
        </div>
      )}

      {/* No games */}
      {activeTab === "slate" && filteredGames.length === 0 && (
        <div style={{ padding: "60px 0", textAlign: "center", color: "var(--color-text-secondary)" }}>
          No games found for this date.
        </div>
      )}

      {/* Games by sport */}
      {activeTab === "slate" && Object.keys(bySport).map(sportKey => (
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

          {/* Column headers — hidden on mobile via CSS */}
          <div className="col-headers" style={{ display: "grid", gridTemplateColumns: gridCols, padding: "5px 8px 4px", gap: "8px", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
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
            const bestAway = getBest(game, "away");
            const bestHome = getBest(game, "home");
            const dk = getBookOdds(game, "draftkings");
            const fd = getBookOdds(game, "fanduel");
            const topSignal = getTopSignal(game);
            const awayWon = game.isFinal && game.awayScore !== null && game.homeScore !== null
              && Number(game.awayScore) > Number(game.homeScore);
            const homeWon = game.isFinal && game.awayScore !== null && game.homeScore !== null
              && Number(game.homeScore) > Number(game.awayScore);
            return (
              <div key={game.id}>
                {/* ── Mobile card (hidden on desktop via CSS) ── */}
                <div
                  className="game-row-mobile"
                  onClick={() => {
                    window.location.href = `/betting/game/${game.id}?sport=${game.sportKey}`;
                  }}
                  style={{
                    background: "#161B22",
                      borderRadius: "10px",
                      padding: "12px 14px",
                      marginBottom: "8px",
                      border: "1px solid #21262D",
                      cursor: "pointer",
                    }}
                  >
                    {/* Teams + scores */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {getTeamLogo(game.awayTeam, game, "away") && (
                          <img src={getTeamLogo(game.awayTeam, game, "away")!} alt={game.awayTeam} width={14} height={14} style={{ objectFit: "contain" }} />
                        )}
                        <span style={{ fontSize: "14px", fontWeight: 500, color: awayWon ? "#F1F3F5" : "#94A3B8" }}>
                          {game.awayTeam}{awayWon && <span style={{ marginLeft: "4px", fontSize: "11px", color: "#16A34A" }}>✓</span>}
                        </span>
                        {game.awayRecord && <span style={{ fontSize: "10px", color: "#4B5563" }}>{game.awayRecord}</span>}
                      </div>
                      {(game.isLive || game.isFinal) && game.awayScore !== null && (
                        <span style={{ fontSize: "15px", fontWeight: 700, color: awayWon ? "#F1F3F5" : "#6B7280" }}>{game.awayScore}</span>
                      )}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {getTeamLogo(game.homeTeam, game, "home") && (
                          <img src={getTeamLogo(game.homeTeam, game, "home")!} alt={game.homeTeam} width={14} height={14} style={{ objectFit: "contain" }} />
                        )}
                        <span style={{ fontSize: "14px", fontWeight: 500, color: "#F1F3F5" }}>
                          {game.homeTeam}{homeWon && <span style={{ marginLeft: "4px", fontSize: "11px", color: "#16A34A" }}>✓</span>}
                        </span>
                        {game.homeRecord && <span style={{ fontSize: "10px", color: "#4B5563" }}>{game.homeRecord}</span>}
                      </div>
                      {(game.isLive || game.isFinal) && game.homeScore !== null && (
                        <span style={{ fontSize: "15px", fontWeight: 700, color: homeWon ? "#F1F3F5" : "#6B7280" }}>{game.homeScore}</span>
                      )}
                    </div>
                    {/* Status line below scores */}
                    <div style={{ textAlign: "right", marginBottom: "10px" }}>
                      {game.isFinal ? (
                        <span style={{ fontSize: "10px", color: "#6B7280" }}>Final</span>
                      ) : game.isLive ? (
                        <span style={{ fontSize: "10px", color: "#EA6C0A", fontWeight: 500 }}>{game.statusDetail}</span>
                      ) : (
                        <span style={{ fontSize: "10px", color: "#6B7280" }}>{formatTime(game.commenceTime)}</span>
                      )}
                    </div>

                    {/* MLB pitchers */}
                    {game.sportKey === "mlb" && (() => {
                      const home = mlbStartersByTeam[game.homeTeam];
                      const away = mlbStartersByTeam[game.awayTeam];
                      if (!home && !away) return null;
                      return (
                        <div style={{ fontSize: "11px", color: "#6B7280", marginBottom: "10px" }}>
                          <span style={{ color: away?.confirmed ? "#9CA3AF" : "#D97706" }}>{away?.pitcher ?? "TBD"}</span>
                          <span style={{ color: "#4B5563" }}> vs </span>
                          <span style={{ color: home?.confirmed ? "#9CA3AF" : "#D97706" }}>{home?.pitcher ?? "TBD"}</span>
                        </div>
                      );
                    })()}

                    {/* Divider */}
                    <div style={{ height: "0.5px", background: "#21262D", marginBottom: "10px" }} />

                    {/* Best line + edge */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <span style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Best Line</span>
                        {activeMarket === "totals" ? (() => {
                          const totalsPool = preferClosing(game.odds, game).filter((o: any) => o.market_type === "totals");
                          let bestOverRow: any = null;
                          let bestUnderRow: any = null;
                          for (const o of totalsPool) {
                            if (o.over_price != null && (!bestOverRow || o.over_price > bestOverRow.over_price)) bestOverRow = o;
                            if (o.under_price != null && (!bestUnderRow || o.under_price > bestUnderRow.under_price)) bestUnderRow = o;
                          }
                          const lineValue = bestOverRow?.line_value ?? bestUnderRow?.line_value ?? null;
                          return <>
                            {lineValue != null && <span style={{ fontSize: "12px", color: "#EA6C0A", fontWeight: 600 }}>O/U {lineValue}</span>}
                            <span style={{ fontSize: "12px" }}><strong>O {fmtOdds(bestOverRow?.over_price ?? null)}</strong>{bestOverRow && <span style={{ color: "#6B7280", fontSize: "10px" }}> {BOOK_LABELS[bestOverRow.bookmaker] ?? bestOverRow.bookmaker}</span>}</span>
                            <span style={{ fontSize: "12px" }}><strong>U {fmtOdds(bestUnderRow?.under_price ?? null)}</strong>{bestUnderRow && <span style={{ color: "#6B7280", fontSize: "10px" }}> {BOOK_LABELS[bestUnderRow.bookmaker] ?? bestUnderRow.bookmaker}</span>}</span>
                          </>;
                        })() : (!bestAway && !bestHome) ? (
                          <span style={{ fontSize: "16px", color: "#4B5563" }}>🔒</span>
                        ) : <>
                          <span style={{ fontSize: "12px" }}><strong>{fmtOdds(bestAway?.price ?? null)}</strong>{bestAway && <span style={{ color: "#6B7280", fontSize: "10px" }}> {BOOK_LABELS[bestAway.bookmaker] ?? bestAway.bookmaker}</span>}</span>
                          <span style={{ fontSize: "12px" }}><strong>{fmtOdds(bestHome?.price ?? null)}</strong>{bestHome && <span style={{ color: "#6B7280", fontSize: "10px" }}> {BOOK_LABELS[bestHome.bookmaker] ?? bestHome.bookmaker}</span>}</span>
                        </>}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px", alignItems: "flex-end" }}>
                        {!game.isLive && !game.isFinal && (
                          currentUser ? (
                            topSignal ? (
                              <>
                                <span style={{ fontSize: "14px", fontWeight: 600, color: (EDGE_TIER_CONFIG[topSignal.edge_tier] ?? TIER_CONFIG[topSignal.tier])?.color }}>
                                  {topSignal.edge_pct > 0 ? "+" : ""}{topSignal.edge_pct}%
                                </span>
                                <span style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}>
                                  {(EDGE_TIER_CONFIG[topSignal.edge_tier] ?? TIER_CONFIG[topSignal.tier])?.label} · {topSignal.side === "home" ? game.homeTeam.split(" ").pop() : game.awayTeam.split(" ").pop()}
                                </span>
                              </>
                            ) : <span style={{ fontSize: "10px", color: "#4B5563" }}>No edge</span>
                          ) : (
                            <a href="/login" style={{ fontSize: "11px", color: "var(--color-text-secondary)", textDecoration: "none" }}>🔒 Sign in</a>
                          )
                        )}
                        {currentUser && !game.isLive && !game.isFinal && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              const initSide = topSignal?.side ?? "away";
                              setSlipModal({ game, selectedSide: initSide });
                              setCustomOdds(getBest(game, initSide)?.price ?? null);
                            }}
                            style={{ color: "#EA6C0A", fontSize: "14px", cursor: "pointer", padding: "8px 12px", margin: "-8px -12px" }}
                          >+ Slip</span>
                        )}
                        <a
                          href={`/betting/game/${game.id}?sport=${game.sportKey}`}
                          className="mobile-details-link"
                          onClick={(e) => e.stopPropagation()}
                          style={{ fontSize: "14px", padding: "8px 12px", margin: "-8px -12px" }}
                        >Details →</a>
                      </div>
                    </div>
                  </div>
                {/* ── Desktop grid row (hidden on mobile via CSS) ── */}
                <div
                  className="game-row-desktop"
                  onClick={() => { window.location.href = `/betting/game/${game.id}?sport=${game.sportKey}` }}
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
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {getTeamLogo(game.awayTeam, game, "away") && (
                          <img src={getTeamLogo(game.awayTeam, game, "away")!} alt={game.awayTeam}
                            width={16} height={16} style={{ objectFit: "contain" }} />
                        )}
                        <span style={{ color: "#94A3B8", fontWeight: 500, fontSize: "14px" }}>
                          {game.awayTeam}
                          {awayWon && <span style={{ marginLeft: "4px", fontSize: "11px", color: "#16A34A" }}>✓</span>}
                        </span>
                        {game.awayRecord && (
                          <span style={{ fontSize: "10px", color: "#4B5563" }}>{game.awayRecord}</span>
                        )}
                      </div>
                      {(game.isLive || game.isFinal) && game.awayScore !== null && (
                        <span style={{
                          fontSize: "15px",
                          fontWeight: 700,
                          color: awayWon ? "#F1F3F5" : "#6B7280",
                          minWidth: "24px",
                          textAlign: "right",
                        }}>{game.awayScore}</span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {getTeamLogo(game.homeTeam, game, "home") && (
                          <img src={getTeamLogo(game.homeTeam, game, "home")!} alt={game.homeTeam}
                            width={16} height={16} style={{ objectFit: "contain" }} />
                        )}
                        <span style={{ fontWeight: 500, fontSize: "14px", color: "#F1F3F5" }}>
                          {game.homeTeam}
                          {homeWon && <span style={{ marginLeft: "4px", fontSize: "11px", color: "#16A34A" }}>✓</span>}
                        </span>
                        {game.homeRecord && (
                          <span style={{ fontSize: "10px", color: "#4B5563" }}>{game.homeRecord}</span>
                        )}
                      </div>
                      {(game.isLive || game.isFinal) && game.homeScore !== null && (
                        <span style={{
                          fontSize: "15px",
                          fontWeight: 700,
                          color: homeWon ? "#F1F3F5" : "#6B7280",
                          minWidth: "24px",
                          textAlign: "right",
                        }}>{game.homeScore}</span>
                      )}
                    </div>
                    {game.sportKey === "mlb" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "1px", marginTop: "2px" }}>
                        {(() => {
                          const home = mlbStartersByTeam[game.homeTeam];
                          const away = mlbStartersByTeam[game.awayTeam];
                          if (!home && !away) return null;
                          return (
                            <span style={{ fontSize: "11px", color: "#6B7280" }}>
                              <span style={{ color: away?.confirmed ? "#9CA3AF" : "#D97706" }}>
                                {away?.pitcher ?? "TBD"}
                              </span>
                              <span style={{ color: "#4B5563" }}> vs </span>
                              <span style={{ color: home?.confirmed ? "#9CA3AF" : "#D97706" }}>
                                {home?.pitcher ?? "TBD"}
                              </span>
                            </span>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Time */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    {game.isFinal ? (
                      <span style={{ fontSize: "11px", color: "#6B7280" }}>Final</span>
                    ) : game.isLive ? (
                      <span style={{ fontSize: "11px", color: "#EA6C0A", fontWeight: 500 }}>
                        {game.statusDetail}
                      </span>
                    ) : (
                      <span style={{ fontSize: "11px", color: "#6B7280" }}>
                        {formatTime(game.commenceTime)}
                      </span>
                    )}
                  </div>

                  {/* Best line */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    {activeMarket === "totals" ? (() => {
                      const totalsPool = preferClosing(game.odds, game).filter((o: any) => o.market_type === "totals");
                      let bestOverRow: any = null;
                      let bestUnderRow: any = null;
                      for (const o of totalsPool) {
                        if (o.over_price != null && (!bestOverRow || o.over_price > bestOverRow.over_price)) bestOverRow = o;
                        if (o.under_price != null && (!bestUnderRow || o.under_price > bestUnderRow.under_price)) bestUnderRow = o;
                      }
                      const lineValue = bestOverRow?.line_value ?? bestUnderRow?.line_value ?? totalsPool[0]?.line_value ?? null;
                      return <>
                        {lineValue != null && <span style={{ fontSize: "13px", color: "#EA6C0A", fontWeight: 600 }}>O/U {lineValue}</span>}
                        <span style={{ fontSize: "12px" }}>
                          <strong>O {fmtOdds(bestOverRow?.over_price ?? null)}</strong>
                          {bestOverRow && <span style={{ color: "var(--color-text-secondary)", fontSize: "10px" }}> {BOOK_LABELS[bestOverRow.bookmaker] ?? bestOverRow.bookmaker}</span>}
                        </span>
                        <span style={{ fontSize: "12px" }}>
                          <strong>U {fmtOdds(bestUnderRow?.under_price ?? null)}</strong>
                          {bestUnderRow && <span style={{ color: "var(--color-text-secondary)", fontSize: "10px" }}> {BOOK_LABELS[bestUnderRow.bookmaker] ?? bestUnderRow.bookmaker}</span>}
                        </span>
                      </>;
                    })() : (!bestAway && !bestHome) ? (
                      <span style={{ fontSize: "16px", color: "#4B5563" }}>🔒</span>
                    ) : <>
                      <span style={{ fontSize: "12px" }}>
                        <strong>{fmtOdds(bestAway?.price ?? null)}</strong>
                        {bestAway && <span style={{ color: "var(--color-text-secondary)", fontSize: "10px" }}> {BOOK_LABELS[bestAway.bookmaker] ?? bestAway.bookmaker}</span>}
                      </span>
                      <span style={{ fontSize: "12px" }}>
                        <strong>{fmtOdds(bestHome?.price ?? null)}</strong>
                        {bestHome && <span style={{ color: "var(--color-text-secondary)", fontSize: "10px" }}> {BOOK_LABELS[bestHome.bookmaker] ?? bestHome.bookmaker}</span>}
                      </span>
                    </>}
                  </div>

                  {/* DraftKings */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px", alignItems: "center" }}>
                    {activeMarket === "h2h" && <>
                      <span style={{ fontSize: "13px", fontWeight: 500 }}>
                        {dk ? fmtOdds(dk.away_price) : "—"}
                      </span>
                      <span style={{ fontSize: "13px", fontWeight: 500 }}>
                        {dk ? fmtOdds(dk.home_price) : "—"}
                      </span>
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
                    {game.isLive || game.isFinal ? null
                      : currentUser ? (
                        topSignal ? (
                          <>
                            <span style={{ fontSize: "13px", fontWeight: 500, color: (EDGE_TIER_CONFIG[topSignal.edge_tier] ?? TIER_CONFIG[topSignal.tier])?.color }}>
                              {topSignal.edge_pct > 0 ? "+" : ""}{topSignal.edge_pct}%
                            </span>
                            <span style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}>
                              {(EDGE_TIER_CONFIG[topSignal.edge_tier] ?? TIER_CONFIG[topSignal.tier])?.label} · {topSignal.side === "home" ? game.homeTeam.split(" ").pop() : game.awayTeam.split(" ").pop()}
                            </span>
                          </>
                        ) : (
                          <span style={{ fontSize: "10px", color: "#4B5563" }}>No edge</span>
                        )
                      ) : (
                        <a href="/login" style={{
                          fontSize: "11px", color: "var(--color-text-secondary)",
                          textDecoration: "none", display: "flex", alignItems: "center", gap: "3px",
                        }}>
                          <span>🔒</span> Sign in
                        </a>
                      )
                    }
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px", alignItems: "flex-start" }}>
                    {currentUser && !game.isLive && !game.isFinal && (
                      <span style={{ fontSize: "11px", color: "#16A34A", fontWeight: 500, cursor: "pointer" }}
                        onClick={e => {
                          e.stopPropagation();
                          const initSide = topSignal?.side ?? "away";
                          setSlipModal({ game, selectedSide: initSide });
                          setCustomOdds(getBest(game, initSide)?.price ?? null);
                        }}>
                        + Slip
                      </span>
                    )}
                    <a href={`/betting/game/${game.id}?sport=${game.sportKey}`}
                      onClick={e => e.stopPropagation()}
                      style={{ color: '#EA6C0A', fontSize: '13px', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                      View →
                    </a>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      ))}

      {activeTab === "slate" && liveGolf.length > 0 && (
        <GolfTournamentCard
          tournamentName={golfTournamentName}
          roundStatus={golfRoundStatus}
          players={liveGolf}
          rawCompetitors={golfRawCompetitors}
        />
      )}

      {/* Footer CTA */}
      {activeTab === "slate" && !currentUser && filteredGames.length > 0 && (
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

      {/* My Picks tab */}
      {activeTab === "picks" && (() => {
        if (myPicks === null) {
          return (
            <div style={{ padding: "60px 0", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "13px" }}>
              Loading picks...
            </div>
          );
        }

        const resultMeta: Record<string, { color: string; label: string }> = {
          win:     { color: "#16A34A", label: "Win" },
          loss:    { color: "#DC2626", label: "Loss" },
          live:    { color: "#EA6C0A", label: "Live" },
          pending: { color: "#6B7280", label: "Pending" },
        };

        const TIME_FILTERS = [
          { key: "all", label: "All" },
          { key: "7d",  label: "7D" },
          { key: "15d", label: "15D" },
          { key: "30d", label: "30D" },
          { key: "90d", label: "90D" },
        ];

        function cutoffDate(key: string): string | null {
          const days: Record<string, number> = { "7d": 7, "15d": 15, "30d": 30, "90d": 90 };
          if (!days[key]) return null;
          const d = new Date();
          d.setDate(d.getDate() - days[key]);
          return d.toISOString().split("T")[0];
        }

        const cutoff = cutoffDate(timeFilter);
        const filteredPicks = cutoff
          ? myPicks.filter((p: any) => p.game_date >= cutoff)
          : myPicks;

        function calcPnl(pick: any): number | null {
          const unit = pick.unit_size ?? 1;
          const odds = pick.pick_odds;
          if (pick.result === "win") {
            return odds > 0 ? unit * (odds / 100) : unit * (100 / Math.abs(odds));
          }
          if (pick.result === "loss") return -unit;
          return null;
        }

        const settledPicks = filteredPicks.filter((p: any) => p.result === "win" || p.result === "loss");
        const wins = settledPicks.filter((p: any) => p.result === "win").length;
        const losses = settledPicks.filter((p: any) => p.result === "loss").length;
        const winPct = settledPicks.length > 0 ? Math.round((wins / settledPicks.length) * 100) : null;
        const totalPnl = settledPicks.reduce((sum: number, p: any) => sum + (calcPnl(p) ?? 0), 0);

        return (
          <div style={{ maxWidth: "680px", margin: "0 auto" }}>
            {/* Time filter pills */}
            <div style={{ display: "flex", gap: "6px", marginBottom: "14px", flexWrap: "wrap" }}>
              {TIME_FILTERS.map(f => (
                <button key={f.key} onClick={() => setTimeFilter(f.key)} style={{
                  padding: "4px 12px", borderRadius: "20px", fontSize: "12px", cursor: "pointer",
                  border: `0.5px solid ${timeFilter === f.key ? "#EA6C0A80" : "var(--color-border-secondary)"}`,
                  background: timeFilter === f.key ? "#EA6C0A15" : "transparent",
                  color: timeFilter === f.key ? "#EA6C0A" : "var(--color-text-secondary)",
                }}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Summary bar */}
            {settledPicks.length > 0 && (
              <div style={{
                display: "flex", gap: "0", marginBottom: "16px",
                background: "#161B22", border: "1px solid #21262D", borderRadius: "10px",
                overflow: "hidden",
              }}>
                {[
                  { label: "Record", value: `${wins}-${losses}` },
                  { label: "Win %", value: winPct !== null ? `${winPct}%` : "—" },
                  {
                    label: "P&L",
                    value: totalPnl >= 0 ? `+${totalPnl.toFixed(1)}u` : `${totalPnl.toFixed(1)}u`,
                    color: totalPnl > 0 ? "#16A34A" : totalPnl < 0 ? "#DC2626" : "#6B7280",
                  },
                ].map((stat, i) => (
                  <div key={stat.label} style={{
                    flex: 1, padding: "10px 8px", textAlign: "center",
                    borderLeft: i > 0 ? "0.5px solid #21262D" : "none",
                  }}>
                    <div style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "3px" }}>{stat.label}</div>
                    <div style={{ fontSize: "15px", fontWeight: 600, color: stat.color ?? "#F1F3F5" }}>{stat.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Pick cards */}
            {filteredPicks.length === 0 ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "13px" }}>
                No picks yet. Click "+ Slip" on any pre-game matchup to add one.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {filteredPicks.map((pick: any) => {
                  const meta = resultMeta[pick.result] ?? resultMeta.pending;
                  const unit = pick.unit_size ?? 1;
                  const pnl = calcPnl(pick);
                  const projWin = pick.pick_odds > 0
                    ? unit * (pick.pick_odds / 100)
                    : unit * (100 / Math.abs(pick.pick_odds));
                  const isLocked = pick.result !== "pending";

                  return (
                    <div key={pick.id} style={{
                      background: "#161B22",
                      border: "1px solid #21262D",
                      borderRadius: "10px",
                      padding: "12px 14px",
                    }}>
                      {/* Row 1: matchup + date + delete */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                        <div>
                          <span style={{ fontSize: "13px", fontWeight: 500, color: "#F1F3F5" }}>
                            {pick.away_team} @ {pick.home_team}
                          </span>
                          <span style={{ fontSize: "11px", color: "#4B5563", marginLeft: "8px" }}>
                            {new Date(pick.game_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                        {!isLocked && (
                          <button
                            onClick={async () => {
                              if (!currentUser) return;
                              setMyPicks(prev => prev ? prev.filter((p: any) => p.id !== pick.id) : prev);
                              await deletePick(pick.id, currentUser.id);
                            }}
                            style={{
                              background: "transparent", border: "none", cursor: "pointer",
                              color: "#4B5563", fontSize: "16px", lineHeight: 1, padding: "0 2px",
                            }}
                            title="Delete pick"
                          >×</button>
                        )}
                      </div>

                      {/* Row 2: pick + odds + unit input */}
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "12px", color: "#6B7280" }}>Pick:</span>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "#F1F3F5" }}>{pick.picked_team}</span>
                        <span style={{ fontSize: "13px", color: "#9CA3AF" }}>
                          {pick.pick_odds > 0 ? `+${pick.pick_odds}` : pick.pick_odds}
                        </span>
                        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "11px", color: "#6B7280" }}>Units:</span>
                          {isLocked ? (
                            <span style={{ fontSize: "12px", color: "#6B7280" }}>
                              🔒 {pick.unit_size ?? "—"}u
                            </span>
                          ) : (
                            <input
                              type="number"
                              min="0.1"
                              step="0.5"
                              defaultValue={unit}
                              onBlur={async (e) => {
                                if (!currentUser) return;
                                const val = parseFloat(e.target.value);
                                if (isNaN(val) || val <= 0) return;
                                setMyPicks(prev => prev
                                  ? prev.map((p: any) => p.id === pick.id ? { ...p, unit_size: val } : p)
                                  : prev
                                );
                                await updateUnitSize(pick.id, currentUser.id, val);
                              }}
                              style={{
                                width: "52px", padding: "3px 6px", borderRadius: "5px",
                                background: "#0D1117", border: "0.5px solid #21262D",
                                color: "#F1F3F5", fontSize: "12px", textAlign: "center",
                              }}
                            />
                          )}
                        </div>
                      </div>

                      {/* Row 3: status + lock badge + P&L */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{
                            fontSize: "12px", fontWeight: 600, color: meta.color,
                            background: `${meta.color}18`, padding: "2px 8px",
                            borderRadius: "4px", border: `0.5px solid ${meta.color}40`,
                          }}>
                            {meta.label}
                          </span>
                          {isLocked && (
                            <span style={{ fontSize: "11px", color: "#6B7280" }}>🔒 Locked</span>
                          )}
                        </div>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: pnl !== null ? (pnl >= 0 ? "#16A34A" : "#DC2626") : "#6B7280" }}>
                          {pnl !== null
                            ? (pnl >= 0 ? `+${pnl.toFixed(2)}u` : `${pnl.toFixed(2)}u`)
                            : `proj +${projWin.toFixed(2)}u`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Parlays ── */}
            {(() => {
              if (myParlays === null) return (
                <div style={{ marginTop: "24px", textAlign: "center", color: "#6B7280", fontSize: "13px" }}>Loading parlays…</div>
              );
              const cutoff2 = cutoffDate(timeFilter);
              const filteredParlays = cutoff2
                ? myParlays.filter((p: any) => {
                    const earliest = (p.legs as any[]).reduce((min: string, l: any) => l.gameDate < min ? l.gameDate : min, p.legs[0]?.gameDate ?? "");
                    return earliest >= cutoff2;
                  })
                : myParlays;
              if (filteredParlays.length === 0) return null;
              return (
                <div style={{ marginTop: "24px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase", marginBottom: "8px" }}>
                    Parlays
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {filteredParlays.map((parlay: any) => {
                      const meta = resultMeta[parlay.result] ?? resultMeta.pending;
                      const unit = parlay.unit_size ?? 1;
                      const odds = parlay.calculated_odds;
                      const pnl = parlay.result === "win"
                        ? (odds > 0 ? unit * (odds / 100) : unit * (100 / Math.abs(odds)))
                        : parlay.result === "loss" ? -unit : null;
                      const projWin = odds > 0 ? unit * (odds / 100) : unit * (100 / Math.abs(odds));
                      const oddsStr = odds > 0 ? `+${odds}` : `${odds}`;
                      const legs: any[] = parlay.legs ?? [];
                      const isParlayLocked = parlay.result !== "pending";
                      return (
                        <div key={parlay.id} style={{ background: "#161B22", border: "1px solid #21262D", borderRadius: "10px", padding: "12px 14px" }}>
                          {/* Header */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                            <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", color: "#EA6C0A", textTransform: "uppercase" }}>
                              Parlay · {legs.length} legs · {oddsStr}
                            </span>
                            {!isParlayLocked && (
                              <button
                                onClick={async () => {
                                  if (!currentUser) return;
                                  setMyParlays(prev => prev ? prev.filter((p: any) => p.id !== parlay.id) : prev);
                                  await deleteParlay(parlay.id, currentUser.id);
                                }}
                                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#4B5563", fontSize: "16px", lineHeight: 1, padding: "0 2px" }}
                                title="Delete parlay"
                              >×</button>
                            )}
                          </div>
                          {/* Legs list */}
                          <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginBottom: "10px" }}>
                            {legs.map((leg: any, i: number) => (
                              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#9CA3AF" }}>
                                <span style={{ fontWeight: 500, color: "#F1F3F5" }}>{leg.pickedTeam}</span>
                                <span>{leg.odds > 0 ? `+${leg.odds}` : leg.odds}</span>
                              </div>
                            ))}
                          </div>
                          {/* Unit + status + P&L */}
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "11px", color: "#6B7280" }}>Units:</span>
                            {isParlayLocked ? (
                              <span style={{ fontSize: "12px", color: "#6B7280" }}>🔒 {parlay.unit_size ?? "—"}u</span>
                            ) : (
                              <input
                                type="number"
                                min="0.1"
                                step="0.5"
                                defaultValue={unit}
                                onBlur={async (e) => {
                                  if (!currentUser) return;
                                  const val = parseFloat(e.target.value);
                                  if (isNaN(val) || val <= 0) return;
                                  setMyParlays(prev => prev ? prev.map((p: any) => p.id === parlay.id ? { ...p, unit_size: val } : p) : prev);
                                  await updateParlayUnit(parlay.id, currentUser.id, val);
                                }}
                                style={{ width: "52px", padding: "3px 6px", borderRadius: "5px", background: "#0D1117", border: "0.5px solid #21262D", color: "#F1F3F5", fontSize: "12px", textAlign: "center" }}
                              />
                            )}
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{
                                fontSize: "12px", fontWeight: 600, color: meta.color,
                                background: `${meta.color}18`, padding: "2px 8px",
                                borderRadius: "4px", border: `0.5px solid ${meta.color}40`,
                              }}>{meta.label}</span>
                              {isParlayLocked && (
                                <span style={{ fontSize: "11px", color: "#6B7280" }}>🔒 Locked</span>
                              )}
                            </div>
                            <span style={{ marginLeft: "auto", fontSize: "13px", fontWeight: 600, color: pnl !== null ? (pnl >= 0 ? "#16A34A" : "#DC2626") : "#6B7280" }}>
                              {pnl !== null
                                ? (pnl >= 0 ? `+${pnl.toFixed(2)}u` : `${pnl.toFixed(2)}u`)
                                : `proj +${projWin.toFixed(2)}u`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* Bet slip modal */}
      {slipModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => { setSlipModal(null); setModalUnit(''); setCustomOdds(null); }}
        >
          <div
            style={{ background: "#1A2236", border: "0.5px solid var(--color-border-secondary)", borderRadius: "12px", padding: "24px", width: "360px", maxWidth: "90vw" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: "11px", color: "var(--color-text-secondary)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Add to slip</div>
            <div style={{ fontSize: "15px", fontWeight: 600, marginBottom: "20px" }}>
              {slipModal.game.awayTeam} @ {slipModal.game.homeTeam}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "20px" }}>
              {(["away", "home"] as const).map(side => {
                const team = side === "away" ? slipModal.game.awayTeam : slipModal.game.homeTeam;
                const best = getBest(slipModal.game, side);
                const isSelected = slipModal.selectedSide === side;
                return (
                  <button key={side} onClick={() => { setSlipModal(m => m ? { ...m, selectedSide: side } : null); setCustomOdds(getBest(slipModal.game, side)?.price ?? null); }} style={{
                    padding: "12px", borderRadius: "8px", cursor: "pointer", textAlign: "center",
                    border: isSelected ? "1.5px solid #EA6C0A" : "0.5px solid var(--color-border-secondary)",
                    background: isSelected ? "#EA6C0A15" : "transparent", color: "#F1F3F5",
                  }}>
                    <div style={{ fontSize: "12px", fontWeight: 500, marginBottom: "4px" }}>{team}</div>
                    <div style={{ fontSize: "15px", fontWeight: 600, color: isSelected ? "#EA6C0A" : "#9CA3AF" }}>
                      {best ? (best.price > 0 ? `+${best.price}` : `${best.price}`) : "—"}
                    </div>
                    {best && <div style={{ fontSize: "10px", color: "#6B7280", marginTop: "2px" }}>{BOOK_LABELS[best.bookmaker] ?? best.bookmaker}</div>}
                  </button>
                );
              })}
            </div>

            {/* Custom odds input */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <span style={{ fontSize: "12px", color: "var(--color-text-secondary)", flex: 1 }}>Odds</span>
              <input
                type="number"
                value={customOdds ?? ""}
                placeholder={String(getBest(slipModal.game, slipModal.selectedSide)?.price ?? "—")}
                onChange={e => {
                  const v = parseInt(e.target.value, 10);
                  setCustomOdds(isNaN(v) ? null : v);
                }}
                style={{
                  width: "88px", padding: "6px 8px", borderRadius: "6px",
                  background: "#0D1117", border: "0.5px solid var(--color-border-secondary)",
                  color: "#F1F3F5", fontSize: "14px", textAlign: "center",
                }}
              />
            </div>

            {/* Unit size input */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <span style={{ fontSize: "12px", color: "var(--color-text-secondary)", flex: 1 }}>Unit size</span>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={modalUnit}
                placeholder="e.g. 1.5"
                onChange={e => setModalUnit(e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
                style={{
                  width: "72px", padding: "6px 8px", borderRadius: "6px",
                  background: "#0D1117", border: "0.5px solid var(--color-border-secondary)",
                  color: "#F1F3F5", fontSize: "14px", textAlign: "center",
                }}
              />
            </div>

            <button
              disabled={savingPick}
              onClick={async () => {
                if (!currentUser || savingPick) return;
                setSavingPick(true);
                const side = slipModal.selectedSide;
                const pickedTeam = side === "home" ? slipModal.game.homeTeam : slipModal.game.awayTeam;
                const best = getBest(slipModal.game, side);
                const finalOdds = customOdds ?? best?.price ?? 0;
                const result = await savePick({
                  userId: currentUser.id,
                  gameDate: date,
                  externalGameId: slipModal.game.id ?? null,
                  awayTeam: slipModal.game.awayTeam,
                  homeTeam: slipModal.game.homeTeam,
                  sportKey: slipModal.game.sportKey,
                  pickedTeam,
                  pickOdds: finalOdds,
                  unitSize: modalUnit === '' ? undefined : Number(modalUnit),
                });
                setSavingPick(false);
                if (result.ok) {
                  setSlipModal(null);
                  setModalUnit('');
                  setCustomOdds(null);
                  setMyPicks(null);
                }
              }}
              style={{
                width: "100%", padding: "12px", borderRadius: "8px",
                cursor: savingPick ? "not-allowed" : "pointer",
                background: "#EA6C0A", border: "none", color: "#fff",
                fontSize: "14px", fontWeight: 600, opacity: savingPick ? 0.6 : 1,
              }}
            >
              {savingPick ? "Saving..." : "Add to Slip"}
            </button>
            <button
              onClick={() => {
                const side = slipModal.selectedSide;
                const pickedTeam = side === "home" ? slipModal.game.homeTeam : slipModal.game.awayTeam;
                const odds = customOdds ?? getBest(slipModal.game, side)?.price ?? 0;
                const alreadyAdded = parlayLegs.some(l => l.gameId === slipModal.game.id);
                if (alreadyAdded) { alert("This game is already in your parlay"); return; }
                if (parlayLegs.length >= 15) { alert("Maximum 15 legs allowed"); return; }
                setParlayLegs(prev => [...prev, {
                  gameId: slipModal.game.id,
                  awayTeam: slipModal.game.awayTeam,
                  homeTeam: slipModal.game.homeTeam,
                  sportKey: slipModal.game.sportKey,
                  gameDate: slipModal.game.gameDate ?? date,
                  pickedTeam,
                  odds,
                }]);
                setShowParlayTray(true);
                setParlayTrayExpanded(true);
                setSlipModal(null);
                setCustomOdds(null);
                setModalUnit('');
              }}
              style={{
                width: "100%", padding: "10px", marginTop: "8px", borderRadius: "8px",
                border: "1px solid #EA6C0A80", background: "transparent",
                color: "#EA6C0A", fontSize: "14px", cursor: "pointer",
              }}
            >
              + Add to Parlay ({parlayLegs.length} leg{parlayLegs.length !== 1 ? "s" : ""})
            </button>
            <button onClick={() => { setSlipModal(null); setModalUnit(''); setCustomOdds(null); }} style={{
              width: "100%", padding: "8px", marginTop: "8px", borderRadius: "8px",
              cursor: "pointer", background: "transparent", border: "none",
              color: "var(--color-text-secondary)", fontSize: "13px",
            }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Parlay tray */}
      {showParlayTray && parlayLegs.length > 0 && (() => {
        const parlayOdds = calcParlayOdds(parlayLegs);
        const parlayOddsStr = parlayOdds > 0 ? `+${parlayOdds}` : `${parlayOdds}`;
        const unit = parlayUnit === '' ? 1 : Number(parlayUnit);
        const toWin = parlayOdds > 0
          ? unit * (parlayOdds / 100)
          : unit * (100 / Math.abs(parlayOdds));
        return (
          <div style={{
            position: "fixed",
            bottom: 60,
            left: 0,
            right: 0,
            zIndex: 900,
            background: "#161B22",
            borderTop: "1px solid #EA6C0A40",
            boxShadow: "0 -4px 20px rgba(0,0,0,0.4)",
          }}>
            <style>{`
              @media (min-width: 768px) {
                .parlay-tray-inner {
                  max-width: 480px !important;
                  margin-left: auto !important;
                  margin-right: 0 !important;
                  border-left: 1px solid #EA6C0A40 !important;
                  bottom: 0 !important;
                }
              }
            `}</style>
            <div className="parlay-tray-inner" style={{ padding: "12px 16px" }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: parlayTrayExpanded ? "12px" : 0 }}>
                <button
                  onClick={() => setParlayTrayExpanded(x => !x)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#EA6C0A", fontSize: "13px", fontWeight: 700, letterSpacing: "0.05em", padding: 0 }}
                >
                  {parlayTrayExpanded ? "▼" : "▲"} PARLAY ({parlayLegs.length} leg{parlayLegs.length !== 1 ? "s" : ""}) · {parlayOddsStr}
                </button>
                <button
                  onClick={() => { setParlayLegs([]); setShowParlayTray(false); setParlayUnit(''); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7280", fontSize: "18px", lineHeight: 1 }}
                  title="Clear parlay"
                >×</button>
              </div>

              {parlayTrayExpanded && (
                <>
                  {/* Legs */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
                    {parlayLegs.map((leg, i) => (
                      <div key={leg.gameId} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                        <span style={{ flex: 1, color: "#F1F3F5", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {leg.pickedTeam}
                        </span>
                        <input
                          type="number"
                          defaultValue={leg.odds}
                          onBlur={e => {
                            const v = parseInt(e.target.value, 10);
                            if (isNaN(v)) return;
                            setParlayLegs(prev => prev.map((l, j) => j === i ? { ...l, odds: v } : l));
                          }}
                          style={{
                            width: "68px", padding: "3px 6px", borderRadius: "5px",
                            background: "#0D1117", border: "0.5px solid #21262D",
                            color: "#F1F3F5", fontSize: "12px", textAlign: "center",
                          }}
                        />
                        <button
                          onClick={() => {
                            const next = parlayLegs.filter((_, j) => j !== i);
                            setParlayLegs(next);
                            if (next.length === 0) { setShowParlayTray(false); setParlayUnit(''); }
                          }}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7280", fontSize: "16px", lineHeight: 1 }}
                        >×</button>
                      </div>
                    ))}
                  </div>

                  {/* Unit + to-win */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "12px", color: "#6B7280" }}>Units</span>
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={parlayUnit}
                        placeholder="1"
                        onChange={e => setParlayUnit(e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
                        style={{
                          width: "60px", padding: "4px 6px", borderRadius: "5px",
                          background: "#0D1117", border: "0.5px solid #21262D",
                          color: "#F1F3F5", fontSize: "13px", textAlign: "center",
                        }}
                      />
                    </div>
                    <span style={{ fontSize: "12px", color: "#6B7280" }}>
                      To win: <span style={{ color: "#16A34A", fontWeight: 600 }}>{toWin.toFixed(2)}u</span>
                    </span>
                    <button
                      onClick={() => setParlayTrayExpanded(false)}
                      style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#6B7280", fontSize: "12px" }}
                    >
                      Add More
                    </button>
                  </div>

                  {/* Lock in */}
                  <button
                    disabled={savingParlay || parlayLegs.length < 2}
                    onClick={async () => {
                      if (!currentUser || savingParlay || parlayLegs.length < 2) return;
                      setSavingParlay(true);
                      const result = await saveParlay({
                        userId: currentUser.id,
                        legs: parlayLegs,
                        calculatedOdds: parlayOdds,
                        unitSize: parlayUnit === '' ? undefined : Number(parlayUnit),
                      });
                      setSavingParlay(false);
                      if (result.ok) {
                        setParlayLegs([]);
                        setShowParlayTray(false);
                        setParlayUnit('');
                        setMyParlays(null);
                      } else {
                        alert(result.error ?? "Failed to save parlay");
                      }
                    }}
                    style={{
                      width: "100%", padding: "10px", borderRadius: "8px",
                      background: parlayLegs.length < 2 ? "#21262D" : "#EA6C0A",
                      border: "none", color: parlayLegs.length < 2 ? "#6B7280" : "#fff",
                      fontSize: "14px", fontWeight: 600,
                      cursor: parlayLegs.length < 2 || savingParlay ? "not-allowed" : "pointer",
                      opacity: savingParlay ? 0.6 : 1,
                    }}
                  >
                    {savingParlay ? "Saving…" : parlayLegs.length < 2 ? "Add 2+ legs to lock in" : "Lock in Parlay"}
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* Mobile bottom tab bar */}
      <nav className="mobile-bottom-nav">
        <a href="/betting" className="mobile-tab active">
          <span>📊</span>
          <span>Betting</span>
        </a>
        <a href="/fantasy/golf" className="mobile-tab">
          <span>🏆</span>
          <span>Fantasy</span>
        </a>
        <a href="/betting?tab=picks" className="mobile-tab">
          <span>⭐</span>
          <span>My Picks</span>
        </a>
      </nav>
    </div>
    </>
  );
}
