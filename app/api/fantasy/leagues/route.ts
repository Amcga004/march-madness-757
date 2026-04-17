import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireAuth";
import { createFantasyLeague, joinLeague } from "@/lib/fantasy/leagueManager";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const { action } = body;

    if (action === "create") {
      const { sportKey, name, mode, season, maxManagers, eventId } = body;
      if (!sportKey || !name || !mode || !season || !maxManagers) {
        return NextResponse.json(
          { error: "Missing required fields" },
          { status: 400 }
        );
      }
      const league = await createFantasyLeague({
        sportKey,
        name,
        mode,
        season,
        maxManagers,
        commissionerId: user.id,
        eventId,
      });
      return NextResponse.json({ ok: true, league });
    }

    if (action === "join") {
      const { leagueId, displayName } = body;
      if (!leagueId || !displayName) {
        return NextResponse.json(
          { error: "Missing required fields" },
          { status: 400 }
        );
      }
      await joinLeague({ leagueId, userId: user.id, displayName });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
