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

function PitcherCard({ pitcher, label, f5WinProb }: { pitcher: PitcherProjection; label: string; f5WinProb: number | null }) {
  return (
    <details style={{ background: "#161B22", border: "1px solid #21262D", borderRadius: "10px", marginBottom: "8px", overflow: "hidden" }}>
      <summary style={{ padding: "10px 12px", cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <div>
          <div style={{ fontSize: "9px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "#F1F3F5", marginTop: "1px" }}>{pitcher.name}</div>
        </div>
        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <ProjPill label="Proj K" value={fmt(pitcher.projectedKs, 1)} />
          <ProjPill label="Proj H" value={fmt(pitcher.projectedHits, 1)} />
          <ProjPill label="Proj ER" value={fmt(pitcher.projectedER, 1)} />
          {f5WinProb != null && (
            <ProjPill label="F5 Win" value={pct(f5WinProb, 0)} highlight={f5WinProb >= 0.55} />
          )}
        </div>
      </summary>
      <div style={{ padding: "8px 12px 12px", borderTop: "1px solid #21262D" }}>
        <StatRow label="xFIP" value={fmt(pitcher.xfip)} />
        <StatRow label="K%" value={pct(pitcher.kPct)} />
        <StatRow label="BB%" value={pct(pitcher.bbPct)} />
        <StatRow label="SwStr%" value={pct(pitcher.swStrPct)} />
        <StatRow label="HR/9" value={fmt(pitcher.hr9)} />
      </div>
    </details>
  );
}

function BatterRow({ batter }: { batter: BatterProjection }) {
  return (
    <details style={{ borderBottom: "1px solid #21262D22" }}>
      <summary style={{ padding: "8px 10px", cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ fontSize: "10px", color: "#4B5563", minWidth: "18px", textAlign: "right" }}>#{batter.slot}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: "12px", color: "#F1F3F5", fontWeight: 500 }}>{batter.name}</span>
          {batter.isProjected && <span style={{ fontSize: "9px", color: "#4B5563", marginLeft: "3px" }}>*</span>}
          <span style={{ fontSize: "10px", color: "#6B7280", marginLeft: "5px" }}>{batter.position}</span>
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
  const [showHome, setShowHome] = useState(true);
  const activeLineup = showHome ? game.homeLineup : game.awayLineup;
  const activeTeam = showHome ? game.homeTeam : game.awayTeam;
  const activePitcher = showHome ? game.homePitcher : game.awayPitcher;
  const activeF5WinProb = showHome
    ? game.homeF5WinProb
    : game.homeF5WinProb != null ? 1 - game.homeF5WinProb : null;
  const activeLabel = showHome ? "Home SP" : "Away SP";

  const homeShort = game.homeTeam.split(" ").pop() ?? game.homeTeam;
  const awayShort = game.awayTeam.split(" ").pop() ?? game.awayTeam;

  return (
    <details style={{ background: "#0D1117", border: "1px solid #21262D", borderRadius: "12px", marginBottom: "12px", overflow: "hidden" }}>
      <summary style={{ padding: "14px 16px", cursor: "pointer", listStyle: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#F1F3F5" }}>
              {game.awayTeam} <span style={{ color: "#4B5563", fontWeight: 400 }}>@</span> {game.homeTeam}
            </div>
            <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "2px" }}>{game.gameTime}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", flexShrink: 0 }}>
            {/* YRFI — headline prop */}
            {game.yrfiProb != null && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "9px", color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.06em" }}>YRFI</div>
                <div style={{ fontSize: "18px", fontWeight: 800, color: game.yrfiProb > 0.55 ? "#16A34A" : game.yrfiProb < 0.45 ? "#DC2626" : "#D97706", lineHeight: 1 }}>
                  {(game.yrfiProb * 100).toFixed(0)}%
                </div>
                <div style={{ fontSize: "9px", color: "#4B5563", marginTop: "1px" }}>
                  {game.yrfiProb > 0.55 ? "Lean YES" : game.yrfiProb < 0.45 ? "Lean NO" : "Pick 'em"}
                </div>
              </div>
            )}
            {/* F5 secondary */}
            {game.homeF5WinProb != null && (
              <span style={{ fontSize: "10px", color: "#6B7280" }}>
                F5: {homeShort} {pct(game.homeF5WinProb, 0)}
              </span>
            )}
          </div>
        </div>
      </summary>

      <div style={{ borderTop: "1px solid #21262D", padding: "12px 16px" }}>
        {/* Team toggle */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "14px" }}>
          <button
            onClick={e => { e.preventDefault(); setShowHome(true); }}
            style={{
              padding: "4px 12px", borderRadius: "6px", border: "1px solid #21262D",
              background: showHome ? "#EA6C0A" : "transparent",
              color: showHome ? "#fff" : "#6B7280", fontSize: "11px", fontWeight: 600, cursor: "pointer",
            }}
          >
            {homeShort}
          </button>
          <button
            onClick={e => { e.preventDefault(); setShowHome(false); }}
            style={{
              padding: "4px 12px", borderRadius: "6px", border: "1px solid #21262D",
              background: !showHome ? "#EA6C0A" : "transparent",
              color: !showHome ? "#fff" : "#6B7280", fontSize: "11px", fontWeight: 600, cursor: "pointer",
            }}
          >
            {awayShort}
          </button>
        </div>

        {/* Active pitcher */}
        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontSize: "10px", color: "#EA6C0A", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
            Starting Pitcher
          </div>
          {activePitcher ? (
            <PitcherCard pitcher={activePitcher} label={activeLabel} f5WinProb={activeF5WinProb} />
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
            <div style={{ background: "#161B22", borderRadius: "8px", overflow: "hidden", border: "1px solid #21262D" }}>
              {activeLineup.map(b => <BatterRow key={`${b.name}-${b.slot}`} batter={b} />)}
              {activeLineup.some(b => b.isProjected) && (
                <div style={{ fontSize: "10px", color: "#4B5563", padding: "8px 10px", borderTop: "0.5px solid #21262D" }}>
                  * Projected lineup based on season PA — official lineup not yet posted
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: "11px", color: "#4B5563", padding: "8px 0" }}>
              {game.hasLineups ? "No lineup for this team yet" : "Lineups not yet posted"}
            </div>
          )}
        </div>
      </div>
    </details>
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
