import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/requireAuth";

export async function POST(request: NextRequest) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const supabase = await createClient();

    const { leagueId, memberId, teamId, overallPick, snakeRound } = body;

    const { error } = await supabase.from("picks").insert({
      league_id: leagueId,
      member_id: memberId,
      team_id: teamId,
      overall_pick: overallPick,
      snake_round: snakeRound,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Failed to create pick" },
      { status: 500 }
    );
  }
}