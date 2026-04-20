"use server";

import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/authHelpers";
import { createServiceClient } from "@/lib/supabase/service";

export async function createLeague(formData: {
  eventId: string;
  name: string;
  maxManagers: number;
  rosterSize: number;
}): Promise<{ error: string } | never> {
  const user = await getUser();
  if (!user) redirect("/login");

  if (!formData.name.trim()) return { error: "League name is required" };
  if (!formData.eventId) return { error: "Please select a tournament" };

  const supabase = createServiceClient();

  const { data: league, error } = await supabase
    .from("leagues_v2")
    .insert({
      event_id: formData.eventId,
      name: formData.name.trim(),
      roster_size: formData.rosterSize,
      max_members: formData.maxManagers,
      draft_status: "predraft",
      created_by: user.id,
    })
    .select("id")
    .maybeSingle();

  if (error || !league) {
    return { error: error?.message ?? "Failed to create league" };
  }

  redirect(`/masters/${league.id}/hub`);
}
