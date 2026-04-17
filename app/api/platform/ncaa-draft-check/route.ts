import { NextRequest, NextResponse } from "next/server";
import { checkAndLockNcaaDrafts } from "@/lib/fantasy/ncaaAutomation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;

  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await checkAndLockNcaaDrafts();
    return NextResponse.json({
      ok: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Check failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
