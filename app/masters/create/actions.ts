"use server";

import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/authHelpers";
import { createServiceClient } from "@/lib/supabase/service";

export async function deleteLeague(leagueId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await getUser();
    if (!user) return { ok: false, error: "Not authenticated" };

    const supabase = createServiceClient();

    // Verify commissioner
    const { data: league } = await supabase
      .from("leagues_v2")
      .select("id, created_by")
      .eq("id", leagueId)
      .maybeSingle();

    if (!league) return { ok: false, error: "League not found" };
    if (league.created_by !== user.id) return { ok: false, error: "Only the commissioner can delete this league" };

    // Delete child rows first
    await supabase.from("league_draft_order_v2").delete().eq("league_id", leagueId);

    // Delete the league (commissioner guard at DB level too)
    const { error: deleteError } = await supabase
      .from("leagues_v2")
      .delete()
      .eq("id", leagueId)
      .eq("created_by", user.id);

    if (deleteError) return { ok: false, error: deleteError.message };

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

export async function createLeague(formData: {
  platformEventId: string;
  name: string;
  maxManagers: number;
  rosterSize: number;
}): Promise<{ error: string } | never> {
  try {
    const user = await getUser();
    if (!user) redirect("/login");

    if (!formData.name.trim()) return { error: "League name is required" };
    if (!formData.platformEventId) return { error: "Please select a tournament" };

    const supabase = createServiceClient();

    const { data: platformEvent, error: eventFetchError } = await supabase
      .from("platform_events")
      .select("id, name")
      .eq("id", formData.platformEventId)
      .maybeSingle();

    if (eventFetchError) {
      console.error("[createLeague] platform_events fetch error:", eventFetchError);
      return { error: `Could not load tournament: ${eventFetchError.message}` };
    }
    if (!platformEvent) return { error: "Tournament not found" };

    // FK constraint on leagues_v2.event_id has been dropped — store platform_events.id directly.
    const { data: league, error: insertError } = await supabase
      .from("leagues_v2")
      .insert({
        event_id: formData.platformEventId,
        name: formData.name.trim(),
        roster_size: formData.rosterSize,
        max_members: formData.maxManagers,
        draft_status: "predraft",
        created_by: user.id,
      })
      .select("id")
      .maybeSingle();

    if (insertError) {
      console.error("[createLeague] leagues_v2 insert error:", insertError);
      return { error: insertError.message };
    }
    if (!league) {
      console.error("[createLeague] insert returned no row");
      return { error: "League was not created — no row returned" };
    }

    redirect(`/masters/${league.id}/hub`);
  } catch (err: any) {
    // In Next.js 14+, redirect() throws with err.digest starting with "NEXT_REDIRECT".
    // Must rethrow so the framework can process the redirect response.
    if (err?.digest?.startsWith?.("NEXT_REDIRECT")) throw err;
    console.error("[createLeague] unexpected error:", err);
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}
