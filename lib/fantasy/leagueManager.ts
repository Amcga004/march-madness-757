import { createServiceClient } from "@/lib/supabase/service";
import { createDraft } from "@/lib/fantasy/draftEngine";

export async function createFantasyLeague(params: {
  sportKey: string;
  name: string;
  mode: string;
  season: string;
  maxManagers: number;
  commissionerId: string;
  eventId?: string;
}) {
  const supabase = createServiceClient();

  // Determine roster config
  let rosterSize = 8;
  let benchSize = 1;

  if (params.sportKey === "pga") {
    rosterSize = params.maxManagers <= 5 ? 8 : 6;
    benchSize = 1;
  } else if (params.sportKey === "ncaab") {
    rosterSize = 16;
    benchSize = 0;
  }

  // Get default scoring ruleset
  const { data: ruleset } = await supabase
    .from("fantasy_scoring_rulesets")
    .select("rules")
    .eq("sport_key", params.sportKey)
    .eq("is_default", true)
    .maybeSingle();

  // Generate slug
  const slug = `${params.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;

  const { data: league, error } = await supabase
    .from("fantasy_leagues")
    .insert({
      sport_key: params.sportKey,
      name: params.name,
      slug,
      mode: params.mode,
      season: params.season,
      max_managers: params.maxManagers,
      roster_size: rosterSize,
      bench_size: benchSize,
      status: "setup",
      commissioner_id: params.commissionerId,
      current_event_id: params.eventId ?? null,
      scoring_ruleset: ruleset?.rules ?? {},
    })
    .select("id, slug")
    .maybeSingle();

  if (error) throw new Error(`Failed to create league: ${error.message}`);

  // Add commissioner as first member
  await supabase.from("fantasy_memberships").insert({
    league_id: league!.id,
    user_id: params.commissionerId,
    display_name: "Commissioner",
    draft_slot: 1,
    role: "commissioner",
  });

  return league!;
}

export async function joinLeague(params: {
  leagueId: string;
  userId: string;
  displayName: string;
}) {
  const supabase = createServiceClient();

  const { data: league } = await supabase
    .from("fantasy_leagues")
    .select("max_managers, status")
    .eq("id", params.leagueId)
    .maybeSingle();

  if (!league) throw new Error("League not found");
  if (league.status !== "setup") throw new Error("League is no longer accepting members");

  const { count } = await supabase
    .from("fantasy_memberships")
    .select("*", { count: "exact", head: true })
    .eq("league_id", params.leagueId);

  if ((count ?? 0) >= league.max_managers) {
    throw new Error("League is full");
  }

  const { error } = await supabase.from("fantasy_memberships").insert({
    league_id: params.leagueId,
    user_id: params.userId,
    display_name: params.displayName,
    draft_slot: (count ?? 0) + 1,
    role: "manager",
  });

  if (error) throw new Error(`Failed to join league: ${error.message}`);
}

export async function openLeagueForDraft(
  leagueId: string,
  eventId?: string
) {
  const supabase = createServiceClient();

  const { data: league } = await supabase
    .from("fantasy_leagues")
    .select("sport_key, roster_size, bench_size, mode")
    .eq("id", leagueId)
    .maybeSingle();

  if (!league) throw new Error("League not found");

  const { count: memberCount } = await supabase
    .from("fantasy_memberships")
    .select("*", { count: "exact", head: true })
    .eq("league_id", leagueId);

  const totalRounds = league.roster_size + league.bench_size;

  const draftId = await createDraft({
    leagueId,
    eventId,
    totalRounds,
  });

  await supabase
    .from("fantasy_leagues")
    .update({
      status: "drafting",
      current_event_id: eventId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", leagueId);

  return { draftId, totalRounds, managers: memberCount };
}

export async function getLeagueWithMembers(leagueId: string) {
  const supabase = createServiceClient();

  const { data: league } = await supabase
    .from("fantasy_leagues")
    .select("*")
    .eq("id", leagueId)
    .maybeSingle();

  if (!league) throw new Error("League not found");

  const { data: members } = await supabase
    .from("fantasy_memberships")
    .select("*")
    .eq("league_id", leagueId)
    .order("draft_slot");

  return { league, members: members ?? [] };
}
