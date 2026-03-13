import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type LeagueMemberRow = {
  id: string;
  manager_name: string;
};

type PickRow = {
  manager_id: string;
  team_id: string;
};

type TeamResultRow = {
  team_id: string;
  points: number | null;
  is_eliminated: boolean | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const seasonYear = Number(body?.seasonYear);

    if (!seasonYear || Number.isNaN(seasonYear)) {
      return NextResponse.json(
        { ok: false, error: "A valid seasonYear is required." },
        { status: 400 }
      );
    }

    const { data: existingArchive, error: existingArchiveError } =
      await supabaseAdmin
        .from("season_final_standings")
        .select("id")
        .eq("season_year", seasonYear)
        .limit(1);

    if (existingArchiveError) {
      return NextResponse.json(
        { ok: false, error: existingArchiveError.message },
        { status: 500 }
      );
    }

    if (existingArchive && existingArchive.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Season ${seasonYear} has already been archived.`,
        },
        { status: 409 }
      );
    }

    const { data: members, error: membersError } = await supabaseAdmin
      .from("league_members")
      .select("id, manager_name")
      .order("manager_name", { ascending: true });

    if (membersError) {
      return NextResponse.json(
        { ok: false, error: membersError.message },
        { status: 500 }
      );
    }

    if (!members || members.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No league members found." },
        { status: 400 }
      );
    }

    const { data: picks, error: picksError } = await supabaseAdmin
      .from("picks")
      .select("manager_id, team_id");

    if (picksError) {
      return NextResponse.json(
        { ok: false, error: picksError.message },
        { status: 500 }
      );
    }

    const { data: teamResults, error: teamResultsError } = await supabaseAdmin
      .from("team_results")
      .select("team_id, points, is_eliminated");

    if (teamResultsError) {
      return NextResponse.json(
        { ok: false, error: teamResultsError.message },
        { status: 500 }
      );
    }

    const membersTyped = (members ?? []) as LeagueMemberRow[];
    const picksTyped = (picks ?? []) as PickRow[];
    const resultsTyped = (teamResults ?? []) as TeamResultRow[];

    const resultsByTeamId = new Map<string, TeamResultRow>();
    for (const result of resultsTyped) {
      resultsByTeamId.set(result.team_id, result);
    }

    const standings = membersTyped.map((member) => {
      const memberPicks = picksTyped.filter((pick) => pick.manager_id === member.id);
      const draftedTeams = memberPicks.map((pick) => pick.team_id);

      let finalPoints = 0;
      let liveTeams = 0;

      for (const teamId of draftedTeams) {
        const result = resultsByTeamId.get(teamId);
        finalPoints += result?.points ?? 0;

        if (result && result.is_eliminated === false) {
          liveTeams += 1;
        }
      }

      return {
        manager_name: member.manager_name,
        final_points: finalPoints,
        live_teams: liveTeams,
        drafted_teams: draftedTeams,
      };
    });

    const rankedStandings = standings
      .sort((a, b) => {
        if (b.final_points !== a.final_points) {
          return b.final_points - a.final_points;
        }
        if (b.live_teams !== a.live_teams) {
          return b.live_teams - a.live_teams;
        }
        return a.manager_name.localeCompare(b.manager_name);
      })
      .map((row, index) => ({
        season_year: seasonYear,
        manager_name: row.manager_name,
        final_rank: index + 1,
        final_points: row.final_points,
        live_teams: row.live_teams,
        drafted_teams: row.drafted_teams,
      }));

    const { error: insertError } = await supabaseAdmin
      .from("season_final_standings")
      .insert(rankedStandings);

    if (insertError) {
      return NextResponse.json(
        { ok: false, error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      archivedSeason: seasonYear,
      rowsInserted: rankedStandings.length,
      standings: rankedStandings,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}