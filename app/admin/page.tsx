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

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function AdminPage() {
  const supabase = useMemo(() => createClient(), []);

  const [authUser, setAuthUser] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [picksCount, setPicksCount] = useState(0);

  const [email, setEmail] = useState("amacbfs@gmail.com");
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);

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
          .select("id,display_name,draft_slot,email,role,user_id")
          .order("draft_slot", { ascending: true }),
        supabase.from("picks").select("*", { count: "exact", head: true }),
      ]);

    setAuthUser(auth.user ?? null);
    setMembers((memberData as Member[]) ?? []);
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

  async function sendMagicLink() {
    if (!email.trim()) {
      setStatus("Please enter your email.");
      return;
    }

    setIsSendingMagicLink(true);
    setStatus("");

    const redirectTo = `${window.location.origin}/auth/callback?next=/admin`;

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      setStatus(error.message || "Failed to send magic link.");
      setIsSendingMagicLink(false);
      return;
    }

    setStatus("Magic link sent. Check your email, open the link, and you should return to the admin panel signed in.");
    setIsSendingMagicLink(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.reload();
  }

  async function runDraftLottery() {
    if (!isCommissioner) {
      setStatus("Only the commissioner can run the draft lottery.");
      return;
    }

    if (picksCount > 0) {
      setStatus("Draft order cannot change after picks have started.");
      return;
    }

    if (members.length !== 4) {
      setStatus("Lottery requires exactly 4 managers.");
      return;
    }

    const confirmed = window.confirm(
      "Run the draft lottery and overwrite the current draft order?"
    );
    if (!confirmed) return;

    setIsRunningLottery(true);
    setLotteryResults({});
    setStatus("Running lottery...");

    try {
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

        if (i < shuffled.length - 1) {
          await wait(2000);
        }
      }

      const finalOrder = [...shuffled].reverse();

      for (let i = 0; i < finalOrder.length; i++) {
        const { error } = await supabase
          .from("league_members")
          .update({ draft_slot: i + 1 })
          .eq("id", finalOrder[i].id);

        if (error) {
          throw new Error(error.message || "Failed to update draft slots.");
        }
      }

      await loadData();
      setStatus("Draft lottery complete.");
    } catch (error: any) {
      setStatus(error?.message || "Draft lottery failed.");
    } finally {
      setIsRunningLottery(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-6 text-3xl font-bold">Admin Panel</h1>

      <div className="mb-6 rounded-xl border bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-gray-500">Admin Access</div>
            <div className="mt-1 text-xl font-bold">
              {authUser ? "Signed In" : "Commissioner Sign In Required"}
            </div>
            <div className="mt-1 text-sm text-gray-600">
              {authUser?.email ?? "Not signed in"}
            </div>
            <div className="mt-2 text-sm">
              {signedInMember
                ? `${signedInMember.display_name} • ${signedInMember.role}`
                : authUser
                ? "Signed in, but not mapped to a league member"
                : ""}
            </div>
          </div>

          {authUser ? (
            <button onClick={signOut} className="rounded-lg border px-4 py-2">
              Sign Out
            </button>
          ) : null}
        </div>

        {!authUser ? (
          <div className="mt-5 max-w-md rounded-xl border bg-slate-50 p-4">
            <div className="text-base font-semibold">Commissioner Magic Link Login</div>
            <div className="mt-1 text-sm text-slate-600">
              Send a magic link to your commissioner email
            </div>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your commissioner email"
              className="mt-4 w-full rounded-xl border px-3 py-2"
            />

            <button
              onClick={sendMagicLink}
              disabled={isSendingMagicLink}
              className="mt-3 rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50"
            >
              {isSendingMagicLink ? "Sending..." : "Send Magic Link"}
            </button>
          </div>
        ) : null}

        {status ? (
          <div className="mt-4 rounded-xl border bg-slate-50 p-3 text-sm text-slate-600">
            {status}
          </div>
        ) : null}
      </div>

      {authUser && !isCommissioner ? (
        <div className="mb-6 rounded-xl border bg-yellow-50 p-4 text-yellow-800">
          Only the commissioner has access to admin controls.
        </div>
      ) : null}

      {isCommissioner ? (
        <div className="rounded-xl border bg-white p-6">
          <h2 className="mb-4 text-xl font-semibold">Draft Lottery</h2>

          <button
            onClick={runDraftLottery}
            disabled={isRunningLottery}
            className="mb-6 rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {isRunningLottery ? "Running..." : "Run Draft Lottery"}
          </button>

          <div className="grid grid-cols-4 gap-4">
            {[4, 3, 2, 1].map((slot) => {
              const member = lotteryResults[slot as LotteryRevealSlot];

              return (
                <div
                  key={slot}
                  className="rounded-xl border bg-gray-50 p-4 text-center"
                >
                  <div className="text-xs text-gray-500">Pick #{slot}</div>
                  <div className="mt-2 text-lg font-bold">
                    {member ? member.display_name : "Waiting"}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6">
            <h3 className="mb-3 text-lg font-semibold">Current League Members</h3>
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-xl border p-4"
                >
                  <div className="flex items-center gap-3">
                    <ManagerBadge name={member.display_name} />
                    <div>
                      <div className="font-semibold">{member.display_name}</div>
                      <div className="text-sm text-slate-600">
                        {member.email ?? "—"} • {member.role ?? "—"}
                      </div>
                    </div>
                  </div>

                  <div className="text-sm text-slate-600">
                    Slot #{member.draft_slot}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}