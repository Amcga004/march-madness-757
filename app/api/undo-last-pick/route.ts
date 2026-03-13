import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
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