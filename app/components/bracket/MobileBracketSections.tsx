"use client";

import { useState } from "react";

type MatchupTeam = {
  id: string | null;
  name: string;
  seed: number | null;
  manager: string | null;
};

type Matchup = {
  top: MatchupTeam;
  bottom: MatchupTeam;
  winnerId: string | null;
  loserId: string | null;
};

type ExternalGameSync = {
  id: string;
  external_game_id: string;
  espn_event_name: string | null;
  espn_status: string | null;
  espn_period: number | null;
  espn_clock: string | null;
  start_time: string | null;
  round_name: string | null;
  home_team_name: string | null;
  away_team_name: string | null;
  home_score: number | null;
  away_score: number | null;
  mapped_home_team_id: string | null;
  mapped_away_team_id: string | null;
};

type RegionBracket = {
  region: string;
  round64: Matchup[];
  round32: Matchup[];
  sweet16: Matchup[];
  elite8: Matchup[];
};

type Props = {
  regions: RegionBracket[];
  renderMatchupCard: (
    matchup: Matchup,
    externalGame: ExternalGameSync | null,
    key: string
  ) => React.ReactNode;
  findExternalGameForTeams: (
    externalGames: ExternalGameSync[],
    teamAId: string | null,
    teamBId: string | null
  ) => ExternalGameSync | null;
  externalGames: ExternalGameSync[];
};

export default function MobileBracketSections({
  regions,
  renderMatchupCard,
  findExternalGameForTeams,
  externalGames,
}: Props) {
  const [openRegions, setOpenRegions] = useState<Record<string, boolean>>({
    East: true,
    West: false,
    South: false,
    Midwest: false,
  });

  function toggleRegion(region: string) {
    setOpenRegions((current) => ({
      ...current,
      [region]: !current[region],
    }));
  }

  return (
    <div className="space-y-4 lg:hidden">
      {regions.map((region) => {
        const isOpen = !!openRegions[region.region];

        return (
          <section
            key={region.region}
            className="rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.28)]"
          >
            <button
              type="button"
              onClick={() => toggleRegion(region.region)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div>
                <h3 className="text-xl font-bold text-white">{region.region} Region</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Tap to {isOpen ? "collapse" : "expand"}
                </p>
              </div>

              <div className="text-2xl font-bold text-slate-300">
                {isOpen ? "−" : "+"}
              </div>
            </button>

            {isOpen ? (
              <div className="mt-4 space-y-5">
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Round of 64
                  </h4>
                  <div className="space-y-3">
                    {region.round64.map((matchup, index) => {
                      const externalGame = findExternalGameForTeams(
                        externalGames,
                        matchup.top.id,
                        matchup.bottom.id
                      );

                      return renderMatchupCard(
                        matchup,
                        externalGame,
                        `${region.region}-r64-${index}`
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Round of 32
                  </h4>
                  <div className="space-y-3">
                    {region.round32.map((matchup, index) => {
                      const externalGame = findExternalGameForTeams(
                        externalGames,
                        matchup.top.id,
                        matchup.bottom.id
                      );

                      return renderMatchupCard(
                        matchup,
                        externalGame,
                        `${region.region}-r32-${index}`
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Sweet 16
                  </h4>
                  <div className="space-y-3">
                    {region.sweet16.map((matchup, index) => {
                      const externalGame = findExternalGameForTeams(
                        externalGames,
                        matchup.top.id,
                        matchup.bottom.id
                      );

                      return renderMatchupCard(
                        matchup,
                        externalGame,
                        `${region.region}-s16-${index}`
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Elite Eight
                  </h4>
                  <div className="space-y-3">
                    {region.elite8.map((matchup, index) => {
                      const externalGame = findExternalGameForTeams(
                        externalGames,
                        matchup.top.id,
                        matchup.bottom.id
                      );

                      return renderMatchupCard(
                        matchup,
                        externalGame,
                        `${region.region}-e8-${index}`
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}