"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import TeamLogo from "./TeamLogo";

export type ScoresGameCardGame = {
  external_game_id: string;
  espn_status: string | null;
  espn_period: number | null;
  espn_clock: string | null;
  start_time: string | null;
  round_name: string | null;
  home_team_name: string | null;
  away_team_name: string | null;
  home_score: number | null;
  away_score: number | null;
  raw_payload: unknown;
  home_seed: number | null;
  away_seed: number | null;
  home_manager: string | null;
  away_manager: string | null;
  bracket_href: string;
};

type TeamStats = {
  fgPct: string;
  threePtPct: string;
  ftPct: string;
  rebounds: string;
  assists: string;
  turnovers: string;
};

function formatEasternDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatEasternTime(value: string) {
  return new Date(value).toLocaleString([], {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isLiveStatus(status: string | null | undefined) {
  if (!status) return false;

  return (
    status === "STATUS_IN_PROGRESS" ||
    status === "STATUS_END_PERIOD" ||
    status === "STATUS_HALFTIME" ||
    status.includes("HALFTIME")
  );
}

function isFinalStatus(status: string | null | undefined) {
  return status === "STATUS_FINAL" || status === "complete";
}

function getDisplayStatus(game: ScoresGameCardGame) {
  const status = game.espn_status ?? null;

  if (!status) return "Scheduled";

  if (status === "STATUS_FINAL" || status === "complete") {
    return "Final";
  }

  if (status.includes("HALFTIME")) {
    return "Halftime";
  }

  if (
    status === "STATUS_IN_PROGRESS" ||
    status === "STATUS_END_PERIOD" ||
    status === "STATUS_HALFTIME"
  ) {
    const clock = game.espn_clock && game.espn_clock !== "0:00" ? game.espn_clock : "";
    const period = game.espn_period && game.espn_period > 0 ? `${game.espn_period}H` : "";
    const pieces = [clock, period].filter(Boolean);

    return pieces.length > 0 ? `Live • ${pieces.join(" ")}` : "Live";
  }

  if (status === "STATUS_SCHEDULED" && game.start_time) {
    return formatEasternTime(game.start_time);
  }

  return status.replace("STATUS_", "").replaceAll("_", " ").trim();
}

function parseRawPayload(rawPayload: unknown): any | null {
  if (!rawPayload) return null;

  if (typeof rawPayload === "string") {
    try {
      return JSON.parse(rawPayload);
    } catch {
      return null;
    }
  }

  if (typeof rawPayload === "object") {
    return rawPayload;
  }

  return null;
}

function getCompetitorsFromPayload(rawPayload: unknown): any[] {
  const parsed = parseRawPayload(rawPayload);
  return parsed?.competitions?.[0]?.competitors ?? [];
}

function findCompetitorBySide(rawPayload: unknown, side: "home" | "away") {
  const competitors = getCompetitorsFromPayload(rawPayload);
  return competitors.find((competitor: any) => competitor?.homeAway === side) ?? null;
}

function getStatDisplayValue(competitor: any, statName: string) {
  const stats = competitor?.statistics ?? [];
  const match = stats.find((stat: any) => stat?.name === statName);
  return match?.displayValue ?? "—";
}

function getTeamStats(rawPayload: unknown, side: "home" | "away"): TeamStats | null {
  const competitor = findCompetitorBySide(rawPayload, side);
  if (!competitor) return null;

  return {
    fgPct: getStatDisplayValue(competitor, "fieldGoalPct"),
    threePtPct: getStatDisplayValue(competitor, "threePointFieldGoalPct"),
    ftPct: getStatDisplayValue(competitor, "freeThrowPct"),
    rebounds: getStatDisplayValue(competitor, "rebounds"),
    assists: getStatDisplayValue(competitor, "assists"),
    turnovers: getStatDisplayValue(competitor, "turnovers"),
  };
}

function OwnershipTag({ manager }: { manager: string | null }) {
  if (!manager) return null;

  return (
    <div className="mt-0.5 text-[10px] font-medium text-slate-400">
      {manager}
    </div>
  );
}

function StatRow({
  label,
  awayValue,
  homeValue,
}: {
  label: string;
  awayValue: string;
  homeValue: string;
}) {
  return (
    <div className="grid grid-cols-[56px_1fr_1fr] items-center gap-2 rounded-xl border border-slate-700/80 bg-[#0f172a] px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </div>
      <div className="text-center text-xs font-semibold text-white">{awayValue}</div>
      <div className="text-center text-xs font-semibold text-white">{homeValue}</div>
    </div>
  );
}

function TeamStatsBlock({
  awayName,
  homeName,
  awayStats,
  homeStats,
}: {
  awayName: string;
  homeName: string;
  awayStats: TeamStats | null;
  homeStats: TeamStats | null;
}) {
  if (!awayStats || !homeStats) {
    return (
      <div className="rounded-xl border border-slate-700/80 bg-[#0f172a] px-3 py-3 text-xs text-slate-400">
        Team stats not available yet.
      </div>
    );
  }

  return (
    <div className="mt-2.5">
      <div className="mb-2 grid grid-cols-[56px_1fr_1fr] items-center gap-2 px-1">
        <div />
        <div className="truncate text-center text-[11px] font-semibold text-slate-300">
          {awayName}
        </div>
        <div className="truncate text-center text-[11px] font-semibold text-slate-300">
          {homeName}
        </div>
      </div>

      <div className="space-y-1.5">
        <StatRow label="FG%" awayValue={awayStats.fgPct} homeValue={homeStats.fgPct} />
        <StatRow label="3P%" awayValue={awayStats.threePtPct} homeValue={homeStats.threePtPct} />
        <StatRow label="FT%" awayValue={awayStats.ftPct} homeValue={homeStats.ftPct} />
        <StatRow label="REB" awayValue={awayStats.rebounds} homeValue={homeStats.rebounds} />
        <StatRow label="AST" awayValue={awayStats.assists} homeValue={homeStats.assists} />
        <StatRow label="TO" awayValue={awayStats.turnovers} homeValue={homeStats.turnovers} />
      </div>
    </div>
  );
}

function LivePulse() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-400" />
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-red-300">
        Live
      </span>
    </span>
  );
}

function ImportanceBadge({
  ownedCount,
}: {
  ownedCount: number;
}) {
  if (ownedCount <= 0) return null;

  const label = ownedCount === 2 ? "League Battle" : "League Owned";
  const classes =
    ownedCount === 2
      ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
      : "border-blue-500/30 bg-blue-500/10 text-blue-200";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] ${classes}`}>
      {label}
    </span>
  );
}

function ImpactLite({
  awayManager,
  homeManager,
  isFinal,
}: {
  awayManager: string | null;
  homeManager: string | null;
  isFinal: boolean;
}) {
  if (!awayManager && !homeManager) return null;

  const bothOwned = !!awayManager && !!homeManager;

  return (
    <div className="mt-2 rounded-xl border border-slate-700/80 bg-[#0f172a] px-3 py-2 text-[11px] text-slate-300">
      {bothOwned ? (
        <span>
          <span className="font-semibold text-white">{awayManager}</span> vs{" "}
          <span className="font-semibold text-white">{homeManager}</span> ownership battle.
          {!isFinal ? " One manager loses a live team here." : " Result already impacted the league."}
        </span>
      ) : (
        <span>
          <span className="font-semibold text-white">{awayManager ?? homeManager}</span> has the only league-owned team in this game.
        </span>
      )}
    </div>
  );
}

export default function ScoresGameCard({
  game,
}: {
  game: ScoresGameCardGame;
}) {
  const isLive = isLiveStatus(game.espn_status);
  const isFinal = isFinalStatus(game.espn_status);
  const statusLabel = getDisplayStatus(game);

  const awayWon =
    isFinal &&
    game.away_score !== null &&
    game.home_score !== null &&
    game.away_score > game.home_score;

  const homeWon =
    isFinal &&
    game.home_score !== null &&
    game.away_score !== null &&
    game.home_score > game.away_score;

  const awayStats = getTeamStats(game.raw_payload, "away");
  const homeStats = getTeamStats(game.raw_payload, "home");
  const showStats = isLive || isFinal;

  const ownedCount = Number(!!game.away_manager) + Number(!!game.home_manager);

  const cardClasses = isLive
    ? "border-red-500/60 bg-[#1a1220] shadow-[0_0_0_1px_rgba(239,68,68,0.16),0_0_20px_rgba(239,68,68,0.12)]"
    : "border-slate-700/80 bg-[#172033]";

  const statusClasses = isLive ? "text-red-300" : "text-slate-400";

  const prevSignatureRef = useRef<string>("");
  const [flashAway, setFlashAway] = useState(false);
  const [flashHome, setFlashHome] = useState(false);
  const [flashStatus, setFlashStatus] = useState(false);

  const signature = useMemo(
    () =>
      JSON.stringify({
        away: game.away_score,
        home: game.home_score,
        status: game.espn_status,
        clock: game.espn_clock,
        period: game.espn_period,
      }),
    [game.away_score, game.home_score, game.espn_status, game.espn_clock, game.espn_period]
  );

  useEffect(() => {
    if (!prevSignatureRef.current) {
      prevSignatureRef.current = signature;
      return;
    }

    const prev = JSON.parse(prevSignatureRef.current);
    const next = JSON.parse(signature);

    if (prev.away !== next.away) {
      setFlashAway(true);
      window.setTimeout(() => setFlashAway(false), 900);
    }

    if (prev.home !== next.home) {
      setFlashHome(true);
      window.setTimeout(() => setFlashHome(false), 900);
    }

    if (
      prev.status !== next.status ||
      prev.clock !== next.clock ||
      prev.period !== next.period
    ) {
      setFlashStatus(true);
      window.setTimeout(() => setFlashStatus(false), 900);
    }

    prevSignatureRef.current = signature;
  }, [signature]);

  return (
    <div className={`rounded-2xl border px-3 py-3 transition ${cardClasses}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="truncate text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            {game.round_name ?? "Tournament Game"}
          </div>
          <ImportanceBadge ownedCount={ownedCount} />
        </div>

        <div className={`flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] ${statusClasses} ${flashStatus ? "opacity-100" : ""}`}>
          {isLive ? <LivePulse /> : null}
          <span className={flashStatus ? "text-white" : ""}>{statusLabel}</span>
        </div>
      </div>

      <div className="grid gap-1.5">
        <div
          className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 transition ${
            awayWon
              ? "border-green-500/60 bg-green-500/10 text-green-200"
              : homeWon
              ? "border-red-500/60 bg-red-500/10 text-red-200 line-through"
              : "border-slate-700/80 bg-[#0f172a] text-white"
          } ${flashAway ? "ring-2 ring-red-400/50" : ""}`}
        >
          <div className="flex min-w-0 items-start gap-2">
            <TeamLogo teamName={game.away_team_name ?? "Away"} size={16} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                {game.away_seed ? `${game.away_seed}. ` : ""}
                {game.away_team_name ?? "Away"}
              </div>
              <OwnershipTag manager={game.away_manager} />
            </div>
          </div>
          <div className={`text-base font-extrabold ${isLive ? "sm:text-xl" : "sm:text-lg"}`}>
            {game.away_score ?? "—"}
          </div>
        </div>

        <div
          className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 transition ${
            homeWon
              ? "border-green-500/60 bg-green-500/10 text-green-200"
              : awayWon
              ? "border-red-500/60 bg-red-500/10 text-red-200 line-through"
              : "border-slate-700/80 bg-[#0f172a] text-white"
          } ${flashHome ? "ring-2 ring-red-400/50" : ""}`}
        >
          <div className="flex min-w-0 items-start gap-2">
            <TeamLogo teamName={game.home_team_name ?? "Home"} size={16} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                {game.home_seed ? `${game.home_seed}. ` : ""}
                {game.home_team_name ?? "Home"}
              </div>
              <OwnershipTag manager={game.home_manager} />
            </div>
          </div>
          <div className={`text-base font-extrabold ${isLive ? "sm:text-xl" : "sm:text-lg"}`}>
            {game.home_score ?? "—"}
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-3">
        <div className="text-[11px] text-slate-400">
          {game.start_time ? formatEasternDateTime(game.start_time) : "Tip time pending"}
        </div>

        <Link
          href={game.bracket_href}
          className="inline-flex items-center rounded-full border border-slate-700/80 bg-[#0f172a] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-200 transition hover:bg-[#162033]"
        >
          Bracket
        </Link>
      </div>

      {showStats ? (
        <details className="group mt-2 rounded-2xl border border-slate-700/80 bg-[#111827]/70 p-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
              Team Stats
            </div>
            <div className="shrink-0 text-slate-300 transition-transform duration-200 group-open:rotate-180">
              ▼
            </div>
          </summary>

          <TeamStatsBlock
            awayName={game.away_team_name ?? "Away"}
            homeName={game.home_team_name ?? "Home"}
            awayStats={awayStats}
            homeStats={homeStats}
          />

          <ImpactLite
            awayManager={game.away_manager}
            homeManager={game.home_manager}
            isFinal={isFinal}
          />
        </details>
      ) : null}
    </div>
  );
}