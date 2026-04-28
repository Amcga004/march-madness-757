"use client";

import { useState, useTransition } from "react";
import { createLeague } from "./actions";

type Tournament = {
  id: string;
  name: string;
  starts_at: string | null;
};

type Props = {
  tournaments: Tournament[];
};

const MANAGER_OPTIONS = [2, 4, 6, 8] as const;
const ROSTER_OPTIONS = [4, 6, 8] as const;

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "America/New_York",
    });
  } catch {
    return dateStr;
  }
}

export default function CreateLeagueWizard({ tournaments }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedEvent, setSelectedEvent] = useState<Tournament | null>(null);
  const [leagueName, setLeagueName] = useState("");
  const [maxManagers, setMaxManagers] = useState<2 | 4 | 6 | 8>(4);
  const [rosterSize, setRosterSize] = useState<4 | 6 | 8>(6);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showAllTournaments, setShowAllTournaments] = useState(false);

  const rounds = rosterSize + 1; // +1 bench round
  const totalPicks = maxManagers * rounds;

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await createLeague({
        platformEventId: selectedEvent!.id,
        name: leagueName,
        maxManagers,
        rosterSize,
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="mx-auto max-w-xl">
      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-2">
        {([1, 2, 3] as const).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                s === step
                  ? "bg-[#0B5D3B] text-white"
                  : s < step
                  ? "bg-[#0B5D3B]/20 text-[#0B5D3B]"
                  : "bg-[#d9ddcf] text-[#6f7a67]"
              }`}
            >
              {s < step ? "✓" : s}
            </div>
            {s < 3 && (
              <div
                className={`h-px w-8 transition-colors ${
                  s < step ? "bg-[#0B5D3B]/40" : "bg-[#d9ddcf]"
                }`}
              />
            )}
          </div>
        ))}
        <span className="ml-2 text-xs text-[#6f7a67]">
          {step === 1 ? "Select tournament" : step === 2 ? "Configure league" : "Review"}
        </span>
      </div>

      {/* Step 1 — Tournament */}
      {step === 1 && (
        <div>
          <h2 className="mb-1 text-lg font-bold text-[#162317]">Select a Tournament</h2>
          <p className="mb-5 text-sm text-[#6f7a67]">Choose the PGA Tour event for your league.</p>

          {tournaments.length === 0 ? (
            <div className="rounded-xl border border-[#d9ddcf] bg-white px-5 py-8 text-center">
              <p className="text-sm text-[#6f7a67]">No upcoming tournaments available.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                {(showAllTournaments ? tournaments : tournaments.slice(0, 6)).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setSelectedEvent(t); setStep(2); }}
                    className={`flex items-center gap-4 rounded-xl border px-5 py-4 text-left transition-colors ${
                      selectedEvent?.id === t.id
                        ? "border-[#0B5D3B] bg-[#0B5D3B]/5"
                        : "border-[#d9ddcf] bg-white hover:border-[#0B5D3B]/30 hover:bg-[#f6f4ed]"
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#C9A84C]/10 text-lg">
                      🏆
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#162317]">{t.name}</p>
                      <p className="text-xs text-[#6f7a67]">
                        {t.starts_at ? formatDate(t.starts_at) : "Date TBD"}
                      </p>
                    </div>
                    <svg className="h-4 w-4 text-[#6f7a67]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
              {tournaments.length > 6 && (
                <button
                  onClick={() => setShowAllTournaments(x => !x)}
                  className="mt-2 w-full rounded-xl border border-[#d9ddcf] bg-white px-4 py-2.5 text-sm text-[#6f7a67] transition-colors hover:border-[#0B5D3B]/30 hover:text-[#162317]"
                >
                  {showAllTournaments
                    ? "Show fewer tournaments ↑"
                    : `Show more tournaments ↓ (${tournaments.length - 6} more)`}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 2 — Config */}
      {step === 2 && (
        <div>
          <button
            onClick={() => setStep(1)}
            className="mb-4 flex items-center gap-1 text-xs text-[#6f7a67] hover:text-[#162317]"
          >
            ← {selectedEvent?.name}
          </button>

          <h2 className="mb-1 text-lg font-bold text-[#162317]">Configure Your League</h2>
          <p className="mb-5 text-sm text-[#6f7a67]">Set the league name, size, and roster depth.</p>

          <div className="flex flex-col gap-5">
            {/* League name */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#6f7a67]">
                League Name
              </label>
              <input
                type="text"
                value={leagueName}
                onChange={(e) => setLeagueName(e.target.value)}
                placeholder="e.g. 757 Masters Draft"
                className="w-full rounded-xl border border-[#d9ddcf] bg-white px-4 py-3 text-sm text-[#162317] placeholder-[#b0b8a7] outline-none focus:border-[#0B5D3B] focus:ring-1 focus:ring-[#0B5D3B]"
              />
            </div>

            {/* Managers */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#6f7a67]">
                Number of Managers
              </label>
              <div className="flex gap-2">
                {MANAGER_OPTIONS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setMaxManagers(n)}
                    className={`flex-1 rounded-xl border py-3 text-sm font-semibold transition-colors ${
                      maxManagers === n
                        ? "border-[#0B5D3B] bg-[#0B5D3B] text-white"
                        : "border-[#d9ddcf] bg-white text-[#162317] hover:border-[#0B5D3B]/40"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Roster size */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#6f7a67]">
                Roster Size (players per manager)
              </label>
              <div className="flex gap-2">
                {ROSTER_OPTIONS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setRosterSize(n)}
                    className={`flex-1 rounded-xl border py-3 text-sm font-semibold transition-colors ${
                      rosterSize === n
                        ? "border-[#0B5D3B] bg-[#0B5D3B] text-white"
                        : "border-[#d9ddcf] bg-white text-[#162317] hover:border-[#0B5D3B]/40"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Draft summary */}
            <div className="rounded-xl border border-[#d9ddcf] bg-[#f6f4ed] px-4 py-3">
              <p className="text-xs font-semibold text-[#6f7a67]">Draft format</p>
              <p className="mt-0.5 text-sm font-semibold text-[#162317]">
                {rosterSize} starters + 1 bench · {rounds}-round snake draft · {totalPicks} total picks
              </p>
              <p className="mt-1.5 text-[11px] text-[#6f7a67]">
                –1 pt/stroke under par · Cut: +2/–2 · Finish: 1st+5, 2nd+4, 3–5+3, 6–10+2, 11–20+1 · Bogey-free round +1 · Best round +1
              </p>
            </div>

            <button
              onClick={() => { if (leagueName.trim()) setStep(3); }}
              disabled={!leagueName.trim()}
              className="w-full rounded-xl bg-[#0B5D3B] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0a4f32] disabled:opacity-40"
            >
              Continue to Review
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Review */}
      {step === 3 && (
        <div>
          <button
            onClick={() => setStep(2)}
            className="mb-4 flex items-center gap-1 text-xs text-[#6f7a67] hover:text-[#162317]"
          >
            ← Back
          </button>

          <h2 className="mb-1 text-lg font-bold text-[#162317]">Review & Create</h2>
          <p className="mb-5 text-sm text-[#6f7a67]">Confirm your league settings before creating.</p>

          <div className="rounded-xl border border-[#d9ddcf] bg-white divide-y divide-[#f0ede6]">
            <Row label="Tournament" value={selectedEvent?.name ?? "—"} />
            <Row
              label="Date"
              value={selectedEvent?.starts_at ? formatDate(selectedEvent.starts_at) : "TBD"}
            />
            <Row label="League name" value={leagueName} />
            <Row label="Managers" value={String(maxManagers)} />
            <Row label="Roster size" value={`${rosterSize} players`} />
            <Row label="Draft format" value={`${rosterSize}+1 bench · ${rounds}-round snake · ${totalPicks} picks`} />
            <Row label="Scoring" value="–1 pt/stroke under par · Cut: +2/–2 · Finish: 1st+5, 2nd+4, 3–5+3, 6–10+2, 11–20+1 · Bogey-free +1 · Best round +1" />
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="mt-5 w-full rounded-xl bg-[#0B5D3B] px-4 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#0a4f32] disabled:opacity-50"
          >
            {isPending ? "Creating league…" : "Create League"}
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3">
      <span className="text-xs text-[#6f7a67]">{label}</span>
      <span className="text-right text-sm font-semibold text-[#162317]">{value}</span>
    </div>
  );
}
