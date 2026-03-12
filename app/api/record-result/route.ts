import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SCORING: Record<string, number> = {
  "Round of 64": 2,
  "Round of 32": 4,
  "Sweet 16": 7,
  "Elite Eight": 13,
  "Final Four": 20,
  Championship: 37,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = await createClient();

    const { leagueId, winnerTeamId, loserTeamId, roundName } = body;

    if (!leagueId || !winnerTeamId || !loserTeamId || !roundName) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields." },
        { status: 400 }
      );
    }

    if (winnerTeamId === loserTeamId) {
      return NextResponse.json(
        { ok: false, error: "Winner and loser cannot be the same team." },
        { status: 400 }
      );
    }

    const { data: existingGame, error: existingGameError } = await supabase
      .from("games")
      .select("id")
      .eq("league_id", leagueId)
      .eq("round_name", roundName)
      .eq("winning_team_id", winnerTeamId)
      .eq("losing_team_id", loserTeamId)
      .maybeSingle();

    if (existingGameError) {
      return NextResponse.json(
        { ok: false, error: existingGameError.message },
        { status: 500 }
      );
    }

    if (existingGame) {
      return NextResponse.json(
        { ok: false, error: "That game result has already been recorded." },
        { status: 400 }
      );
    }

    const points = SCORING[roundName] ?? 0;

    const { error: gameError } = await supabase.from("games").insert({
      league_id: leagueId,
      external_game_id: crypto.randomUUID(),
      round_name: roundName,
      winning_team_id: winnerTeamId,
      losing_team_id: loserTeamId,
      status: "complete",
    });

    if (gameError) {
      return NextResponse.json(
        { ok: false, error: gameError.message },
        { status: 500 }
      );
    }

    const { data: winnerExisting } = await supabase
      .from("team_results")
      .select("*")
      .eq("league_id", leagueId)
      .eq("team_id", winnerTeamId)
      .maybeSingle();

    const { data: loserExisting } = await supabase
      .from("team_results")
      .select("*")
      .eq("league_id", leagueId)
      .eq("team_id", loserTeamId)
      .maybeSingle();

    const { error: winnerError } = await supabase.from("team_results").upsert(
      {
        league_id: leagueId,
        team_id: winnerTeamId,
        eliminated: false,
        total_points: (winnerExisting?.total_points ?? 0) + points,
      },
      { onConflict: "league_id,team_id" }
    );

    if (winnerError) {
      return NextResponse.json(
        { ok: false, error: winnerError.message },
        { status: 500 }
      );
    }

    const { error: loserError } = await supabase.from("team_results").upsert(
      {
        league_id: leagueId,
        team_id: loserTeamId,
        eliminated: true,
        total_points: loserExisting?.total_points ?? 0,
      },
      { onConflict: "league_id,team_id" }
    );

    if (loserError) {
      return NextResponse.json(
        { ok: false, error: loserError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Failed to record result." },
      { status: 500 }
    );
  }
}