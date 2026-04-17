async function check() {
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log("Service role key length:", service?.length ?? 0);
  console.log("Service role starts with eyJ:", service?.startsWith("eyJ") ? "✅" : "❌");
  console.log("Service role has spaces:", service?.includes(" ") ? "❌ YES - this is the problem" : "✅ none");
  console.log("Service role has newlines:", service?.includes("\n") ? "❌ YES - this is the problem" : "✅ none");
  console.log("Service role last 4 chars:", service?.slice(-4));

  console.log("");
  console.log("Anon key length:", anon?.length ?? 0);
  console.log("Anon key starts with eyJ:", anon?.startsWith("eyJ") ? "✅" : "❌");
  console.log("Anon key last 4 chars:", anon?.slice(-4));
}

check();
