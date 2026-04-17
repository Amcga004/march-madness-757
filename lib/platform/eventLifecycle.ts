import { createServiceClient } from "@/lib/supabase/service";

export type EventStatus = "scheduled" | "active" | "completed" | "archived";

export async function transitionEvent(
  eventId: string,
  toStatus: EventStatus,
  triggeredBy: string,
  notes?: string
) {
  const supabase = createServiceClient();

  const { data: event, error: fetchError } = await supabase
    .from("platform_events")
    .select("id, status, name")
    .eq("id", eventId)
    .maybeSingle();

  if (fetchError || !event) {
    throw new Error(`Event not found: ${eventId}`);
  }

  const fromStatus = event.status;
  if (fromStatus === toStatus) return;

  const now = new Date().toISOString();
  const updates: Record<string, string> = {
    status: toStatus,
    updated_at: now,
  };

  if (toStatus === "active") updates.starts_at = now;
  if (toStatus === "completed") updates.completed_at = now;
  if (toStatus === "archived") updates.archived_at = now;

  const { error: updateError } = await supabase
    .from("platform_events")
    .update(updates)
    .eq("id", eventId);

  if (updateError) {
    throw new Error(`Failed to transition event: ${updateError.message}`);
  }

  await supabase.from("event_lifecycle_log").insert({
    event_id: eventId,
    from_status: fromStatus,
    to_status: toStatus,
    triggered_by: triggeredBy,
    notes: notes ?? null,
  });
}

export async function getActiveEvents(sportKey?: string) {
  const supabase = createServiceClient();
  let query = supabase
    .from("platform_events")
    .select("*")
    .eq("status", "active")
    .order("starts_at");

  if (sportKey) query = query.eq("sport_key", sportKey);
  const { data } = await query;
  return data ?? [];
}

export async function getScheduledEvents(sportKey?: string) {
  const supabase = createServiceClient();
  let query = supabase
    .from("platform_events")
    .select("*")
    .eq("status", "scheduled")
    .order("starts_at");

  if (sportKey) query = query.eq("sport_key", sportKey);
  const { data } = await query;
  return data ?? [];
}

export async function getUpcomingEvents(sportKey?: string, limit = 10) {
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  let query = supabase
    .from("platform_events")
    .select("*")
    .in("status", ["scheduled", "active"])
    .gte("starts_at", now)
    .order("starts_at")
    .limit(limit);

  if (sportKey) query = query.eq("sport_key", sportKey);
  const { data } = await query;
  return data ?? [];
}

export async function runLifecycleCheck() {
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const results = {
    activated: 0,
    completed: 0,
    archived: 0,
    errors: [] as string[],
  };

  // Transition scheduled → active when starts_at has passed
  const { data: toActivate } = await supabase
    .from("platform_events")
    .select("id, name")
    .eq("status", "scheduled")
    .lte("starts_at", now);

  for (const event of toActivate ?? []) {
    try {
      await transitionEvent(event.id, "active", "scheduler", "Auto-activated by lifecycle check");
      results.activated++;
    } catch (e) {
      results.errors.push(`Activate ${event.id}: ${e}`);
    }
  }

  // Transition completed → archived after 7 days
  const archiveThreshold = new Date();
  archiveThreshold.setDate(archiveThreshold.getDate() - 7);

  const { data: toArchive } = await supabase
    .from("platform_events")
    .select("id, name")
    .eq("status", "completed")
    .lte("completed_at", archiveThreshold.toISOString());

  for (const event of toArchive ?? []) {
    try {
      await transitionEvent(event.id, "archived", "scheduler", "Auto-archived after 7 days");
      results.archived++;
    } catch (e) {
      results.errors.push(`Archive ${event.id}: ${e}`);
    }
  }

  return results;
}

export async function upsertEvent(params: {
  sportKey: string;
  eventType: string;
  externalId: string;
  externalSource: string;
  name: string;
  shortName?: string;
  season: string;
  startsAt?: string;
  endsAt?: string;
  venue?: string;
  location?: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("platform_events")
    .select("id, status")
    .eq("sport_key", params.sportKey)
    .eq("external_id", params.externalId)
    .eq("external_source", params.externalSource)
    .maybeSingle();

  if (existing) {
    // Update non-status fields only — never overwrite a status transition
    await supabase
      .from("platform_events")
      .update({
        name: params.name,
        short_name: params.shortName ?? null,
        starts_at: params.startsAt ?? null,
        ends_at: params.endsAt ?? null,
        venue: params.venue ?? null,
        location: params.location ?? null,
        metadata: params.metadata ?? {},
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    return { id: existing.id, created: false };
  }

  const { data: created, error } = await supabase
    .from("platform_events")
    .insert({
      sport_key: params.sportKey,
      event_type: params.eventType,
      external_id: params.externalId,
      external_source: params.externalSource,
      name: params.name,
      short_name: params.shortName ?? null,
      season: params.season,
      status: "scheduled",
      starts_at: params.startsAt ?? null,
      ends_at: params.endsAt ?? null,
      venue: params.venue ?? null,
      location: params.location ?? null,
      metadata: params.metadata ?? {},
    })
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Failed to upsert event: ${error.message}`);
  return { id: created!.id, created: true };
}
