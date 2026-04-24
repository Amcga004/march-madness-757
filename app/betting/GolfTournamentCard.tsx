"use client";

import { useState } from "react";

interface GolfPlayer {
  position: number | string;
  name: string;
  totalVsPar: number | null;
  todayVsPar: number | null;
  thru: string;
  teeTime?: string | null;
  r1: number | null;
  r2: number | null;
  r3: number | null;
  r4: number | null;
}

interface Props {
  tournamentName: string;
  roundStatus: string;
  players: GolfPlayer[];
}

function fmtScore(score: number | null): string {
  if (score === null) return "--";
  if (score === 0) return "E";
  return score > 0 ? `+${score}` : `${score}`;
}

function scoreColor(score: number | null): string {
  if (score === null) return "#6B7280";
  if (score < 0) return "#EA6C0A";
  if (score > 0) return "#9CA3AF";
  return "#F1F3F5";
}

function hasData(v: number | null): boolean {
  return v !== null && v !== undefined && !isNaN(v);
}

export default function GolfTournamentCard({ tournamentName, roundStatus, players }: Props) {
  const [expanded, setExpanded] = useState(false);
  const displayed = expanded ? players : players.slice(0, 10);

  const hasR2 = players.some(p => hasData(p.r2));
  const hasR3 = players.some(p => hasData(p.r3));
  const hasR4 = players.some(p => hasData(p.r4));

  const gridCols = [
    "35px",                   // POS
    "minmax(80px, 1fr)",      // PLAYER
    "52px",                   // SCORE
    "52px",                   // TODAY
    "45px",                   // THRU
    "45px",                   // R1
    hasR2 ? "45px" : null,
    hasR3 ? "45px" : null,
    hasR4 ? "45px" : null,
  ].filter(Boolean).join(" ");

  const roundCellStyle = {
    fontSize: "11px" as const,
    color: "#9CA3AF",
    textAlign: "center" as const,
  };
  const roundEmptyStyle = {
    fontSize: "11px" as const,
    color: "#4B5563",
    textAlign: "center" as const,
  };

  return (
    <div style={{ marginBottom: "28px" }}>
      {/* Header */}
      <div style={{
        fontSize: "11px",
        fontWeight: 600,
        color: "#EA6C0A",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        padding: "12px 8px 6px",
        borderBottom: "2px solid #EA6C0A20",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <span>⛳ PGA Tour — {tournamentName}</span>
        <span style={{ fontSize: "10px", color: "#6B7280", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
          {roundStatus}
        </span>
      </div>

      <div className="golf-table-wrap">
        {/* Column headers */}
        <div style={{
          display: "grid",
          gridTemplateColumns: gridCols,
          padding: "5px 8px 4px",
          gap: "4px",
          borderBottom: "0.5px solid #1E2433",
        }}>
          {["POS", "PLAYER", "SCORE", "TODAY", "THRU", "R1"].map((col, i) => (
            <span key={col} style={{
              fontSize: "10px",
              color: "#6B7280",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              textAlign: i >= 2 ? "center" : "left",
            }}>{col}</span>
          ))}
          {hasR2 && <span className="golf-col-r2" style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>R2</span>}
          {hasR3 && <span className="golf-col-r3" style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>R3</span>}
          {hasR4 && <span className="golf-col-r4" style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>R4</span>}
        </div>

        {/* Player rows */}
        {displayed.map((player, idx) => (
          <div key={idx} style={{
            display: "grid",
            gridTemplateColumns: gridCols,
            alignItems: "center",
            padding: "8px 8px",
            borderBottom: "0.5px solid #1E2433",
            gap: "4px",
            background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
          }}>
            {/* POS */}
            <span style={{ fontSize: "12px", color: "#6B7280" }}>
              {player.position === "—" || player.position === "--" ? "—" : player.position}
            </span>

            {/* PLAYER */}
            <span style={{ fontSize: "13px", fontWeight: 500, color: "#F1F3F5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {player.name}
              {player.teeTime && player.thru === "--" && (
                <span style={{ fontSize: "10px", color: "#4B5563", marginLeft: "8px", fontWeight: 400 }}>
                  {player.teeTime}
                </span>
              )}
            </span>

            {/* SCORE */}
            <span style={{
              fontSize: "13px",
              fontWeight: 600,
              textAlign: "center",
              color: !hasData(player.totalVsPar) ? "#6B7280"
                : player.totalVsPar! < 0 ? "#EA6C0A"
                : player.totalVsPar! > 0 ? "#DC2626" : "#9CA3AF",
            }}>
              {!hasData(player.totalVsPar) ? "--"
                : player.totalVsPar === 0 ? "E"
                : player.totalVsPar! > 0 ? `+${player.totalVsPar}`
                : `${player.totalVsPar}`}
            </span>

            {/* TODAY */}
            <span style={{
              fontSize: "12px",
              textAlign: "center",
              color: !hasData(player.todayVsPar) ? "#6B7280" : scoreColor(player.todayVsPar),
            }}>
              {!hasData(player.todayVsPar) ? "--" : fmtScore(player.todayVsPar)}
            </span>

            {/* THRU */}
            <span style={{ fontSize: "11px", color: "#6B7280", textAlign: "center" }}>
              {player.thru}
            </span>

            {/* R1 */}
            <span style={hasData(player.r1) ? roundCellStyle : roundEmptyStyle}>
              {hasData(player.r1) ? player.r1 : "--"}
            </span>

            {/* R2 */}
            {hasR2 && (
              <span className="golf-col-r2" style={hasData(player.r2) ? roundCellStyle : roundEmptyStyle}>
                {hasData(player.r2) ? player.r2 : "--"}
              </span>
            )}

            {/* R3 */}
            {hasR3 && (
              <span className="golf-col-r3" style={hasData(player.r3) ? roundCellStyle : roundEmptyStyle}>
                {hasData(player.r3) ? player.r3 : "--"}
              </span>
            )}

            {/* R4 */}
            {hasR4 && (
              <span className="golf-col-r4" style={hasData(player.r4) ? roundCellStyle : roundEmptyStyle}>
                {hasData(player.r4) ? player.r4 : "--"}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Expand button */}
      {players.length > 10 && (
        <div
          onClick={() => setExpanded(!expanded)}
          style={{
            padding: "10px 8px",
            fontSize: "12px",
            color: "#EA6C0A",
            cursor: "pointer",
            borderBottom: "0.5px solid #1E2433",
          }}
        >
          {expanded ? "Show less ↑" : `Show full field (${players.length} players) ↓`}
        </div>
      )}
    </div>
  );
}
