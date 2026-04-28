import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/authHelpers";
import { createServiceClient } from "@/lib/supabase/service";
import EventHubNav from "@/app/components/masters/EventHubNav";
import DraftRoomHeader from "@/app/components/masters/DraftRoomHeader";
import ScoringEditor, { type ScoringConfig } from "@/app/components/masters/ScoringEditor";

type PageProps = {
  params: Promise<{ leagueId: string }>;
};

const DEFAULT_CONFIG: ScoringConfig = {
  round_multiplier: 1,
  cut_bonus: 2,
  cut_penalty: -2,
  finish_bonuses: [5, 4, 3, 2, 1],
  bogey_free_bonus: 1,
  best_round_bonus: 1,
  eagle_bonus: 0,
  hole_in_one_bonus: 5,
  birdie_streak_bonus: 1,
  birdie_streak_min: 3,
};

function parseScoringConfig(raw: unknown): ScoringConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_CONFIG;
  const r = raw as Record<string, unknown>;
  return {
    round_multiplier: typeof r.round_multiplier === "number" ? r.round_multiplier : DEFAULT_CONFIG.round_multiplier,
    cut_bonus: typeof r.cut_bonus === "number" ? r.cut_bonus : DEFAULT_CONFIG.cut_bonus,
    cut_penalty: typeof r.cut_penalty === "number" ? r.cut_penalty : DEFAULT_CONFIG.cut_penalty,
    finish_bonuses: Array.isArray(r.finish_bonuses) ? (r.finish_bonuses as number[]) : DEFAULT_CONFIG.finish_bonuses,
    bogey_free_bonus: typeof r.bogey_free_bonus === "number" ? r.bogey_free_bonus : DEFAULT_CONFIG.bogey_free_bonus,
    best_round_bonus: typeof r.best_round_bonus === "number" ? r.best_round_bonus : DEFAULT_CONFIG.best_round_bonus,
    eagle_bonus: typeof r.eagle_bonus === "number" ? r.eagle_bonus : DEFAULT_CONFIG.eagle_bonus,
    hole_in_one_bonus: typeof r.hole_in_one_bonus === "number" ? r.hole_in_one_bonus : DEFAULT_CONFIG.hole_in_one_bonus,
    birdie_streak_bonus: typeof r.birdie_streak_bonus === "number" ? r.birdie_streak_bonus : DEFAULT_CONFIG.birdie_streak_bonus,
    birdie_streak_min: typeof r.birdie_streak_min === "number" ? r.birdie_streak_min : DEFAULT_CONFIG.birdie_streak_min,
  };
}

export default async function SettingsPage({ params }: PageProps) {
  const { leagueId } = await params;
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = createServiceClient();
  const { data: league } = await supabase
    .from("leagues_v2")
    .select("id, name, draft_status, created_by, scoring_config")
    .eq("id", leagueId)
    .maybeSingle();

  if (!league) redirect("/fantasy/golf");

  const isCommissioner = league.created_by === user.id;
  const config = parseScoringConfig(league.scoring_config);

  return (
    <main className="min-h-screen bg-transparent px-4 py-6 text-[#162317] md:px-6 md:py-8">
      <div className="mx-auto flex max-w-xl flex-col gap-5 pb-24">
        <DraftRoomHeader
          leagueName={league.name}
          eventName="League Settings"
          season={2026}
          status={league.draft_status ?? "predraft"}
        />

        <ScoringEditor
          leagueId={leagueId}
          userId={user.id}
          isCommissioner={isCommissioner}
          config={config}
        />

        {!isCommissioner && (
          <p className="text-center text-xs text-[#6f7a67]">
            Only the league commissioner can edit scoring settings.
          </p>
        )}
      </div>

      <EventHubNav leagueId={leagueId} />
    </main>
  );
}
