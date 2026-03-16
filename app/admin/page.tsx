"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ManagerBadge from "../components/ManagerBadge";

type Member = {
  id: string;
  display_name: string;
  draft_slot: number;
  email: string | null;
  role: string | null;
  user_id: string | null;
};

type LotteryRevealSlot = 1 | 2 | 3 | 4;

type AuthUser = {
  id: string;
  email?: string;
} | null;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function AdminPage() {
  const supabase = useMemo(() => createClient(), []);

  const [members, setMembers] = useState<Member[]>([]);
  const [authUser, setAuthUser] = useState<AuthUser>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [isRunningLottery, setIsRunningLottery] = useState(false);
  const [lotteryResults, setLotteryResults] = useState<
    Partial<Record<LotteryRevealSlot, Member>>
  >({});
  const [lotteryStatus, setLotteryStatus] = useState("");
  const [picksCount, setPicksCount] = useState(0);

  async function loadData() {
    const [{ data: authData }, { data: memberData }, { count: picksCountData }] =
      await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("league_members")
          .select("id,display_name,draft_slot,email,role,user_id")
          .order("draft_slot", { ascending: true }),
        supabase.from("picks").select("*", { count: "exact", head: true }),
      ]);

    setAuthUser(authData.user ? { id: authData.user.id, email: authData.user.email } : null);
    setAuthLoaded(true);

    if (memberData) setMembers(memberData as Member[]);
    setPicksCount(picksCountData ?? 0);
  }

  useEffect(() => {
    loadData();
  }, [supabase]);

  const orderedMembers = useMemo(() => {
    return [...members].sort((a, b) => a.draft_slot - b.draft_slot);
  }, [members]);

  const signedInMember = useMemo(() => {
    if (!authUser) return null;
    return orderedMembers.find((member) => member.user_id === authUser.id) ?? null;
  }, [orderedMembers, authUser]);

  const isCommissioner = signedInMember?.role === "commissioner";
  const lotteryDisplayOrder: LotteryRevealSlot[] = [4, 3, 2, 1];
  const lotteryLocked = picksCount > 0;

  async function signInWithGoogle() {
    const redirectTo = `${window.location.origin}/auth/callback?next=/admin`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error) {
      setLotteryStatus(error.message || "Failed to start Google sign-in.");
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.reload();
  }

  async function runDraftLottery() {
    if (!isCommissioner) {
      setLotteryStatus("Only the commissioner can run the draft lottery.");
      return;
    }

    if (isRunningLottery) return;

    if (orderedMembers.length !== 4) {
      setLotteryStatus("Lottery requires exactly 4 managers.");
      return;
    }

    if (lotteryLocked) {
      setLotteryStatus("Draft order cannot be randomized after picks have been made.");
      return;
    }

    const confirmed = window.confirm(
      "Run the draft lottery and overwrite the current draft order?"
    );
    if (!confirmed) return;

    setIsRunningLottery(true);
    setLotteryResults({});
    setLotteryStatus("Starting lottery...");

    try {
      const shuffled = [...orderedMembers]
        .map((member) => ({ member, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map((entry) => entry.member);

      const finalOrder = [...shuffled].reverse();
      const revealMap: Partial<Record<LotteryRevealSlot, Member>> = {};

      for (let i = 0; i < shuffled.length; i += 1) {
        const revealSlot = lotteryDisplayOrder[i];
        const revealedMember = shuffled[i];

        setLotteryStatus(`Revealing pick #${revealSlot}...`);
        revealMap[revealSlot] = revealedMember;
        setLotteryResults({ ...revealMap });

        if (i < shuffled.length - 1) {
          await wait(2000);
        }
      }

      setLotteryStatus("Saving draft order...");

      for (let i = 0; i < finalOrder.length; i += 1) {
        const member = finalOrder[i];

        const { error } = await supabase
          .from("league_members")
          .update({ draft_slot: i + 1 })
          .eq("id", member.id);

        if (error) {
          throw new Error(error.message || "Failed to update draft order.");
        }
      }

      await loadData();
      setLotteryStatus("Draft lottery complete.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Draft lottery failed.";
      setLotteryStatus(message);
    } finally {
      setIsRunningLottery(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <section className="mb-6 sm:mb-8">
        <h2 className="text-3xl font-bold">Admin Panel</h2>
        <p className="mt-2 text-gray-600">
          Commissioner-only controls for draft order and league access management.
        </p>
      </section>

      <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm sm:mb-8 sm:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Admin Access
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                {authUser ? "Signed In" : "Commissioner Sign In Required"}
              </div>
              <div className="mt-2 text-sm text-slate-600">
                {authLoaded
                  ? authUser?.email
                    ? `Email: ${authUser.email}`
                    : "You are not currently signed in."
                  : "Checking session..."}
              </div>
              <div className="mt-2 text-sm font-medium text-slate-700">
                Access:{" "}
                {signedInMember
                  ? `${signedInMember.display_name} • ${signedInMember.role ?? "manager"}`
                  : authUser
                  ? "Signed in, but not mapped to a league member"
                  : "Not signed in"}
              </div>
            </div>

            <div className="flex gap-3">
              {authUser ? (
                <button
                  type="button"
                  onClick={signOut}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
                >
                  Sign Out
                </button>
              ) : (
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  className="rounded-xl bg-slate-950 px-4 py-2 text-white"
                >
                  Continue with Google
                </button>
              )}
            </div>
          </div>

          {!isCommissioner ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              Only the commissioner can access admin controls.
            </div>
          ) : null}
        </div>
      </section>

      {isCommissioner ? (
        <>
          <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm sm:mb-8 sm:p-6">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    Draft Lottery
                  </div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">
                    Randomize Draft Order
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    Equal odds for all four managers. The reveal runs 4th, 3rd, 2nd,
                    then 1st with a two-second delay between each result.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={runDraftLottery}
                  disabled={isRunningLottery || lotteryLocked || orderedMembers.length !== 4}
                  className="rounded-xl bg-slate-950 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isRunningLottery ? "Running Lottery..." : "Run Draft Lottery"}
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                {orderedMembers.map((member) => (
                  <div
                    key={member.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Current Slot
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <ManagerBadge name={member.display_name} />
                      <div className="text-lg font-bold text-slate-900">
                        #{member.draft_slot}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                {lotteryDisplayOrder.map((slot) => {
                  const revealedMember = lotteryResults[slot];

                  return (
                    <div
                      key={slot}
                      className="rounded-xl border border-amber-200 bg-amber-50 p-4"
                    >
                      <div className="text-xs font-medium uppercase tracking-wide text-amber-700">
                        Lottery Reveal
                      </div>
                      <div className="mt-2 text-lg font-bold text-slate-900">
                        Pick #{slot}
                      </div>
                      <div className="mt-3">
                        {revealedMember ? (
                          <ManagerBadge name={revealedMember.display_name} />
                        ) : (
                          <span className="text-sm text-slate-500">Waiting...</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {lotteryStatus ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                  {lotteryStatus}
                </div>
              ) : null}

              {lotteryLocked ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  Draft lottery is locked once picks have been made.
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
            <h3 className="text-xl font-semibold">League Members</h3>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-950 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Role</th>
                    <th className="px-4 py-3 text-left">Draft Slot</th>
                    <th className="px-4 py-3 text-left">Mapped User</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedMembers.map((member) => (
                    <tr key={member.id} className="border-t border-slate-200">
                      <td className="px-4 py-3">{member.display_name}</td>
                      <td className="px-4 py-3">{member.email ?? "—"}</td>
                      <td className="px-4 py-3">{member.role ?? "—"}</td>
                      <td className="px-4 py-3">#{member.draft_slot}</td>
                      <td className="px-4 py-3">
                        {member.user_id ? (
                          <span className="text-emerald-700">Mapped</span>
                        ) : (
                          <span className="text-amber-700">Not mapped</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}