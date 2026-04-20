"use server";

import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/authHelpers";
import { createServiceClient } from "@/lib/supabase/service";

export async function joinLeague(leagueId: string, displayName: string): Promise<{ error: string } | never> {
  const user = await getUser();
  if (!user) redirect(`/login?next=/join/${leagueId}`);

  if (!displayName.trim()) return { error: "Display name is required" };

  const supabase = createServiceClient();

  // Validate league exists and is open
  const { data: league, error: leagueError } = await supabase
    .from("leagues_v2")
    .select("id, name, max_members, draft_status")
    .eq("id", leagueId)
    .maybeSingle();

  if (leagueError || !league) return { error: "League not found" };
  if (league.draft_status !== "predraft") return { error: "This league is no longer accepting new members" };

  // Check current member count via league_draft_order_v2 view
  const { count } = await supabase
    .from("league_draft_order_v2")
    .select("*", { count: "exact", head: true })
    .eq("league_id", leagueId);

  if ((count ?? 0) >= (league.max_members ?? 8)) {
    return { error: "This league is full" };
  }

  // Check if user already joined
  const { data: existing } = await supabase
    .from("league_draft_order_v2")
    .select("user_id")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    redirect(`/masters/${leagueId}/hub`);
  }

  // Insert into membership table
  // NOTE: league_draft_order_v2 is a view — confirm underlying table name with DB admin.
  // Likely table: league_members_v2 with columns (league_id, user_id, display_name)
  const { error: insertError } = await supabase
    .from("league_members_v2")
    .insert({
      league_id: leagueId,
      user_id: user.id,
      display_name: displayName.trim(),
    });

  if (insertError) {
    return { error: `Could not join league: ${insertError.message}` };
  }

  redirect(`/masters/${leagueId}/hub`);
}
