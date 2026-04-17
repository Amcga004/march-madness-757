import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireAuth";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: NextRequest) {
  try {
    await requireUser();
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get("leagueId");
    const eventId = searchParams.get("eventId");

    if (!leagueId) {
      return NextResponse.json({ error: "leagueId required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    let query = supabase
      .from("fantasy_standings")
      .select("*")
      .eq("league_id", leagueId)
      .order("rank");

    if (eventId) query = query.eq("event_id", eventId);

    const { data: standings } = await query;

    return NextResponse.json({ ok: true, standings: standings ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
