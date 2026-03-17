import { NextRequest, NextResponse } from "next/server";
import { runSyncCycleForDates } from "@/lib/runSyncCycle";

export const dynamic = "force-dynamic";

function buildRollingDateWindow(daysBack = 2, daysForward = 5) {
  const now = new Date();
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dates: string[] = [];

  for (let offset = -daysBack; offset <= daysForward; offset += 1) {
    const next = new Date(base);
    next.setUTCDate(base.getUTCDate() + offset);

    const yyyy = next.getUTCFullYear();
    const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(next.getUTCDate()).padStart(2, "0");

    dates.push(`${yyyy}${mm}${dd}`);
  }

  return dates;
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const expected = process.env.CRON_SECRET;

    if (!expected || authHeader !== `Bearer ${expected}`) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const requestedDates = buildRollingDateWindow(2, 5);
    const result = await runSyncCycleForDates(requestedDates);

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to run cron sync.";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}