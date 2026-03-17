import { NextResponse } from "next/server";
import { promoteResults } from "@/lib/promoteResults";

export async function POST() {
  try {
    const result = await promoteResults();

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