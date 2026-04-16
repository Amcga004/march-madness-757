import { NextRequest, NextResponse } from "next/server";
import { parseRequestedDates, runSyncCycleForDates } from "@/lib/runSyncCycle";
import { requireUser } from "@/lib/requireAuth";

export async function POST(request: NextRequest) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const authHeader = request.headers.get("authorization");
    const expected = process.env.CRON_SECRET;

    if (!expected || authHeader !== `Bearer ${expected}`) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const requestedDates = parseRequestedDates(body);
    const result = await runSyncCycleForDates(requestedDates);

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to run sync cycle.";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}