import { NextResponse } from "next/server";
import { mapEspnTeamsToInternal } from "@/lib/teamMapping";
import { requireUser } from "@/lib/requireAuth";

export async function POST() {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await mapEspnTeamsToInternal();

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}