"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Member = {
  id: string;
  display_name: string;
  draft_slot: number;
  email: string | null;
  role: string | null;
  user_id: string | null;
};

type LotteryRevealSlot = 1 | 2 | 3 | 4;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function AdminPage() {
  const supabase = useMemo(() => createClient(), []);

  const [authUser, setAuthUser] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [picksCount, setPicksCount] = useState(0);

  const [isRunningLottery, setIsRunningLottery] = useState(false);
  const [lotteryResults, setLotteryResults] = useState<
    Partial<Record<LotteryRevealSlot, Member>>
  >({});
  const [status, setStatus] = useState("");

  async function loadData() {
    const [{ data: auth }, { data: memberData }, { count }] =
      await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("league_members")
          .select("*")
          .order("draft_slot", { ascending: true }),
        supabase.from("picks").select("*", { count: "exact", head: true }),
      ]);

    setAuthUser(auth.user ?? null);
    setMembers(memberData ?? []);
    setPicksCount(count ?? 0);
  }

  useEffect(() => {
    loadData();
  }, []);

  const signedInMember = useMemo(() => {
    if (!authUser) return null;
    return members.find((m) => m.user_id === authUser.id) ?? null;
  }, [authUser, members]);

  const isCommissioner = signedInMember?.role === "commissioner";

  async function signInWithGoogle() {
    const redirectTo = `${window.location.origin}/auth/callback?next=/admin`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error) setStatus(error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.reload();
  }

  async function runDraftLottery() {
    if (!isCommissioner) return;

    if (picksCount > 0) {
      setStatus("Draft order cannot change after picks start.");
      return;
    }

    setIsRunningLottery(true);
    setLotteryResults({});
    setStatus("Running lottery...");

    const shuffled = [...members]
      .map((m) => ({ m, r: Math.random() }))
      .sort((a, b) => a.r - b.r)
      .map((x) => x.m);

    const revealOrder = [4, 3, 2, 1] as LotteryRevealSlot[];

    const revealMap: Partial<Record<LotteryRevealSlot, Member>> = {};

    for (let i = 0; i < shuffled.length; i++) {
      const slot = revealOrder[i];
      revealMap[slot] = shuffled[i];

      setLotteryResults({ ...revealMap });

      if (i < shuffled.length - 1) await wait(2000);
    }

    const finalOrder = [...shuffled].reverse();

    for (let i = 0; i < finalOrder.length; i++) {
      await supabase
        .from("league_members")
        .update({ draft_slot: i + 1 })
        .eq("id", finalOrder[i].id);
    }

    await loadData();

    setStatus("Lottery complete.");
    setIsRunningLottery(false);
  }

  return (
    <div className="mx-auto max-w-6xl p-6">

      <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>

      <div className="border rounded-xl p-5 mb-6 bg-white">

        <div className="flex justify-between items-start">

          <div>
            <div className="text-sm text-gray-500">Admin Access</div>

            <div className="text-xl font-bold mt-1">
              {authUser ? "Signed In" : "Sign In Required"}
            </div>

            <div className="text-sm text-gray-600 mt-1">
              {authUser?.email ?? "Not signed in"}
            </div>

            <div className="text-sm mt-2">
              {signedInMember
                ? `${signedInMember.display_name} • ${signedInMember.role}`
                : authUser
                ? "User not mapped to league member"
                : ""}
            </div>
          </div>

          <div>

            {authUser ? (
              <button
                onClick={signOut}
                className="px-4 py-2 rounded-lg border"
              >
                Sign Out
              </button>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="px-4 py-2 rounded-lg bg-black text-white"
              >
                Continue with Google
              </button>
            )}

          </div>

        </div>

      </div>

      {!isCommissioner && authUser && (
        <div className="p-4 border bg-yellow-50 text-yellow-800 rounded-xl mb-6">
          Only the commissioner has access to admin controls.
        </div>
      )}

      {isCommissioner && (
        <div className="border rounded-xl p-6 bg-white">

          <h2 className="text-xl font-semibold mb-4">
            Draft Lottery
          </h2>

          <button
            onClick={runDraftLottery}
            disabled={isRunningLottery}
            className="px-4 py-2 bg-black text-white rounded-lg mb-6"
          >
            {isRunningLottery ? "Running..." : "Run Draft Lottery"}
          </button>

          <div className="grid grid-cols-4 gap-4">

            {[4,3,2,1].map((slot) => {

              const member = lotteryResults[slot as LotteryRevealSlot];

              return (
                <div
                  key={slot}
                  className="border rounded-xl p-4 text-center bg-gray-50"
                >

                  <div className="text-xs text-gray-500">
                    Pick #{slot}
                  </div>

                  <div className="text-lg font-bold mt-2">
                    {member ? member.display_name : "Waiting"}
                  </div>

                </div>
              );
            })}

          </div>

          {status && (
            <div className="mt-4 text-sm text-gray-600">
              {status}
            </div>
          )}

        </div>
      )}

    </div>
  );
}