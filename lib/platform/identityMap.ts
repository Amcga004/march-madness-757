import { createServiceClient } from "@/lib/supabase/service";

export type EntityType = "team" | "player" | "tournament" | "game";

export async function resolveCanonicalId(
  entityType: EntityType,
  sourceKey: string,
  sourceId: string,
  sportKey: string
): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("source_identity_map")
    .select("canonical_id")
    .eq("entity_type", entityType)
    .eq("source_key", sourceKey)
    .eq("source_id", sourceId)
    .eq("sport_key", sportKey)
    .maybeSingle();

  return data?.canonical_id ?? null;
}

export async function registerMapping(params: {
  entityType: EntityType;
  canonicalId: string;
  sourceKey: string;
  sourceId: string;
  sourceName?: string;
  sportKey: string;
  confidence?: "confirmed" | "probable" | "manual";
}) {
  const supabase = createServiceClient();
  await supabase.from("source_identity_map").upsert(
    {
      entity_type: params.entityType,
      canonical_id: params.canonicalId,
      source_key: params.sourceKey,
      source_id: params.sourceId,
      source_name: params.sourceName ?? null,
      sport_key: params.sportKey,
      confidence: params.confidence ?? "confirmed",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "entity_type,source_key,source_id,sport_key" }
  );
}

export async function upsertTeam(params: {
  sportKey: string;
  canonicalName: string;
  shortName?: string;
  abbreviation?: string;
  location?: string;
  conference?: string;
  division?: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("platform_teams")
    .select("id")
    .eq("sport_key", params.sportKey)
    .eq("canonical_name", params.canonicalName)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("platform_teams")
    .insert({
      sport_key: params.sportKey,
      canonical_name: params.canonicalName,
      short_name: params.shortName ?? null,
      abbreviation: params.abbreviation ?? null,
      location: params.location ?? null,
      conference: params.conference ?? null,
      division: params.division ?? null,
      metadata: params.metadata ?? {},
    })
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Failed to upsert team: ${error.message}`);
  return created!.id;
}

export async function upsertPlayer(params: {
  sportKey: string;
  canonicalName: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createServiceClient();

  const { data: inserted, error } = await supabase
    .from("platform_players")
    .upsert(
      {
        sport_key: params.sportKey,
        canonical_name: params.canonicalName,
        first_name: params.firstName ?? null,
        last_name: params.lastName ?? null,
        position: params.position ?? null,
        metadata: params.metadata ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: "sport_key,canonical_name", ignoreDuplicates: false }
    )
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Failed to upsert player: ${error.message}`);
  if (inserted) return inserted.id;

  // Row existed, fetch it
  const { data: existing } = await supabase
    .from("platform_players")
    .select("id")
    .eq("sport_key", params.sportKey)
    .eq("canonical_name", params.canonicalName)
    .maybeSingle();

  if (!existing) throw new Error(`Failed to find player after upsert: ${params.canonicalName}`);
  return existing.id;
}
