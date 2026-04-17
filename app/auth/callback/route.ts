// TODO: Before OAuth works, configure providers in Supabase dashboard:
// 1. Authentication → Providers → Enable Google (add OAuth client ID + secret from Google Cloud Console)
// 2. Authentication → Providers → Enable Apple (add client ID + secret from Apple Developer account)
// 3. Authentication → URL Configuration → Add redirect URLs:
//    - http://localhost:3000/auth/callback
//    - https://edgepulse.ai/auth/callback

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { upsertProfile } from "@/lib/auth/authHelpers";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      await upsertProfile({
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.user_metadata?.full_name ?? null,
        avatar_url: data.user.user_metadata?.avatar_url ?? null,
      });
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
