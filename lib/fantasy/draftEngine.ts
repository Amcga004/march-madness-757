import { createServiceClient } from "@/lib/supabase/service";

export type DraftStatus = "pending" | "open" | "in_progress" | "completed" | "locked";

export async function createDraft(params: {
  leagueId: string;
  eventId?: string;
  totalRounds: number;
  opensAt?: string;
  locksAt?: string;
}) {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("fantasy_drafts")
    .insert({
      league_id: params.leagueId,
      event_id: params.eventId ?? null,
      status: "pending",
      draft_type: "snake",
      current_pick_number: 1,
      current_round: 1,
      total_rounds: params.totalRounds,
      opens_at: params.opensAt ?? null,
      locks_at: params.locksAt ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Failed to create draft: ${error.message}`);
  return data!.id;
}

export async function openDraft(draftId: string) {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("fantasy_drafts")
    .update({ status: "open", updated_at: new Date().toISOString() })
    .eq("id", draftId)
    .eq("status", "pending");

  if (error) throw new Error(`Failed to open draft: ${error.message}`);
}

export async function lockDraft(draftId: string) {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("fantasy_drafts")
    .update({ status: "locked", updated_at: new Date().toISOString() })
    .eq("id", draftId)
    .in("status", ["pending", "open"]);

  if (error) throw new Error(`Failed to lock draft: ${error.message}`);
}

export async function startDraft(draftId: string) {
  const supabase = createServiceClient();

  const { data: draft, error: fetchError } = await supabase
    .from("fantasy_drafts")
    .select("*, fantasy_leagues(id, max_managers, roster_size, bench_size)")
    .eq("id", draftId)
    .maybeSingle();

  if (fetchError || !draft) throw new Error("Draft not found");
  if (draft.status !== "open") throw new Error("Draft must be open to start");

  const { data: members } = await supabase
    .from("fantasy_memberships")
    .select("id, user_id, draft_slot")
    .eq("league_id", draft.league_id)
    .order("draft_slot");

  if (!members || members.length === 0) throw new Error("No members in league");

  const firstManager = members[0];

  const { error } = await supabase
    .from("fantasy_drafts")
    .update({
      status: "in_progress",
      current_manager_id: firstManager.user_id,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", draftId);

  if (error) throw new Error(`Failed to start draft: ${error.message}`);
  return { draftId, firstManagerId: firstManager.user_id };
}

export async function makePick(params: {
  draftId: string;
  managerId: string;
  entityType: string;
  canonicalId: string;
  entityName: string;
  isBench?: boolean;
}) {
  const supabase = createServiceClient();

  // Load draft state
  const { data: draft, error: draftError } = await supabase
    .from("fantasy_drafts")
    .select("*")
    .eq("id", params.draftId)
    .maybeSingle();

  if (draftError || !draft) throw new Error("Draft not found");
  if (draft.status !== "in_progress") throw new Error("Draft is not in progress");
  if (draft.current_manager_id !== params.managerId) {
    throw new Error("It is not your turn to pick");
  }

  // Check entity not already picked
  const { data: existingPick } = await supabase
    .from("fantasy_draft_picks")
    .select("id")
    .eq("draft_id", params.draftId)
    .eq("canonical_id", params.canonicalId)
    .maybeSingle();

  if (existingPick) throw new Error(`${params.entityName} has already been drafted`);

  // Load members for snake order calculation
  const { data: members } = await supabase
    .from("fantasy_memberships")
    .select("user_id, draft_slot")
    .eq("league_id", draft.league_id)
    .order("draft_slot");

  if (!members || members.length === 0) throw new Error("No members found");

  const numManagers = members.length;
  const pickNumber = draft.current_pick_number;
  const roundNumber = draft.current_round;

  // Insert the pick
  const { error: pickError } = await supabase
    .from("fantasy_draft_picks")
    .insert({
      draft_id: params.draftId,
      league_id: draft.league_id,
      manager_id: params.managerId,
      pick_number: pickNumber,
      round_number: roundNumber,
      entity_type: params.entityType,
      canonical_id: params.canonicalId,
      entity_name: params.entityName,
      is_bench: params.isBench ?? false,
    });

  if (pickError) throw new Error(`Failed to record pick: ${pickError.message}`);

  // Add to roster
  await supabase.from("fantasy_rosters").insert({
    league_id: draft.league_id,
    event_id: draft.event_id ?? null,
    manager_id: params.managerId,
    entity_type: params.entityType,
    canonical_id: params.canonicalId,
    entity_name: params.entityName,
    roster_slot: params.isBench ? "bench" : "active",
    acquired_via: "draft",
  });

  // Calculate next pick in snake order
  const nextPickNumber = pickNumber + 1;
  const totalPicks = numManagers * draft.total_rounds;

  if (nextPickNumber > totalPicks) {
    // Draft complete
    await supabase
      .from("fantasy_drafts")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        current_pick_number: nextPickNumber,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.draftId);

    return { pickNumber, status: "completed" };
  }

  // Snake order: odd rounds go 1→N, even rounds go N→1
  const nextRound = Math.ceil(nextPickNumber / numManagers);
  const positionInRound = ((nextPickNumber - 1) % numManagers);
  const isEvenRound = nextRound % 2 === 0;
  const slotIndex = isEvenRound
    ? numManagers - 1 - positionInRound
    : positionInRound;

  const nextManager = members[slotIndex];

  await supabase
    .from("fantasy_drafts")
    .update({
      current_pick_number: nextPickNumber,
      current_round: nextRound,
      current_manager_id: nextManager.user_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.draftId);

  return {
    pickNumber,
    nextPickNumber,
    nextManagerId: nextManager.user_id,
    status: "in_progress",
  };
}

export async function getDraftState(draftId: string) {
  const supabase = createServiceClient();

  const { data: draft } = await supabase
    .from("fantasy_drafts")
    .select("*")
    .eq("id", draftId)
    .maybeSingle();

  if (!draft) throw new Error("Draft not found");

  const { data: picks } = await supabase
    .from("fantasy_draft_picks")
    .select("*")
    .eq("draft_id", draftId)
    .order("pick_number");

  const { data: members } = await supabase
    .from("fantasy_memberships")
    .select("user_id, display_name, draft_slot")
    .eq("league_id", draft.league_id)
    .order("draft_slot");

  return { draft, picks: picks ?? [], members: members ?? [] };
}

export async function undoLastPick(draftId: string, commissionerId: string) {
  const supabase = createServiceClient();

  const { data: draft } = await supabase
    .from("fantasy_drafts")
    .select("*, fantasy_leagues(commissioner_id)")
    .eq("id", draftId)
    .maybeSingle();

  if (!draft) throw new Error("Draft not found");
  if (draft.fantasy_leagues.commissioner_id !== commissionerId) {
    throw new Error("Only the commissioner can undo picks");
  }
  if (draft.status !== "in_progress") {
    throw new Error("Can only undo picks during an active draft");
  }

  // Get last pick
  const { data: lastPick } = await supabase
    .from("fantasy_draft_picks")
    .select("*")
    .eq("draft_id", draftId)
    .order("pick_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastPick) throw new Error("No picks to undo");

  // Remove from picks and rosters
  await supabase
    .from("fantasy_draft_picks")
    .delete()
    .eq("id", lastPick.id);

  await supabase
    .from("fantasy_rosters")
    .delete()
    .eq("league_id", draft.league_id)
    .eq("manager_id", lastPick.manager_id)
    .eq("canonical_id", lastPick.canonical_id);

  // Restore draft state to previous pick
  const prevPickNumber = lastPick.pick_number;
  const { data: members } = await supabase
    .from("fantasy_memberships")
    .select("user_id, draft_slot")
    .eq("league_id", draft.league_id)
    .order("draft_slot");

  const numManagers = members?.length ?? 1;
  const prevRound = Math.ceil(prevPickNumber / numManagers);
  const positionInRound = (prevPickNumber - 1) % numManagers;
  const isEvenRound = prevRound % 2 === 0;
  const slotIndex = isEvenRound
    ? numManagers - 1 - positionInRound
    : positionInRound;

  const prevManager = members?.[slotIndex];

  await supabase
    .from("fantasy_drafts")
    .update({
      current_pick_number: prevPickNumber,
      current_round: prevRound,
      current_manager_id: prevManager?.user_id ?? lastPick.manager_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", draftId);

  return { undone: lastPick.entity_name, restoredPickNumber: prevPickNumber };
}
