import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireAuth";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const supabase = createServiceClient();

    const { data: bets } = await supabase
      .from("bet_slips")
      .select("*, bet_outcomes(*)")
      .eq("user_id", user.id)
      .order("added_at", { ascending: false });

    const stats = {
      total: bets?.length ?? 0,
      won: bets?.filter((b) => b.status === "won").length ?? 0,
      lost: bets?.filter((b) => b.status === "lost").length ?? 0,
      pending: bets?.filter((b) => b.status === "pending").length ?? 0,
      totalProfit: bets?.reduce((sum, b) => {
        const outcome = b.bet_outcomes?.[0];
        return sum + (outcome?.profit_loss ?? 0);
      }, 0) ?? 0,
    };

    return NextResponse.json({ ok: true, bets: bets ?? [], stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const { action } = body;
    const supabase = createServiceClient();

    if (action === "add") {
      const {
        signalId, sportKey, gameDate, homeTeam, awayTeam,
        signalType, side, bookmaker, odds, stake, edgePctAtAdd, tierAtAdd
      } = body;

      if (!sportKey || !gameDate || !homeTeam || !awayTeam || !signalType || !side || !odds) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

      const { data, error } = await supabase
        .from("bet_slips")
        .insert({
          user_id: user.id,
          signal_id: signalId ?? null,
          sport_key: sportKey,
          game_date: gameDate,
          home_team: homeTeam,
          away_team: awayTeam,
          signal_type: signalType,
          side,
          bookmaker: bookmaker ?? null,
          odds,
          stake: stake ?? null,
          edge_pct_at_add: edgePctAtAdd ?? null,
          tier_at_add: tierAtAdd ?? null,
          status: "pending",
        })
        .select("id")
        .maybeSingle();

      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, betSlipId: data?.id });
    }

    if (action === "settle") {
      const { betSlipId, outcome, profitLoss, closingOdds } = body;

      await supabase
        .from("bet_slips")
        .update({ status: outcome, updated_at: new Date().toISOString() })
        .eq("id", betSlipId)
        .eq("user_id", user.id);

      await supabase.from("bet_outcomes").insert({
        bet_slip_id: betSlipId,
        user_id: user.id,
        sport_key: body.sportKey,
        outcome,
        profit_loss: profitLoss ?? null,
        closing_odds: closingOdds ?? null,
      });

      return NextResponse.json({ ok: true });
    }

    if (action === "delete") {
      const { betSlipId } = body;
      await supabase
        .from("bet_slips")
        .delete()
        .eq("id", betSlipId)
        .eq("user_id", user.id)
        .eq("status", "pending");

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
