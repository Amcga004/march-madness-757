"use client";
import { useState } from "react";
import type { PitcherProjection, BatterProjection, GameProps, NBAGameInfo, NHLGameInfo } from "./page";

interface Props {
  date: string;
  mlbGameProps: GameProps[];
  nbaGames: NBAGameInfo[];
  nhlGames: NHLGameInfo[];
}

function pct(v: number | null, decimals = 1): string {
  if (v == null) return "—";
  return (v * 100).toFixed(decimals) + "%";
}

function fmt(v: number | null, decimals = 2): string {
  if (v == null) return "—";
  return v.toFixed(decimals);
}

function ProjPill({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <span style={{
      display: "inline-flex", flexDirection: "column", alignItems: "center",
      background: highlight ? "#1A2B1A" : "#161B22",
      border: `1px solid ${highlight ? "#22C55E44" : "#21262D"}`,
      borderRadius: "8px", padding: "4px 8px", gap: "1px", minWidth: "40px",
    }}>
      <span style={{ fontSize: "12px", fontWeight: 700, color: highlight ? "#4ADE80" : "#F1F3F5" }}>{value}</span>
      <span style={{ fontSize: "9px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
    </span>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #21262D22" }}>
      <span style={{ fontSize: "11px", color: "#6B7280" }}>{label}</span>
      <span style={{ fontSize: "11px", color: "#C9D1D9", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function PitcherCard({ pitcher, label, f5WinProb }: { pitcher: any; label: string; f5WinProb: number | null }) {
  const [expanded, setExpanded] = useState(false);
  const wl = (pitcher.wins != null && pitcher.losses != null) ? `${pitcher.wins}-${pitcher.losses}` : null;

  return (
    <div style={{ background: "#161B22", border: "1px solid #21262D", borderRadius: "10px", marginBottom: "8px", overflow: "hidden" }}>
      <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }} onClick={() => setExpanded(e => !e)}>
        <div>
          <div style={{ fontSize: "9px", color: "#6B7280", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>{label}</div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "1px" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#F1F3F5" }}>{pitcher.name}</span>
            {wl && <span style={{ fontSize: "10px", color: "#6B7280" }}>{wl}</span>}
            {pitcher.era && <span style={{ fontSize: "10px", color: "#6B7280" }}>ERA {pitcher.era}</span>}
            {pitcher.whip && <span style={{ fontSize: "10px", color: "#6B7280" }}>WHIP {pitcher.whip}</span>}
          </div>
        </div>
        <span style={{ fontSize: "11px", color: "#4B5563" }}>{expanded ? "▴" : "▾"}</span>
      </div>

      <div style={{ padding: "0 12px 10px", display: "flex", gap: "6px", flexWrap: "wrap" as const }}>
        <div style={{ background: "#0D1117", borderRadius: "6px", padding: "5px 10px", textAlign: "center" as const, minWidth: "52px" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#EA6C0A" }}>{pitcher.projectedKs != null ? pitcher.projectedKs.toFixed(1) : "—"}</div>
          <div style={{ fontSize: "9px", color: "#4B5563", textTransform: "uppercase" as const }}>Proj K</div>
        </div>
        <div style={{ background: "#0D1117", borderRadius: "6px", padding: "5px 10px", textAlign: "center" as const, minWidth: "52px" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#F1F3F5" }}>{pitcher.projectedHits != null ? pitcher.projectedHits.toFixed(1) : "—"}</div>
          <div style={{ fontSize: "9px", color: "#4B5563", textTransform: "uppercase" as const }}>Proj H</div>
        </div>
        <div style={{ background: "#0D1117", borderRadius: "6px", padding: "5px 10px", textAlign: "center" as const, minWidth: "52px" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#F1F3F5" }}>{pitcher.projectedER != null ? pitcher.projectedER.toFixed(1) : "—"}</div>
          <div style={{ fontSize: "9px", color: "#4B5563", textTransform: "uppercase" as const }}>Proj ER</div>
        </div>
        {f5WinProb != null && (
          <div style={{ background: "#0D1117", borderRadius: "6px", padding: "5px 10px", textAlign: "center" as const, minWidth: "52px" }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: f5WinProb >= 0.55 ? "#16A34A" : "#F1F3F5" }}>{(f5WinProb * 100).toFixed(0)}%</div>
            <div style={{ fontSize: "9px", color: "#4B5563", textTransform: "uppercase" as const }}>F5 Win</div>
          </div>
        )}
      </div>

      {expanded && (
        <div style={{ padding: "8px 12px 12px", borderTop: "0.5px solid #21262D" }}>
          <div style={{ fontSize: "9px", color: "#4B5563", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: "6px" }}>Advanced Stats</div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" as const }}>
            {pitcher.xfip != null && <div style={{ background: "#0D1117", borderRadius: "5px", padding: "4px 8px", fontSize: "11px", color: "#9CA3AF" }}>xFIP <span style={{ color: "#F1F3F5", fontWeight: 600 }}>{pitcher.xfip.toFixed(2)}</span></div>}
            {pitcher.kPct != null && <div style={{ background: "#0D1117", borderRadius: "5px", padding: "4px 8px", fontSize: "11px", color: "#9CA3AF" }}>K% <span style={{ color: "#F1F3F5", fontWeight: 600 }}>{(pitcher.kPct * 100).toFixed(1)}%</span></div>}
            {pitcher.bbPct != null && <div style={{ background: "#0D1117", borderRadius: "5px", padding: "4px 8px", fontSize: "11px", color: "#9CA3AF" }}>BB% <span style={{ color: "#F1F3F5", fontWeight: 600 }}>{(pitcher.bbPct * 100).toFixed(1)}%</span></div>}
            {pitcher.swStrPct != null && <div style={{ background: "#0D1117", borderRadius: "5px", padding: "4px 8px", fontSize: "11px", color: "#9CA3AF" }}>SwStr% <span style={{ color: "#F1F3F5", fontWeight: 600 }}>{(pitcher.swStrPct * 100).toFixed(1)}%</span></div>}
            {pitcher.hr9 != null && <div style={{ background: "#0D1117", borderRadius: "5px", padding: "4px 8px", fontSize: "11px", color: "#9CA3AF" }}>HR/9 <span style={{ color: "#F1F3F5", fontWeight: 600 }}>{pitcher.hr9.toFixed(2)}</span></div>}
            {pitcher.inningsPitched && <div style={{ background: "#0D1117", borderRadius: "5px", padding: "4px 8px", fontSize: "11px", color: "#9CA3AF" }}>IP <span style={{ color: "#F1F3F5", fontWeight: 600 }}>{pitcher.inningsPitched}</span></div>}
            {pitcher.strikeOuts != null && <div style={{ background: "#0D1117", borderRadius: "5px", padding: "4px 8px", fontSize: "11px", color: "#9CA3AF" }}>K <span style={{ color: "#F1F3F5", fontWeight: 600 }}>{pitcher.strikeOuts}</span></div>}
          </div>
          <p style={{ fontSize: "10px", color: "#4B5563", margin: "8px 0 0", lineHeight: 1.5 }}>
            Projections use season K%, xFIP, and opposing lineup profile. F5 uses xFIP differential only.
          </p>
        </div>
      )}
    </div>
  );
}

function BatterRow({ batter }: { batter: BatterProjection }) {
  return (
    <details style={{ borderBottom: "1px solid #21262D22" }}>
      <summary style={{ padding: "8px 10px", cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ fontSize: "10px", color: "#4B5563", minWidth: "18px", textAlign: "right" }}>#{batter.slot}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ fontSize: "12px", color: "#F1F3F5", fontWeight: 600 }}>{batter.name}</span>
            {batter.isProjected && <span style={{ fontSize: "9px", color: "#4B5563" }}>*</span>}
            <span style={{ fontSize: "10px", color: "#4B5563", marginLeft: "2px" }}>{batter.position}</span>
          </div>
          <div style={{ display: "flex", gap: "6px", marginTop: "2px", flexWrap: "wrap" as const }}>
            {batter.xwoba != null && (
              <span style={{ fontSize: "9px", color: "#6B7280" }}>xwOBA <span style={{ color: "#9CA3AF", fontWeight: 600 }}>{batter.xwoba.toFixed(3)}</span></span>
            )}
            {batter.seasonAVG && (
              <span style={{ fontSize: "9px", color: "#6B7280" }}>AVG <span style={{ color: "#9CA3AF", fontWeight: 600 }}>{batter.seasonAVG}</span></span>
            )}
            {batter.seasonHR != null && (
              <span style={{ fontSize: "9px", color: "#6B7280" }}>HR <span style={{ color: "#9CA3AF", fontWeight: 600 }}>{batter.seasonHR}</span></span>
            )}
            {batter.seasonRBI != null && (
              <span style={{ fontSize: "9px", color: "#6B7280" }}>RBI <span style={{ color: "#9CA3AF", fontWeight: 600 }}>{batter.seasonRBI}</span></span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: "4px" }}>
          <ProjPill label="TB" value={fmt(batter.projectedTotalBases, 1)} />
          <ProjPill label="HR%" value={batter.hrProb != null ? pct(batter.hrProb, 1) : "—"} />
          <ProjPill label="RBI%" value={batter.rbiProb != null ? pct(batter.rbiProb, 0) : "—"} />
        </div>
      </summary>
      <div style={{ padding: "6px 10px 10px 34px", background: "#0D1117" }}>
        <StatRow label="xwOBA" value={fmt(batter.xwoba, 3)} />
        <StatRow label="xSLG" value={fmt(batter.xslg, 3)} />
        <StatRow label="Barrel%" value={batter.barrelPct != null ? batter.barrelPct.toFixed(1) + "%" : "—"} />
        <StatRow label="Hard Hit%" value={batter.hardHitPct != null ? batter.hardHitPct.toFixed(1) + "%" : "—"} />
        <StatRow label="Exit Velo" value={batter.exitVelo != null ? batter.exitVelo.toFixed(1) + " mph" : "—"} />
      </div>
    </details>
  );
}

function GameCard({ game }: { game: GameProps }) {
  const [expanded, setExpanded] = useState(false);
  const [showHome, setShowHome] = useState(true);
  const activeLineup = showHome ? game.homeLineup : game.awayLineup;
  const activeTeam = showHome ? game.homeTeam : game.awayTeam;
  const activePitcher = showHome ? game.homePitcher : game.awayPitcher;
  const activeF5WinProb = showHome
    ? game.homeF5WinProb
    : game.homeF5WinProb != null ? 1 - game.homeF5WinProb : null;

  const homeShort = game.homeTeam.split(" ").pop() ?? game.homeTeam;
  const awayShort = game.awayTeam.split(" ").pop() ?? game.awayTeam;

  const homeWinProb = game.consensusHomeWinProb != null ? game.consensusHomeWinProb * 100 : null;
  const awayWinProb = game.consensusAwayWinProb != null ? game.consensusAwayWinProb * 100 : null;
  const favoredWinTeam = homeWinProb != null && awayWinProb != null
    ? (homeWinProb >= awayWinProb ? homeShort : awayShort) : null;
  const favoredWinProb = homeWinProb != null && awayWinProb != null
    ? Math.max(homeWinProb, awayWinProb) : null;

  const homeF5 = game.homeF5WinProb != null ? game.homeF5WinProb * 100 : null;
  const awayF5 = game.homeF5WinProb != null ? (1 - game.homeF5WinProb) * 100 : null;
  const favoredF5Team = homeF5 != null && awayF5 != null
    ? (homeF5 >= awayF5 ? homeShort : awayShort) : null;
  const favoredF5Prob = homeF5 != null && awayF5 != null ? Math.max(homeF5, awayF5) : null;

  const nrfiProb = game.yrfiProb != null ? (1 - game.yrfiProb) * 100 : null;

  function statBoxColor(p: number): string {
    return p >= 60 ? "#16A34A" : p >= 50 ? "#D97706" : "#DC2626";
  }

  const edgeTierColors: Record<string, string> = {
    strong_value: "#16A34A",
    good_value: "#D97706",
    lean: "#6B7280",
    no_edge: "#4B5563",
  };

  return (
    <div style={{ background: "#161B22", border: "1px solid #21262D", borderRadius: "12px", marginBottom: "10px", overflow: "hidden" }}>
      {/* Collapsed header — always visible */}
      <div style={{ padding: "14px 16px", cursor: "pointer" }} onClick={() => setExpanded(e => !e)}>

        {/* Row 1: Team logos + names + records + time */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
              {game.awayLogo && (
                <img src={game.awayLogo} alt={awayShort} width={28} height={28} style={{ objectFit: "contain", flexShrink: 0 }} />
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#F1F3F5", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{awayShort}</div>
                {game.awayRecord && <div style={{ fontSize: "10px", color: "#4B5563" }}>{game.awayRecord}</div>}
              </div>
            </div>
            <span style={{ fontSize: "11px", color: "#4B5563", flexShrink: 0 }}>@</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
              {game.homeLogo && (
                <img src={game.homeLogo} alt={homeShort} width={28} height={28} style={{ objectFit: "contain", flexShrink: 0 }} />
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#F1F3F5", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{homeShort}</div>
                {game.homeRecord && <div style={{ fontSize: "10px", color: "#4B5563" }}>{game.homeRecord}</div>}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            <div style={{ fontSize: "11px", color: "#6B7280", textAlign: "right" }}>{game.gameTime}</div>
            <span style={{ fontSize: "16px", color: "#4B5563" }}>{expanded ? "▴" : "▾"}</span>
          </div>
        </div>

        {/* Row 2: Pitchers */}
        {(game.awayPitcher || game.homePitcher) && (
          <div style={{ fontSize: "10px", color: "#4B5563", marginBottom: "10px" }}>
            <span style={{ color: "#6B7280" }}>{game.awayPitcher?.name?.split(" ").pop() ?? "TBD"}</span>
            <span style={{ color: "#374151" }}> vs </span>
            <span style={{ color: "#6B7280" }}>{game.homePitcher?.name?.split(" ").pop() ?? "TBD"}</span>
          </div>
        )}

        {/* Row 3: 3 stat boxes */}
        <div style={{ display: "flex", gap: "8px", marginBottom: game.bestEdgeSignal ? "8px" : "0" }}>
          <div style={{
            flex: 1, background: "#0D1117", borderRadius: "8px", padding: "8px 10px", textAlign: "center",
            border: `1px solid ${favoredWinProb != null ? statBoxColor(favoredWinProb) + "33" : "#21262D"}`,
          }}>
            <div style={{ fontSize: "9px", color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "3px" }}>ML Win</div>
            {favoredWinProb != null ? (
              <>
                <div style={{ fontSize: "17px", fontWeight: 800, color: statBoxColor(favoredWinProb), lineHeight: 1 }}>{favoredWinProb.toFixed(0)}%</div>
                <div style={{ fontSize: "9px", color: "#6B7280", marginTop: "2px" }}>{favoredWinTeam}</div>
              </>
            ) : <div style={{ fontSize: "13px", color: "#374151" }}>—</div>}
          </div>

          <div style={{
            flex: 1, background: "#0D1117", borderRadius: "8px", padding: "8px 10px", textAlign: "center",
            border: `1px solid ${favoredF5Prob != null ? statBoxColor(favoredF5Prob) + "33" : "#21262D"}`,
          }}>
            <div style={{ fontSize: "9px", color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "3px" }}>F5 Win</div>
            {favoredF5Prob != null ? (
              <>
                <div style={{ fontSize: "17px", fontWeight: 800, color: statBoxColor(favoredF5Prob), lineHeight: 1 }}>{favoredF5Prob.toFixed(0)}%</div>
                <div style={{ fontSize: "9px", color: "#6B7280", marginTop: "2px" }}>{favoredF5Team}</div>
              </>
            ) : <div style={{ fontSize: "13px", color: "#374151" }}>—</div>}
          </div>

          <div style={{
            flex: 1, background: "#0D1117", borderRadius: "8px", padding: "8px 10px", textAlign: "center",
            border: `1px solid ${nrfiProb != null ? statBoxColor(nrfiProb) + "33" : "#21262D"}`,
          }}>
            <div style={{ fontSize: "9px", color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "3px" }}>NRFI</div>
            {nrfiProb != null ? (
              <>
                <div style={{ fontSize: "17px", fontWeight: 800, color: statBoxColor(nrfiProb), lineHeight: 1 }}>{nrfiProb.toFixed(0)}%</div>
                <div style={{ fontSize: "9px", color: nrfiProb >= 55 ? "#16A34A" : nrfiProb <= 45 ? "#DC2626" : "#D97706", marginTop: "2px" }}>
                  {nrfiProb >= 55 ? "Lean NO" : nrfiProb <= 45 ? "Lean YES" : "Pick 'em"}
                </div>
              </>
            ) : <div style={{ fontSize: "13px", color: "#374151" }}>—</div>}
          </div>
        </div>

        {/* Row 4: Edge signal */}
        {game.bestEdgeSignal && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 8px", background: "#0D1117", borderRadius: "6px" }}>
            <span style={{ fontSize: "10px", fontWeight: 700, color: edgeTierColors[game.bestEdgeSignal.tier] ?? "#6B7280" }}>
              {game.bestEdgeSignal.teamName.split(" ").pop()} +{game.bestEdgeSignal.edgePct}% edge
            </span>
            <span style={{ fontSize: "10px", color: "#4B5563" }}>·</span>
            <span style={{ fontSize: "10px", color: edgeTierColors[game.bestEdgeSignal.tier] ?? "#6B7280" }}>
              {game.bestEdgeSignal.tier === "strong_value" ? "Strong value" : game.bestEdgeSignal.tier === "good_value" ? "Good value" : "Lean"}
            </span>
          </div>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ borderTop: "1px solid #21262D", padding: "12px 16px" }}>
          {/* Team toggle */}
          <div style={{ display: "flex", gap: "4px", marginBottom: "14px" }}>
            {(["home", "away"] as const).map(side => {
              const isActive = side === "home" ? showHome : !showHome;
              const label = side === "home" ? homeShort : awayShort;
              const logo = side === "home" ? game.homeLogo : game.awayLogo;
              return (
                <button key={side} onClick={(e) => { e.stopPropagation(); setShowHome(side === "home"); }} style={{
                  padding: "4px 12px", borderRadius: "6px", border: "1px solid #21262D",
                  background: isActive ? "#EA6C0A" : "transparent",
                  color: isActive ? "#fff" : "#6B7280",
                  fontSize: "11px", fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "5px",
                }}>
                  {logo && <img src={logo} alt={label} width={14} height={14} style={{ objectFit: "contain" }} />}
                  {label}
                </button>
              );
            })}
          </div>

          {/* Active pitcher */}
          <div style={{ marginBottom: "12px" }}>
            <div style={{ fontSize: "10px", color: "#EA6C0A", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>Starting Pitcher</div>
            {activePitcher ? (
              <PitcherCard pitcher={activePitcher as any} label={showHome ? "Home SP" : "Away SP"} f5WinProb={activeF5WinProb} />
            ) : (
              <div style={{ fontSize: "11px", color: "#4B5563", padding: "8px 0" }}>No probable pitcher announced</div>
            )}
          </div>

          {/* Active lineup */}
          <div>
            <div style={{ fontSize: "10px", color: "#EA6C0A", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
              Lineup — {activeTeam}
            </div>
            {activeLineup.length > 0 ? (
              <div style={{ background: "#0D1117", borderRadius: "8px", overflow: "hidden", border: "1px solid #21262D" }}>
                {activeLineup.map(b => <BatterRow key={`${b.name}-${b.slot}`} batter={b} />)}
                {activeLineup.some(b => b.isProjected) && (
                  <div style={{ fontSize: "10px", color: "#4B5563", padding: "8px 10px", borderTop: "0.5px solid #21262D" }}>
                    * Projected lineup based on season PA — official lineup not yet posted
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: "11px", color: "#4B5563", padding: "8px 0" }}>Lineups not yet posted</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ComingSoon({ sport }: { sport: string }) {
  return (
    <div style={{ textAlign: "center", padding: "64px 16px", color: "#4B5563" }}>
      <div style={{ fontSize: "13px", fontWeight: 600, color: "#6B7280" }}>{sport} Props</div>
      <div style={{ fontSize: "11px", marginTop: "6px" }}>Coming soon</div>
    </div>
  );
}

export default function PropsClient({ date, mlbGameProps, nbaGames, nhlGames }: Props) {
  const [sport, setSport] = useState<"MLB" | "NBA" | "NHL">("MLB");

  const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });

  const counts = { MLB: mlbGameProps.length, NBA: nbaGames.length, NHL: nhlGames.length };

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto", padding: "16px", background: "#0D1117", minHeight: "100vh", color: "#F1F3F5", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ marginBottom: "16px" }}>
        <a href="/betting" style={{ fontSize: "12px", color: "#6B7280", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px", marginBottom: "10px" }}>
          ← Betting
        </a>
        <div style={{ fontSize: "18px", fontWeight: 700, color: "#F1F3F5" }}>Props Board</div>
        <div style={{ fontSize: "12px", color: "#6B7280" }}>{dateLabel}</div>
      </div>

      {/* Sport tabs */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
        {(["MLB", "NBA", "NHL"] as const).map(s => (
          <button
            key={s}
            onClick={() => setSport(s)}
            style={{
              padding: "6px 14px", borderRadius: "8px", border: "1px solid #21262D",
              background: sport === s ? "#EA6C0A" : "#161B22",
              color: sport === s ? "#fff" : "#6B7280",
              fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "5px",
            }}
          >
            {s}
            <span style={{ fontSize: "10px", color: sport === s ? "#FFD580" : "#4B5563" }}>{counts[s]}</span>
          </button>
        ))}
      </div>

      {sport === "MLB" && (
        mlbGameProps.length > 0
          ? mlbGameProps.map(game => <GameCard key={game.gameId} game={game} />)
          : <div style={{ textAlign: "center", padding: "48px 16px", color: "#4B5563", fontSize: "13px" }}>No MLB games today</div>
      )}
      {sport === "NBA" && <ComingSoon sport="NBA" />}
      {sport === "NHL" && <ComingSoon sport="NHL" />}
    </div>
  );
}
