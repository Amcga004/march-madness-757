import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

export async function getUserProfile(userId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return data;
}

export async function upsertProfile(user: {
  id: string;
  email?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
}) {
  const supabase = createServiceClient();
  await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      email: user.email ?? null,
      full_name: user.full_name ?? null,
      avatar_url: user.avatar_url ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
}
