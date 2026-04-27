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
  rawCompetitors?: any[];
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

function parseVsPar(s: string | undefined): number | null {
  if (!s) return null;
  if (s === "E") return 0;
  const n = parseInt(s);
  return isNaN(n) ? null : n;
}

function holeColor(vsPar: number | null): string {
  if (vsPar === null) return "#6B7280";
  if (vsPar <= -2) return "#F59E0B";
  if (vsPar === -1) return "#EA6C0A";
  if (vsPar === 0) return "#6B7280";
  if (vsPar === 1) return "#DC2626";
  return "#991B1B";
}

function holeBg(vsPar: number | null): string {
  if (vsPar === null) return "transparent";
  if (vsPar <= -2) return "#F59E0B22";
  if (vsPar === -1) return "#EA6C0A22";
  if (vsPar === 0) return "transparent";
  if (vsPar === 1) return "#DC262622";
  return "#991B1B22";
}

function findRawCompetitor(player: GolfPlayer, rawCompetitors: any[]): any | null {
  return rawCompetitors.find(c => {
    const names: string[] = [];
    if (c.athlete?.displayName) names.push(c.athlete.displayName);
    if (Array.isArray(c.athletes)) {
      for (const a of c.athletes) {
        const n = a.athlete?.displayName ?? a.displayName;
        if (n) names.push(n);
      }
    }
    if (c.team?.displayName) names.push(c.team.displayName);
    return names.some(n => {
      const last = n.split(" ").pop() ?? "";
      return last.length > 1 && player.name.includes(last);
    });
  }) ?? null;
}

export default function GolfTournamentCard({ tournamentName, roundStatus, players, rawCompetitors }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [sortBy, setSortBy] = useState<"score" | "name">("score");
  const [scorecardPlayer, setScorecardPlayer] = useState<any>(null);
  const [scorecardRound, setScorecardRound] = useState(1);

  const sorted = [...players].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (a.totalVsPar === null && b.totalVsPar === null) return 0;
    if (a.totalVsPar === null) return 1;
    if (b.totalVsPar === null) return -1;
    return a.totalVsPar - b.totalVsPar;
  });

  const displayed = expanded ? sorted : sorted.slice(0, 10);

  const hasR2 = players.some(p => hasData(p.r2));
  const hasR3 = players.some(p => hasData(p.r3));
  const hasR4 = players.some(p => hasData(p.r4));

  const gridCols = [
    "35px",
    "minmax(80px, 1fr)",
    "52px",
    "52px",
    "45px",
    "45px",
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

  // Scorecard modal data
  const scRounds: any[] = scorecardPlayer
    ? (scorecardPlayer.linescores ?? []).filter(
        (ls: any) => Array.isArray(ls.linescores) && ls.linescores.length > 0
      )
    : [];

  const activeRoundData = scRounds.find((ls: any) => ls.period === scorecardRound) ?? scRounds[0] ?? null;
  const holes: any[] = activeRoundData?.linescores ?? [];

  const front = holes.slice(0, 9);
  const back = holes.slice(9, 18);

  const sumStrokes = (hs: any[]) => hs.reduce((acc, h) => acc + (parseFloat(h.displayValue) || 0), 0);
  const sumVsPar = (hs: any[]) => hs.reduce((acc, h) => acc + (parseVsPar(h.scoreType?.displayValue) ?? 0), 0);

  const derivePar = (h: any): number | null => {
    const strokes = parseFloat(h.displayValue);
    const vp = parseVsPar(h.scoreType?.displayValue);
    if (isNaN(strokes) || vp === null) return null;
    return strokes - vp;
  };

  const scPlayerName = (() => {
    if (!scorecardPlayer) return "";
    if (scorecardPlayer.athlete?.displayName) return scorecardPlayer.athlete.displayName;
    if (Array.isArray(scorecardPlayer.athletes) && scorecardPlayer.athletes.length > 0) {
      return scorecardPlayer.athletes.map((a: any) => a.athlete?.displayName ?? "").filter(Boolean).join(" / ");
    }
    return scorecardPlayer.team?.displayName ?? "";
  })();

  const cellW = "28px";
  const totW = "36px";

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
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "10px", color: "#6B7280", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>{roundStatus}</span>
          {(["score", "name"] as const).map(s => (
            <button key={s} onClick={() => setSortBy(s)} style={{
              padding: "2px 8px", borderRadius: "10px", fontSize: "10px", cursor: "pointer",
              border: `0.5px solid ${sortBy === s ? "#EA6C0A80" : "#21262D"}`,
              background: sortBy === s ? "#EA6C0A15" : "transparent",
              color: sortBy === s ? "#EA6C0A" : "#6B7280",
              textTransform: "capitalize" as const,
              fontWeight: sortBy === s ? 600 : 400,
            }}>{s}</button>
          ))}
        </div>
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
          {hasR2 && <span style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>R2</span>}
          {hasR3 && <span style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>R3</span>}
          {hasR4 && <span style={{ fontSize: "10px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>R4</span>}
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
              <span
                onClick={() => {
                  if (!rawCompetitors) return;
                  const raw = findRawCompetitor(player, rawCompetitors);
                  if (raw) {
                    const rounds = (raw.linescores ?? []).filter(
                      (ls: any) => Array.isArray(ls.linescores) && ls.linescores.length > 0
                    );
                    const latestRound = rounds.length > 0 ? rounds[rounds.length - 1].period : 1;
                    setScorecardPlayer(raw);
                    setScorecardRound(latestRound);
                  }
                }}
                style={{
                  cursor: rawCompetitors ? "pointer" : "default",
                  textDecoration: rawCompetitors ? "underline dotted" : "none",
                  textDecorationColor: "#4B5563",
                }}
              >
                {player.name}
              </span>
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
              <span style={hasData(player.r2) ? roundCellStyle : roundEmptyStyle}>
                {hasData(player.r2) ? player.r2 : "--"}
              </span>
            )}

            {/* R3 */}
            {hasR3 && (
              <span style={hasData(player.r3) ? roundCellStyle : roundEmptyStyle}>
                {hasData(player.r3) ? player.r3 : "--"}
              </span>
            )}

            {/* R4 */}
            {hasR4 && (
              <span style={hasData(player.r4) ? roundCellStyle : roundEmptyStyle}>
                {hasData(player.r4) ? player.r4 : "--"}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Expand button */}
      {sorted.length > 10 && (
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
          {expanded ? "Show less ↑" : `Show full field (${sorted.length} players) ↓`}
        </div>
      )}

      {/* Scorecard modal */}
      {scorecardPlayer && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: "16px",
          }}
          onClick={() => setScorecardPlayer(null)}
        >
          <div
            style={{
              background: "#1A2236", border: "0.5px solid #21262D",
              borderRadius: "12px", padding: "20px",
              width: "100%", maxWidth: "620px", maxHeight: "90vh", overflowY: "auto",
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <div style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px" }}>Scorecard</div>
                <div style={{ fontSize: "15px", fontWeight: 600, color: "#F1F3F5" }}>{scPlayerName}</div>
              </div>
              <button
                onClick={() => setScorecardPlayer(null)}
                style={{ background: "none", border: "none", color: "#6B7280", fontSize: "18px", cursor: "pointer", padding: "0 0 0 12px", lineHeight: 1 }}
              >×</button>
            </div>

            {/* Round tabs */}
            {scRounds.length > 0 && (
              <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
                {scRounds.map((ls: any) => (
                  <button
                    key={ls.period}
                    onClick={() => setScorecardRound(ls.period)}
                    style={{
                      padding: "4px 12px", borderRadius: "10px", fontSize: "11px", cursor: "pointer",
                      border: `0.5px solid ${scorecardRound === ls.period ? "#EA6C0A80" : "#21262D"}`,
                      background: scorecardRound === ls.period ? "#EA6C0A15" : "transparent",
                      color: scorecardRound === ls.period ? "#EA6C0A" : "#6B7280",
                      fontWeight: scorecardRound === ls.period ? 600 : 400,
                    }}
                  >
                    Round {ls.period}
                  </button>
                ))}
              </div>
            )}

            {/* Scorecard table */}
            {activeRoundData && holes.length > 0 ? (
              <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" as any }}>
                {/* Front 9 */}
                <div style={{ marginBottom: "12px" }}>
                  <div style={{ fontSize: "10px", color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>Front 9</div>
                  <table style={{ borderCollapse: "collapse", fontSize: "12px", width: "100%" }}>
                    <thead>
                      <tr>
                        <td style={{ fontSize: "10px", color: "#4B5563", paddingRight: "8px", width: "36px" }}>Hole</td>
                        {front.map((h: any) => (
                          <td key={h.period} style={{ textAlign: "center", width: cellW, color: "#6B7280", fontSize: "10px", paddingBottom: "4px" }}>{h.period}</td>
                        ))}
                        <td style={{ textAlign: "center", width: totW, color: "#6B7280", fontSize: "10px", paddingBottom: "4px", paddingLeft: "4px" }}>OUT</td>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Par row */}
                      <tr>
                        <td style={{ fontSize: "10px", color: "#4B5563", paddingRight: "8px" }}>Par</td>
                        {front.map((h: any) => {
                          const par = derivePar(h);
                          return (
                            <td key={h.period} style={{ textAlign: "center", color: "#6B7280", fontSize: "11px", padding: "2px 0" }}>
                              {par ?? "—"}
                            </td>
                          );
                        })}
                        <td style={{ textAlign: "center", color: "#6B7280", fontSize: "11px", paddingLeft: "4px" }}>
                          {front.reduce((acc: number, h: any) => acc + (derivePar(h) ?? 0), 0) || "—"}
                        </td>
                      </tr>
                      {/* Strokes row */}
                      <tr>
                        <td style={{ fontSize: "10px", color: "#4B5563", paddingRight: "8px" }}>Score</td>
                        {front.map((h: any) => {
                          const vp = parseVsPar(h.scoreType?.displayValue);
                          return (
                            <td key={h.period} style={{ textAlign: "center", padding: "2px 1px" }}>
                              <span style={{
                                display: "inline-block",
                                width: "22px", height: "22px", lineHeight: "22px",
                                borderRadius: vp !== null && vp <= -2 ? "50%" : vp === -1 ? "50%" : vp === 1 ? "2px" : vp !== null && vp >= 2 ? "2px" : "2px",
                                background: holeBg(vp),
                                color: holeColor(vp),
                                fontSize: "12px", fontWeight: 600,
                                border: vp !== null && vp <= -2 ? `1.5px solid ${holeColor(vp)}` : vp === -1 ? `1px solid ${holeColor(vp)}` : "none",
                              }}>
                                {h.displayValue}
                              </span>
                            </td>
                          );
                        })}
                        <td style={{ textAlign: "center", paddingLeft: "4px", fontWeight: 600, color: "#F1F3F5", fontSize: "13px" }}>
                          {sumStrokes(front) || "—"}
                        </td>
                      </tr>
                      {/* vs Par row */}
                      <tr>
                        <td style={{ fontSize: "10px", color: "#4B5563", paddingRight: "8px" }}>+/-</td>
                        {front.map((h: any) => {
                          const vp = parseVsPar(h.scoreType?.displayValue);
                          return (
                            <td key={h.period} style={{ textAlign: "center", fontSize: "10px", color: holeColor(vp), padding: "2px 0" }}>
                              {vp === null ? "—" : vp === 0 ? "E" : vp > 0 ? `+${vp}` : vp}
                            </td>
                          );
                        })}
                        <td style={{ textAlign: "center", paddingLeft: "4px", fontSize: "11px", color: holeColor(sumVsPar(front)) }}>
                          {sumVsPar(front) === 0 ? "E" : sumVsPar(front) > 0 ? `+${sumVsPar(front)}` : sumVsPar(front)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Back 9 */}
                {back.length > 0 && (
                  <div style={{ marginBottom: "12px" }}>
                    <div style={{ fontSize: "10px", color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>Back 9</div>
                    <table style={{ borderCollapse: "collapse", fontSize: "12px", width: "100%" }}>
                      <thead>
                        <tr>
                          <td style={{ fontSize: "10px", color: "#4B5563", paddingRight: "8px", width: "36px" }}>Hole</td>
                          {back.map((h: any) => (
                            <td key={h.period} style={{ textAlign: "center", width: cellW, color: "#6B7280", fontSize: "10px", paddingBottom: "4px" }}>{h.period}</td>
                          ))}
                          <td style={{ textAlign: "center", width: totW, color: "#6B7280", fontSize: "10px", paddingBottom: "4px", paddingLeft: "4px" }}>IN</td>
                          <td style={{ textAlign: "center", width: totW, color: "#6B7280", fontSize: "10px", paddingBottom: "4px", paddingLeft: "4px" }}>TOT</td>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ fontSize: "10px", color: "#4B5563", paddingRight: "8px" }}>Par</td>
                          {back.map((h: any) => {
                            const par = derivePar(h);
                            return (
                              <td key={h.period} style={{ textAlign: "center", color: "#6B7280", fontSize: "11px", padding: "2px 0" }}>
                                {par ?? "—"}
                              </td>
                            );
                          })}
                          <td style={{ textAlign: "center", color: "#6B7280", fontSize: "11px", paddingLeft: "4px" }}>
                            {back.reduce((acc: number, h: any) => acc + (derivePar(h) ?? 0), 0) || "—"}
                          </td>
                          <td style={{ textAlign: "center", color: "#6B7280", fontSize: "11px", paddingLeft: "4px" }}>
                            {holes.reduce((acc: number, h: any) => acc + (derivePar(h) ?? 0), 0) || "—"}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ fontSize: "10px", color: "#4B5563", paddingRight: "8px" }}>Score</td>
                          {back.map((h: any) => {
                            const vp = parseVsPar(h.scoreType?.displayValue);
                            return (
                              <td key={h.period} style={{ textAlign: "center", padding: "2px 1px" }}>
                                <span style={{
                                  display: "inline-block",
                                  width: "22px", height: "22px", lineHeight: "22px",
                                  borderRadius: "2px",
                                  background: holeBg(vp),
                                  color: holeColor(vp),
                                  fontSize: "12px", fontWeight: 600,
                                  border: vp !== null && vp <= -1 ? `1px solid ${holeColor(vp)}` : "none",
                                }}>
                                  {h.displayValue}
                                </span>
                              </td>
                            );
                          })}
                          <td style={{ textAlign: "center", paddingLeft: "4px", fontWeight: 600, color: "#F1F3F5", fontSize: "13px" }}>
                            {sumStrokes(back) || "—"}
                          </td>
                          <td style={{ textAlign: "center", paddingLeft: "4px", fontWeight: 700, color: "#EA6C0A", fontSize: "14px" }}>
                            {sumStrokes(holes) || "—"}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ fontSize: "10px", color: "#4B5563", paddingRight: "8px" }}>+/-</td>
                          {back.map((h: any) => {
                            const vp = parseVsPar(h.scoreType?.displayValue);
                            return (
                              <td key={h.period} style={{ textAlign: "center", fontSize: "10px", color: holeColor(vp), padding: "2px 0" }}>
                                {vp === null ? "—" : vp === 0 ? "E" : vp > 0 ? `+${vp}` : vp}
                              </td>
                            );
                          })}
                          <td style={{ textAlign: "center", paddingLeft: "4px", fontSize: "11px", color: holeColor(sumVsPar(back)) }}>
                            {sumVsPar(back) === 0 ? "E" : sumVsPar(back) > 0 ? `+${sumVsPar(back)}` : sumVsPar(back)}
                          </td>
                          <td style={{ textAlign: "center", paddingLeft: "4px", fontSize: "12px", fontWeight: 600, color: holeColor(sumVsPar(holes)) }}>
                            {sumVsPar(holes) === 0 ? "E" : sumVsPar(holes) > 0 ? `+${sumVsPar(holes)}` : sumVsPar(holes)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: "center", color: "#4B5563", padding: "24px 0", fontSize: "13px" }}>
                No hole-by-hole data available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
