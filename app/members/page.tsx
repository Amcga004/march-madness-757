import { createClient } from "@/lib/supabase/server";

type LeagueMember = {
  id: string;
  display_name: string;
  role: string;
  draft_slot: number;
};

export default async function MembersPage() {
  const supabase = await createClient();

  const { data: members, error } = await supabase
    .from("league_members")
    .select("*")
    .order("draft_slot", { ascending: true });

  if (error) {
    return (
      <main className="mx-auto max-w-5xl p-8">
        <h1 className="text-3xl font-bold">League Members</h1>
        <p className="mt-4 text-red-600">
          Error loading members: {error.message}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">League Members</h1>
        <p className="mt-2 text-gray-600">
          These are the players loaded from Supabase.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {(members as LeagueMember[]).map((member) => (
          <div
            key={member.id}
            className="rounded-2xl border bg-white p-4 shadow-sm"
          >
            <div className="text-lg font-semibold">{member.display_name}</div>
            <div className="mt-1 text-sm text-gray-600">
              {member.role} • Draft Slot {member.draft_slot}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}