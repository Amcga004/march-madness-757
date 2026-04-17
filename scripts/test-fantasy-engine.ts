import { createServiceClient } from "@/lib/supabase/service";
import { createFantasyLeague, joinLeague, openLeagueForDraft } from "@/lib/fantasy/leagueManager";
import { openDraft, startDraft, makePick, getDraftState } from "@/lib/fantasy/draftEngine";

const supabase = createServiceClient();

async function getTestUsers() {
  const { data } = await supabase
    .from("profiles")
    .select("id, email")
    .limit(4);
  return data ?? [];
}

async function getGolfPlayers() {
  const { data } = await supabase
    .from("platform_players")
    .select("id, canonical_name")
    .eq("sport_key", "pga")
    .limit(50);
  return data ?? [];
}

async function getNextGolfTournament() {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("platform_events")
    .select("id, name, starts_at")
    .eq("sport_key", "pga")
    .eq("status", "scheduled")
    .gte("starts_at", now)
    .order("starts_at")
    .limit(1)
    .maybeSingle();
  return data;
}

async function cleanup(leagueId: string) {
  await supabase.from("fantasy_standings").delete().eq("league_id", leagueId);
  await supabase.from("fantasy_scores").delete().eq("league_id", leagueId);
  await supabase.from("fantasy_rosters").delete().eq("league_id", leagueId);
  await supabase.from("fantasy_draft_picks").delete().eq("league_id", leagueId);
  await supabase.from("fantasy_drafts").delete().eq("league_id", leagueId);
  await supabase.from("fantasy_memberships").delete().eq("league_id", leagueId);
  await supabase.from("fantasy_leagues").delete().eq("id", leagueId);
  console.log("  Cleaned up test data");
}

async function main() {
  console.log("FANTASY ENGINE TEST");
  console.log("===================\n");

  console.log("1. Loading test data...");
  const users = await getTestUsers();
  const players = await getGolfPlayers();
  const tournament = await getNextGolfTournament();

  if (users.length < 2) {
    console.log("❌ Need at least 2 users in profiles table to test");
    return;
  }

  console.log(`   Users available: ${users.length}`);
  console.log(`   Golf players available: ${players.length}`);
  console.log(`   Next tournament: ${tournament?.name ?? "none found"}`);

  const commissioner = users[0];
  const manager2 = users[1];

  console.log("\n2. Creating golf tournament league...");
  let leagueId: string;
  try {
    const league = await createFantasyLeague({
      sportKey: "pga",
      name: "Test Golf League",
      mode: "tournament",
      season: "2026",
      maxManagers: 4,
      commissionerId: commissioner.id,
      eventId: tournament?.id,
    });
    leagueId = league.id;
    console.log(`   ✅ League created: ${league.id}`);
  } catch (e) {
    console.log(`   ❌ Failed: ${e}`);
    return;
  }

  console.log("\n3. Second manager joining...");
  try {
    await joinLeague({
      leagueId,
      userId: manager2.id,
      displayName: "Manager 2",
    });
    console.log(`   ✅ Manager 2 joined`);
  } catch (e) {
    console.log(`   ❌ Failed: ${e}`);
    await cleanup(leagueId);
    return;
  }

  console.log("\n4. Opening league for draft...");
  let draftId: string;
  try {
    const result = await openLeagueForDraft(leagueId, tournament?.id);
    draftId = result.draftId;
    console.log(`   ✅ Draft created: ${draftId} | Rounds: ${result.totalRounds}`);
  } catch (e) {
    console.log(`   ❌ Failed: ${e}`);
    await cleanup(leagueId);
    return;
  }

  console.log("\n5. Opening draft room...");
  try {
    await openDraft(draftId);
    console.log(`   ✅ Draft is open`);
  } catch (e) {
    console.log(`   ❌ Failed: ${e}`);
    await cleanup(leagueId);
    return;
  }

  console.log("\n6. Starting draft...");
  try {
    const result = await startDraft(draftId);
    console.log(`   ✅ Draft started | First pick: ${result.firstManagerId.slice(0, 8)}...`);
  } catch (e) {
    console.log(`   ❌ Failed: ${e}`);
    await cleanup(leagueId);
    return;
  }

  console.log("\n7. Simulating draft picks...");
  const state = await getDraftState(draftId);
  const memberIds = state.members.map((m: any) => m.user_id);
  const pickOrder = [
    memberIds[0], memberIds[1],
    memberIds[1], memberIds[0],
    memberIds[0], memberIds[1],
  ];

  let pickSuccess = 0;
  for (let i = 0; i < Math.min(6, players.length); i++) {
    const managerId = pickOrder[i % pickOrder.length];
    const player = players[i];
    try {
      const result = await makePick({
        draftId,
        managerId,
        entityType: "player",
        canonicalId: player.id,
        entityName: player.canonical_name,
        isBench: false,
      });
      console.log(`   Pick ${i + 1}: ${player.canonical_name} → ${managerId.slice(0, 8)}... | ${result.status}`);
      pickSuccess++;
    } catch (e) {
      console.log(`   ❌ Pick ${i + 1} failed: ${e}`);
      break;
    }
  }
  console.log(`   ✅ ${pickSuccess} picks made successfully`);

  console.log("\n8. Verifying final state...");
  const finalState = await getDraftState(draftId);
  console.log(`   Draft status: ${finalState.draft.status}`);
  console.log(`   Total picks recorded: ${finalState.picks.length}`);

  const { data: rosters } = await supabase
    .from("fantasy_rosters")
    .select("manager_id, entity_name, roster_slot")
    .eq("league_id", leagueId);
  console.log(`   Roster entries: ${rosters?.length ?? 0}`);

  if (finalState.picks.length === 6 && rosters?.length === 6) {
    console.log("\n✅ ALL TESTS PASSED");
  } else {
    console.log("\n⚠️  Some checks failed — review output above");
  }

  console.log("\n9. Cleaning up...");
  await cleanup(leagueId);
  console.log("\nDONE");
}

main().catch(console.error);
