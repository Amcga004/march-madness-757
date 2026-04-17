import { createServiceClient } from "@/lib/supabase/service";

const supabase = createServiceClient();

async function test() {
  console.log("Testing golf player insert with service role...");

  const { data, error } = await supabase
    .from("platform_players")
    .upsert(
      {
        sport_key: "pga",
        canonical_name: "Tiger Woods",
        first_name: "Tiger",
        last_name: "Woods",
        position: null,
        metadata: { test: true },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "sport_key,canonical_name" }
    )
    .select("id");

  if (error) {
    console.log("❌ Insert error:", error.message);
    console.log("   Code:", error.code);
    console.log("   Details:", error.details);
  } else {
    console.log("✅ Insert succeeded:", data);
  }

  const { count } = await supabase
    .from("platform_players")
    .select("*", { count: "exact", head: true });

  console.log("Player count after insert:", count);
}

test();
