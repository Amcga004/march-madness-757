import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { runGolfScoringSync } from "@/lib/fantasy/golfAutomation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;

  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();

    // Find the currently active golf event
    const { data: activeEvent } = await supabase
      .from("platform_events")
      .select("id, name, metadata")
      .eq("sport_key", "pga")
      .eq("status", "active")
      .maybeSingle();

    if (!activeEvent) {
      return NextResponse.json({
        ok: true,
        message: "No active golf tournament right now",
        timestamp: new Date().toISOString(),
      });
    }

    const result = await runGolfScoringSync(activeEvent.id);
    const { ok: _ok, ...resultData } = result;
    return NextResponse.json({
      ok: true,
      event: activeEvent.name,
      ...resultData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
