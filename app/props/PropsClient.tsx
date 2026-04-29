"use client";

import { useState } from "react";
import Link from "next/link";

const SPORT_TABS = ["MLB", "NBA", "NHL"] as const;
type SportTab = typeof SPORT_TABS[number];

const MLB_CATEGORIES = ["Top Hitters", "HR Upside", "Total Bases", "K Upside"] as const;
type MLBCategory = typeof MLB_CATEGORIES[number];

interface PlayerProp {
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
  kScore: number | null;
  xfip: number | null;
  kPct: number | null;
  bbPct: number | null;
  isPitcher: boolean;
  confirmed: boolean;
}

interface GameInfo {
  homeTeam: string;
  awayTeam: string;
  gameTime: string;
  homePitcher?: string | null;
  awayPitcher?: string | null;
}

interface Props {
  date: string;
  topHitters: PlayerProp[];
  topHRCandidates: PlayerProp[];
  topKPitchers: PlayerProp[];
  topTotalBases: PlayerProp[];
  mlbGames: GameInfo[];
  nbaGames: GameInfo[];
  nhlGames: GameInfo[];
  hasLineups: boolean;
}

function fmt(v: number | null, decimals = 3): string {
  if (v === null || v === 0) return "—";
  return v.toFixed(decimals);
}

function fmtPct(v: number | null): string {
  if (v === null || v === 0) return "—";
  return v.toFixed(1) + "%";
}

function ScoreBadge({ score, max = 100 }: { score: number; max?: number }) {
  const pct = Math.min(score / max, 1);
  const color = pct > 0.7 ? "#16A34A" : pct > 0.4 ? "#D97706" : "#6B7280";
  return (
    <div style={{
      background: `${color}22`,
      border: `1px solid ${color}44`,
      color,
      borderRadius: "6px",
      padding: "2px 7px",
      fontSize: "12px",
      fontWeight: 700,
      minWidth: "36px",
      textAlign: "center",
    }}>
      {score}
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  if (value === "—") return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "#0D1117", borderRadius: "6px", padding: "4px 8px", minWidth: "52px" }}>
      <span style={{ fontSize: "9px", color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
      <span style={{ fontSize: "12px", fontWeight: 600, color: "#F1F3F5" }}>{value}</span>
    </div>
  );
}

function HitterCard({ player, rank, category }: { player: PlayerProp; rank: number; category: MLBCategory }) {
  const [expanded, setExpanded] = useState(false);
  const primaryScore = category === "HR Upside" ? player.hrScore : category === "K Upside" ? (player.kScore ?? 0) : player.propScore;

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      style={{
        background: "#161B22",
        border: "1px solid #21262D",
        borderRadius: "10px",
        padding: "12px 14px",
        marginBottom: "8px",
        cursor: "pointer",
        transition: "border-color 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "11px", color: "#4B5563", fontWeight: 600, minWidth: "18px" }}>#{rank}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#F1F3F5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{player.name}</span>
            {player.isPitcher && <span style={{ fontSize: "9px", background: "#21262D", color: "#6B7280", padding: "1px 5px", borderRadius: "4px", flexShrink: 0 }}>SP</span>}
            {!player.confirmed && <span style={{ fontSize: "9px", background: "#D9770618", color: "#D97706", padding: "1px 5px", borderRadius: "4px", flexShrink: 0 }}>Projected</span>}
          </div>
          <div style={{ fontSize: "11px", color: "#6B7280" }}>
            {player.team.split(" ").pop()} vs {player.opponent.split(" ").pop()} · {player.gameTime}
          </div>
        </div>
        {category === "Total Bases" ? (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "#EA6C0A" }}>{fmt(player.xslg)}</div>
            <div style={{ fontSize: "9px", color: "#4B5563" }}>xSLG</div>
          </div>
        ) : (
          <ScoreBadge score={primaryScore} />
        )}
      </div>

      {expanded && (
        <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "0.5px solid #21262D" }}>
          {player.isPitcher ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              <StatPill label="xFIP" value={fmt(player.xfip, 2)} />
              <StatPill label="K%" value={fmtPct(player.kPct)} />
              <StatPill label="BB%" value={fmtPct(player.bbPct)} />
              <StatPill label="xwOBA" value={fmt(player.xwoba)} />
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              <StatPill label="xwOBA" value={fmt(player.xwoba)} />
              <StatPill label="xBA" value={fmt(player.xba)} />
              <StatPill label="xSLG" value={fmt(player.xslg)} />
              <StatPill label="Barrel%" value={fmtPct(player.barrelPct)} />
              <StatPill label="Hard Hit%" value={fmtPct(player.hardHitPct)} />
              <StatPill label="Exit Velo" value={player.exitVelo ? player.exitVelo.toFixed(1) + " mph" : "—"} />
              <StatPill label="EV50" value={player.ev50 ? player.ev50.toFixed(1) + " mph" : "—"} />
            </div>
          )}
          <p style={{ fontSize: "10px", color: "#4B5563", marginTop: "8px", lineHeight: 1.4 }}>
            {player.isPitcher
              ? "K Score combines K%, SwStr%, and inverse xFIP. Higher = more strikeout upside today."
              : category === "HR Upside"
              ? "HR Score combines Barrel%, Hard Hit%, and Exit Velocity. Higher = better HR upside."
              : category === "Total Bases"
              ? "xSLG measures expected slugging based on quality of contact. Higher = more bases upside."
              : "Prop Score combines xwOBA, Barrel%, Hard Hit%, and Exit Velocity quality of contact metrics."}
          </p>
        </div>
      )}
    </div>
  );
}

function GameChip({ game }: { game: GameInfo }) {
  return (
    <div style={{ background: "#161B22", border: "1px solid #21262D", borderRadius: "8px", padding: "8px 12px", display: "inline-flex", flexDirection: "column", gap: "2px", minWidth: "140px" }}>
      <div style={{ fontSize: "12px", fontWeight: 600, color: "#F1F3F5" }}>
        {game.awayTeam.split(" ").pop()} @ {game.homeTeam.split(" ").pop()}
      </div>
      <div style={{ fontSize: "10px", color: "#6B7280" }}>{game.gameTime}</div>
      {(game.homePitcher || game.awayPitcher) && (
        <div style={{ fontSize: "10px", color: "#4B5563", marginTop: "2px" }}>
          {game.awayPitcher?.split(" ").pop() ?? "TBD"} vs {game.homePitcher?.split(" ").pop() ?? "TBD"}
        </div>
      )}
    </div>
  );
}

export default function PropsClient({
  date, topHitters, topHRCandidates, topKPitchers, topTotalBases,
  mlbGames, nbaGames, nhlGames, hasLineups,
}: Props) {
  const [sport, setSport] = useState<SportTab>("MLB");
  const [mlbCat, setMLBCat] = useState<MLBCategory>("Top Hitters");

  const activePlayers =
    mlbCat === "Top Hitters" ? topHitters :
    mlbCat === "HR Upside" ? topHRCandidates :
    mlbCat === "Total Bases" ? topTotalBases :
    topKPitchers;

  return (
    <div style={{
      maxWidth: "760px",
      margin: "0 auto",
      padding: "clamp(12px, 4vw, 28px)",
      color: "#F1F3F5",
      background: "#0D1117",
      minHeight: "100vh",
      fontSize: "14px",
    }}>
      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#F1F3F5", margin: 0 }}>Player Props</h1>
          <Link href="/betting" style={{ fontSize: "12px", color: "#6B7280", textDecoration: "none" }}>← Betting</Link>
        </div>
        <p style={{ fontSize: "12px", color: "#6B7280", margin: 0 }}>
          Advanced analytics for today&apos;s players · {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
        </p>
      </div>

      {/* Sport tabs */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
        {SPORT_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setSport(tab)}
            style={{
              padding: "6px 14px",
              borderRadius: "20px",
              border: sport === tab ? "1px solid #EA6C0A" : "1px solid #21262D",
              background: sport === tab ? "#EA6C0A18" : "transparent",
              color: sport === tab ? "#EA6C0A" : "#6B7280",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >{tab}</button>
        ))}
      </div>

      {sport === "MLB" && (
        <>
          {/* Today's games strip */}
          {mlbGames.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "10px", color: "#4B5563", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>Today&apos;s Games</div>
              <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
                {mlbGames.map((g, i) => <GameChip key={i} game={g} />)}
              </div>
            </div>
          )}

          {!hasLineups && (
            <div style={{ background: "#D9770612", border: "1px solid #D9770630", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px", fontSize: "12px", color: "#D97706" }}>
              ⚠️ Lineups not yet confirmed — showing pitcher projections only. Hitter rankings will populate once lineups are posted (~3–4 hours before first pitch).
            </div>
          )}

          {/* MLB category pills */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
            {MLB_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setMLBCat(cat)}
                style={{
                  padding: "5px 12px",
                  borderRadius: "16px",
                  border: mlbCat === cat ? "1px solid #EA6C0A" : "1px solid #21262D",
                  background: mlbCat === cat ? "#EA6C0A18" : "#161B22",
                  color: mlbCat === cat ? "#EA6C0A" : "#6B7280",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >{cat}</button>
            ))}
          </div>

          {/* Section header */}
          <div style={{ marginBottom: "12px" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#F1F3F5", marginBottom: "2px" }}>
              {mlbCat === "Top Hitters" && "🔥 Top Hitters Today"}
              {mlbCat === "HR Upside" && "💣 Home Run Upside"}
              {mlbCat === "Total Bases" && "📊 Total Bases Leaders"}
              {mlbCat === "K Upside" && "⚾ Strikeout Upside — Pitchers"}
            </div>
            <div style={{ fontSize: "11px", color: "#4B5563" }}>
              {mlbCat === "Top Hitters" && "Ranked by xwOBA, Barrel%, and Hard Hit% from Baseball Savant"}
              {mlbCat === "HR Upside" && "Ranked by Barrel%, Hard Hit%, and Exit Velocity"}
              {mlbCat === "Total Bases" && "Ranked by xSLG — expected slugging based on contact quality"}
              {mlbCat === "K Upside" && "Ranked by K%, SwStr%, and inverse xFIP from FanGraphs"}
            </div>
          </div>

          {activePlayers.length === 0 ? (
            <div style={{ textAlign: "center", color: "#4B5563", padding: "40px 0" }}>
              {hasLineups ? "No data available" : "Lineups not yet posted — check back closer to game time"}
            </div>
          ) : (
            activePlayers.map((player, i) => (
              <HitterCard key={player.name + i} player={player} rank={i + 1} category={mlbCat} />
            ))
          )}
        </>
      )}

      {sport === "NBA" && (
        <div>
          {nbaGames.length === 0 ? (
            <div style={{ textAlign: "center", color: "#4B5563", padding: "60px 0" }}>No NBA games today</div>
          ) : (
            <>
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "10px", color: "#4B5563", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>Today&apos;s Games</div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {nbaGames.map((g, i) => <GameChip key={i} game={g} />)}
                </div>
              </div>
              <div style={{ background: "#161B22", border: "1px solid #21262D", borderRadius: "10px", padding: "24px", textAlign: "center", color: "#4B5563" }}>
                <div style={{ fontSize: "24px", marginBottom: "8px" }}>🏀</div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#6B7280", marginBottom: "4px" }}>NBA Player Props Coming Soon</div>
                <div style={{ fontSize: "11px", color: "#4B5563" }}>
                  We&apos;re integrating Dunks &amp; Threes player-level efficiency and usage data.<br />
                  Points, assists, and rebounds projections launching next.
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {sport === "NHL" && (
        <div>
          {nhlGames.length === 0 ? (
            <div style={{ textAlign: "center", color: "#4B5563", padding: "60px 0" }}>No NHL games today</div>
          ) : (
            <>
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "10px", color: "#4B5563", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>Today&apos;s Games</div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {nhlGames.map((g, i) => <GameChip key={i} game={g} />)}
                </div>
              </div>
              <div style={{ background: "#161B22", border: "1px solid #21262D", borderRadius: "10px", padding: "24px", textAlign: "center", color: "#4B5563" }}>
                <div style={{ fontSize: "24px", marginBottom: "8px" }}>🏒</div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#6B7280", marginBottom: "4px" }}>NHL Player Props Coming Soon</div>
                <div style={{ fontSize: "11px", color: "#4B5563" }}>
                  Shots on goal upside, points projections, and goalie save% analysis launching next.
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Footer note */}
      <div style={{ marginTop: "32px", paddingTop: "16px", borderTop: "0.5px solid #21262D", fontSize: "10px", color: "#374151", textAlign: "center", lineHeight: 1.6 }}>
        Data: Baseball Savant Statcast · FanGraphs · MLB Stats API<br />
        Stats reflect 2026 season. Prop scores are EdgePulse models, not guaranteed outcomes.
      </div>
    </div>
  );
}
