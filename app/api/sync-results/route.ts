import { NextResponse } from "next/server";
import { syncPublicResults } from "@/lib/sync";
import { requireUser } from "@/lib/requireAuth";

export async function POST() {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncPublicResults();
    return NextResponse.json({
      ok: true,
      applied: result.applied,
      skipped: result.skipped,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown sync error";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}