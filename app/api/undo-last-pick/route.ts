import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/requireAuth";

export async function POST() {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  const { data: lastPick, error: fetchError } = await supabase
    .from("picks")
    .select("id, overall_pick")
    .order("overall_pick", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({
      ok: false,
      error: fetchError.message,
    });
  }

  if (!lastPick) {
    return NextResponse.json({
      ok: false,
      error: "No picks to undo.",
    });
  }

  const { error: deleteError } = await supabase
    .from("picks")
    .delete()
    .eq("id", lastPick.id);

  if (deleteError) {
    return NextResponse.json({
      ok: false,
      error: deleteError.message,
    });
  }

  return NextResponse.json({
    ok: true,
    message: "Last pick removed.",
  });
}