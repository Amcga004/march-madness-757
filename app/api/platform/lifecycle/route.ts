import { NextRequest, NextResponse } from "next/server";
import { runLifecycleCheck } from "@/lib/platform/eventLifecycle";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;

  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await runLifecycleCheck();
    return NextResponse.json({
      ok: true,
      ...results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lifecycle check failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
