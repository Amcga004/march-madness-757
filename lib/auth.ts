import { createClient } from "@/lib/supabase/client";

export type CurrentUserContext = {
  authUserId: string | null;
  memberId: string | null;
  displayName: string | null;
  email: string | null;
  role: "commissioner" | "manager" | null;
};

export async function getCurrentUserContext(): Promise<CurrentUserContext> {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      authUserId: null,
      memberId: null,
      displayName: null,
      email: null,
      role: null,
    };
  }

  const { data: member, error: memberError } = await supabase
    .from("league_members")
    .select("id, display_name, email, role")
    .eq("user_id", user.id)
    .single();

  if (memberError || !member) {
    return {
      authUserId: user.id,
      memberId: null,
      displayName: null,
      email: user.email ?? null,
      role: null,
    };
  }

  return {
    authUserId: user.id,
    memberId: member.id,
    displayName: member.display_name,
    email: member.email,
    role: member.role,
  };
}