import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireAuth";
import {
  openDraft,
  startDraft,
  makePick,
  getDraftState,
  undoLastPick,
} from "@/lib/fantasy/draftEngine";
import { openLeagueForDraft } from "@/lib/fantasy/leagueManager";

export async function GET(request: NextRequest) {
  try {
    await requireUser();
    const { searchParams } = new URL(request.url);
    const draftId = searchParams.get("draftId");
    if (!draftId) {
      return NextResponse.json({ error: "draftId required" }, { status: 400 });
    }
    const state = await getDraftState(draftId);
    return NextResponse.json({ ok: true, ...state });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const { action } = body;

    if (action === "open_league") {
      const { leagueId, eventId } = body;
      const result = await openLeagueForDraft(leagueId, eventId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "open") {
      const { draftId } = body;
      await openDraft(draftId);
      return NextResponse.json({ ok: true });
    }

    if (action === "start") {
      const { draftId } = body;
      const result = await startDraft(draftId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "pick") {
      const { draftId, entityType, canonicalId, entityName, isBench } = body;
      if (!draftId || !entityType || !canonicalId || !entityName) {
        return NextResponse.json(
          { error: "Missing required fields" },
          { status: 400 }
        );
      }
      const result = await makePick({
        draftId,
        managerId: user.id,
        entityType,
        canonicalId,
        entityName,
        isBench: isBench ?? false,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "undo") {
      const { draftId } = body;
      const result = await undoLastPick(draftId, user.id);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
