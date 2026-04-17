import { createServiceClient } from "@/lib/supabase/service";

export type HealthStatus = "healthy" | "degraded" | "down" | "unknown";

export async function recordSyncSuccess(sourceKey: string) {
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  await supabase
    .from("source_registry")
    .update({
      last_sync_at: now,
      last_success_at: now,
      consecutive_failures: 0,
      health_status: "healthy",
      last_error: null,
      last_error_at: null,
      updated_at: now,
    })
    .eq("source_key", sourceKey);
}

export async function recordSyncFailure(sourceKey: string, error: string) {
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { data } = await supabase
    .from("source_registry")
    .select("consecutive_failures")
    .eq("source_key", sourceKey)
    .maybeSingle();

  const failures = (data?.consecutive_failures ?? 0) + 1;
  const health: HealthStatus = failures >= 3 ? "down" : "degraded";

  await supabase
    .from("source_registry")
    .update({
      last_sync_at: now,
      last_error: error,
      last_error_at: now,
      consecutive_failures: failures,
      health_status: health,
      updated_at: now,
    })
    .eq("source_key", sourceKey);
}

export async function getSourceHealth(sourceKey: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("source_registry")
    .select("*")
    .eq("source_key", sourceKey)
    .maybeSingle();
  return data;
}

export async function getAllSourceHealth() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("source_registry")
    .select("*")
    .order("sport")
    .order("layer");
  return data ?? [];
}

export async function isSourceHealthy(sourceKey: string): Promise<boolean> {
  const source = await getSourceHealth(sourceKey);
  if (!source) return false;
  return source.health_status === "healthy" || source.health_status === "unknown";
}

export async function saveSnapshot(
  sourceKey: string,
  sport: string,
  snapshotType: string,
  payload: unknown
) {
  const supabase = createServiceClient();
  const { error } = await supabase.from("source_snapshots").insert({
    source_key: sourceKey,
    sport,
    snapshot_type: snapshotType,
    raw_payload: payload,
    fetched_at: new Date().toISOString(),
    is_valid: true,
  });
  if (error) throw new Error(`Failed to save snapshot: ${error.message}`);
}
