"use server";

import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/authHelpers";
import { createServiceClient } from "@/lib/supabase/service";

export async function createLeague(formData: {
  platformEventId: string; // platform_events.id (used for display/ingest system)
  name: string;
  maxManagers: number;
  rosterSize: number;
}): Promise<{ error: string } | never> {
  const user = await getUser();
  if (!user) redirect("/login");

  if (!formData.name.trim()) return { error: "League name is required" };
  if (!formData.platformEventId) return { error: "Please select a tournament" };

  const supabase = createServiceClient();

  // Fetch the platform_event so we have name/season for the events table lookup
  const { data: platformEvent } = await supabase
    .from("platform_events")
    .select("id, name, starts_at, metadata")
    .eq("id", formData.platformEventId)
    .maybeSingle();

  if (!platformEvent) return { error: "Tournament not found" };

  const season = platformEvent.starts_at
    ? String(new Date(platformEvent.starts_at).getFullYear())
    : "2026";

  // Resolve leagues_v2.event_id → must point to the `events` table (FK constraint).
  // The `events` table is the golf draft system's event store; platform_events is the
  // ingest system. They are separate. Find or create a stub in events.
  let eventsTableId: string | null = null;

  const { data: existingEvent } = await supabase
    .from("events")
    .select("id")
    .ilike("name", platformEvent.name)
    .maybeSingle();

  if (existingEvent) {
    eventsTableId = existingEvent.id;
  } else {
    // Insert a minimal stub so the FK is satisfied. The draft room will show this
    // event's name correctly. course_par and detailed fields can be filled later.
    const { data: newEvent, error: eventInsertError } = await supabase
      .from("events")
      .insert({
        name: platformEvent.name,
        season: Number(season),
        status: "scheduled",
      })
      .select("id")
      .maybeSingle();

    if (eventInsertError || !newEvent) {
      return { error: `Could not register tournament: ${eventInsertError?.message ?? "unknown error"}` };
    }
    eventsTableId = newEvent.id;
  }

  const { data: league, error } = await supabase
    .from("leagues_v2")
    .insert({
      event_id: eventsTableId,
      name: formData.name.trim(),
      roster_size: formData.rosterSize,
      max_members: formData.maxManagers,
      draft_status: "predraft",
      created_by: user.id,
      // Store platform_events.id in metadata so scoring/ingest pipelines can link back
      metadata: { platform_event_id: formData.platformEventId },
    })
    .select("id")
    .maybeSingle();

  if (error || !league) {
    return { error: error?.message ?? "Failed to create league" };
  }

  redirect(`/masters/${league.id}/hub`);
}
