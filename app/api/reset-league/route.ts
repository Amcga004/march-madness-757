import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/requireAuth";

export async function POST() {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  const { error: picksError } = await supabase.from("picks").delete().neq("id", "");
  if (picksError) {
    return NextResponse.json({ ok: false, error: picksError.message });
  }

  const { error: gamesError } = await supabase.from("games").delete().neq("id", "");
  if (gamesError) {
    return NextResponse.json({ ok: false, error: gamesError.message });
  }

  const { error: teamResultsError } = await supabase
    .from("team_results")
    .delete()
    .neq("id", "");
  if (teamResultsError) {
    return NextResponse.json({ ok: false, error: teamResultsError.message });
  }

  return NextResponse.json({
    ok: true,
    message: "League draft and results have been reset.",
  });
}