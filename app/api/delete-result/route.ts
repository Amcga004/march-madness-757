import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SCORING: Record<string, number> = {
  "Round of 64": 2,
  "Round of 32": 5,
  "Sweet 16": 10,
  "Elite Eight": 17,
  "Final Four": 25,
  Championship: 35,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = await createClient();

    const { gameId, leagueId } = body;

    if (!gameId || !leagueId) {
      return NextResponse.json(
        { ok: false, error: "Missing gameId or leagueId." },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabase
      .from("games")
      .delete()
      .eq("id", gameId);

    if (deleteError) {
      return NextResponse.json(
        { ok: false, error: deleteError.message },
        { status: 500 }
      );
    }

    const { data: remainingGames, error: gamesError } = await supabase
      .from("games")
      .select("round_name, winning_team_id, losing_team_id")
      .eq("league_id", leagueId);

    if (gamesError) {
      return NextResponse.json(
        { ok: false, error: gamesError.message },
        { status: 500 }
      );
    }

    const teamState = new Map<
      string,
      { total_points: number; eliminated: boolean }
    >();

    for (const game of remainingGames ?? []) {
      const winnerId = game.winning_team_id;
      const loserId = game.losing_team_id;
      const points = SCORING[game.round_name] ?? 0;

      if (winnerId) {
        const winner = teamState.get(winnerId) ?? {
          total_points: 0,
          eliminated: false,
        };

        winner.total_points += points;
        winner.eliminated = false;
        teamState.set(winnerId, winner);
      }

      if (loserId) {
        const loser = teamState.get(loserId) ?? {
          total_points: 0,
          eliminated: false,
        };

        loser.eliminated = true;
        teamState.set(loserId, loser);
      }
    }

    const { error: clearError } = await supabase
      .from("team_results")
      .delete()
      .eq("league_id", leagueId);

    if (clearError) {
      return NextResponse.json(
        { ok: false, error: clearError.message },
        { status: 500 }
      );
    }

    const rebuiltRows = Array.from(teamState.entries()).map(([teamId, state]) => ({
      league_id: leagueId,
      team_id: teamId,
      total_points: state.total_points,
      eliminated: state.eliminated,
    }));

    if (rebuiltRows.length > 0) {
      const { error: rebuildError } = await supabase
        .from("team_results")
        .insert(rebuiltRows);

      if (rebuildError) {
        return NextResponse.json(
          { ok: false, error: rebuildError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Failed to delete result." },
      { status: 500 }
    );
  }
}