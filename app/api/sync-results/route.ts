import { NextResponse } from "next/server";
import { syncPublicResults } from "@/lib/sync";

export async function POST() {
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