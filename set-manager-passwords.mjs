import { createClient } from "@supabase/supabase-js";

// Pull from your existing .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// 🔐 ONLY updating Greg, Eric, and Wesley
// ❗ DO NOT include your own user ID

const updates = [
  {
    name: "Wesley",
    userId: "90212108-8517-434d-bf1c-447977b8e416",
    password: "password",
  },
  {
    name: "Greg",
    userId: "1ad82e75-86dc-474b-a1d6-152c48a1b1d3",
    password: "password",
  },
  {
    name: "Eric",
    userId: "218cc063-3626-4a6b-bb95-6d80d088e367",
    password: "password",
  },
];

for (const user of updates) {
  const { data, error } = await supabase.auth.admin.updateUserById(user.userId, {
    password: user.password,
  });

  if (error) {
    console.error(`❌ Failed updating ${user.name}:`, error.message);
  } else {
    console.log(`✅ Updated password for ${user.name}:`, data.user?.email);
  }
}