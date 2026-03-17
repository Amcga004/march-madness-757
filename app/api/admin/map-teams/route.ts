import { NextResponse } from "next/server";
import { mapEspnTeamsToInternal } from "@/lib/teamMapping";

export async function POST() {
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