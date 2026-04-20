"use server";

import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/authHelpers";
import { createServiceClient } from "@/lib/supabase/service";

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
  } catch (err) {
    // redirect() throws internally — let it propagate
    if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
    console.error("[createLeague] unexpected error:", err);
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}
