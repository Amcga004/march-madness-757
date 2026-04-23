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

export default function GolfTournamentCard({ tournamentName, roundStatus, players }: Props) {
  const [expanded, setExpanded] = useState(false);
  const displayed = expanded ? players : players.slice(0, 10);

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
        gridTemplateColumns: "40px 1fr 60px 60px 50px 50px 50px 50px 55px",
        padding: "5px 8px 4px",
        gap: "4px",
        borderBottom: "0.5px solid #1E2433",
      }}>
        {["POS", "PLAYER", "SCORE", "TODAY", "THRU", "R1", "R2", "R3", "R4"].map((col, i) => (
          <span key={i} className={i === 6 ? "golf-col-r2" : i === 7 ? "golf-col-r3" : i === 8 ? "golf-col-r4" : undefined} style={{
            fontSize: "10px",
            color: "#6B7280",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            textAlign: i >= 3 ? "center" : "left",
          }}>{col}</span>
        ))}
      </div>

      {/* Player rows */}
      {displayed.map((player, idx) => (
        <div key={idx} style={{
          display: "grid",
          gridTemplateColumns: "40px 1fr 60px 60px 50px 50px 50px 50px 55px",
          alignItems: "center",
          padding: "8px 8px",
          borderBottom: "0.5px solid #1E2433",
          gap: "4px",
          background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
        }}>
          <span style={{ fontSize: "12px", color: "#6B7280" }}>
            {player.position === "—" || player.position === "--" ? "—" : player.position}
          </span>
          <span style={{ fontSize: "13px", fontWeight: 500, color: "#F1F3F5" }}>
            {player.name}
            {player.teeTime && player.thru === "--" && (
              <span style={{ fontSize: "10px", color: "#4B5563", marginLeft: "8px", fontWeight: 400 }}>
                {player.teeTime}
              </span>
            )}
          </span>
          <span style={{
            fontSize: "13px",
            fontWeight: 600,
            color: (player.totalVsPar === null || player.totalVsPar === undefined || isNaN(player.totalVsPar)) ? "#6B7280"
              : player.totalVsPar < 0 ? "#EA6C0A"
              : player.totalVsPar > 0 ? "#DC2626" : "#9CA3AF",
            textAlign: "center",
          }}>
            {(player.totalVsPar === null || player.totalVsPar === undefined || isNaN(player.totalVsPar)) ? "--"
              : player.totalVsPar === 0 ? "E"
              : player.totalVsPar > 0 ? `+${player.totalVsPar}`
              : `${player.totalVsPar}`}
          </span>
          <span style={{ fontSize: "12px", color: (player.todayVsPar === null || player.todayVsPar === undefined || isNaN(player.todayVsPar)) ? "#6B7280" : scoreColor(player.todayVsPar), textAlign: "center" }}>
            {(player.todayVsPar === null || player.todayVsPar === undefined || isNaN(player.todayVsPar)) ? "--" : fmtScore(player.todayVsPar)}
          </span>
          <span style={{ fontSize: "11px", color: "#6B7280", textAlign: "center" }}>
            {player.thru}
          </span>
          <span className="golf-col-r2" style={{ fontSize: "11px", color: (player.r1 === null || player.r1 === undefined || isNaN(player.r1)) ? "#4B5563" : "#9CA3AF", textAlign: "center" }}>
            {(player.r1 === null || player.r1 === undefined || isNaN(player.r1)) ? "--" : player.r1}
          </span>
          <span className="golf-col-r2" style={{ fontSize: "11px", color: (player.r2 === null || player.r2 === undefined || isNaN(player.r2)) ? "#4B5563" : "#9CA3AF", textAlign: "center" }}>
            {(player.r2 === null || player.r2 === undefined || isNaN(player.r2)) ? "--" : player.r2}
          </span>
          <span className="golf-col-r3" style={{ fontSize: "11px", color: (player.r3 === null || player.r3 === undefined || isNaN(player.r3)) ? "#4B5563" : "#9CA3AF", textAlign: "center" }}>
            {(player.r3 === null || player.r3 === undefined || isNaN(player.r3)) ? "--" : player.r3}
          </span>
          <span className="golf-col-r4" style={{ fontSize: "11px", color: (player.r4 === null || player.r4 === undefined || isNaN(player.r4)) ? "#4B5563" : "#9CA3AF", textAlign: "center" }}>
            {(player.r4 === null || player.r4 === undefined || isNaN(player.r4)) ? "--" : player.r4}
          </span>
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
