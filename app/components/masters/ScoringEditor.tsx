"use client";

import { useState, useTransition } from "react";
import { updateScoringConfig } from "@/app/masters/create/actions";

export type ScoringConfig = {
  round_multiplier: number;
  cut_bonus: number;
  cut_penalty: number;
  finish_bonuses: number[];
  bogey_free_bonus: number;
  best_round_bonus: number;
  eagle_bonus: number;
  hole_in_one_bonus: number;
  birdie_streak_bonus: number;
  birdie_streak_min: number;
};

type Props = {
  leagueId: string;
  userId: string;
  isCommissioner: boolean;
  config: ScoringConfig;
};

const FINISH_LABELS = ["1st", "2nd", "3rd", "4th", "5th"];

function fmtBonus(n: number) {
  return n > 0 ? `+${n}` : `${n}`;
}

function NumInput({
  value,
  onChange,
  step = 1,
  allowNegative = true,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  allowNegative?: boolean;
}) {
  return (
    <input
      type="number"
      step={step}
      value={value}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v)) onChange(allowNegative ? v : Math.max(0, v));
      }}
      className="w-20 rounded-lg border border-[#d9ddcf] bg-white px-2 py-1.5 text-center text-sm font-semibold text-[#162317] focus:border-[#0B5D3B] focus:outline-none focus:ring-1 focus:ring-[#0B5D3B]"
    />
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-[#f0ede6] last:border-0">
      <span className="text-sm text-[#162317]">{label}</span>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function ScoringEditor({ leagueId, userId, isCommissioner, config }: Props) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<ScoringConfig>(config);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function set<K extends keyof ScoringConfig>(key: K, value: ScoringConfig[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function setFinishBonus(i: number, v: number) {
    setValues((prev) => {
      const fb = [...prev.finish_bonuses];
      fb[i] = v;
      return { ...prev, finish_bonuses: fb };
    });
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateScoringConfig(leagueId, userId, values as unknown as Record<string, unknown>);
      if (result.ok) {
        setSaved(true);
        setEditing(false);
      } else {
        setError(result.error ?? "Failed to save");
      }
    });
  }

  function handleCancel() {
    setValues(config);
    setEditing(false);
    setError(null);
  }

  const displayFinish = values.finish_bonuses.slice(0, 5).concat(
    Array(Math.max(0, 5 - values.finish_bonuses.length)).fill(0)
  );

  return (
    <div className="rounded-2xl border border-[#d9ddcf] bg-white shadow-[0_4px_12px_rgba(16,24,40,0.04)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-5 pt-5 pb-4 border-b border-[#f0ede6]">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6f7a67]">Scoring Rules</p>
          <h2 className="text-base font-bold text-[#162317]">League Scoring</h2>
        </div>
        {isCommissioner && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg border border-[#d9ddcf] bg-white px-3 py-1.5 text-xs font-semibold text-[#162317] transition-colors hover:border-[#0B5D3B]/40 hover:bg-[#f6f4ed]"
          >
            Edit Scoring
          </button>
        )}
        {saved && !editing && (
          <span className="text-xs font-semibold text-[#0B5D3B]">✓ Saved</span>
        )}
      </div>

      <div className="px-5 py-2">
        {/* Strokes section */}
        <p className="mt-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#6f7a67]">Strokes</p>
        <div className="rounded-xl border border-[#d9ddcf] bg-[#f9f8f4] px-4 divide-y divide-[#f0ede6]">
          <Row label="Points per stroke under par">
            {editing ? (
              <NumInput value={values.round_multiplier} onChange={(v) => set("round_multiplier", v)} allowNegative={false} />
            ) : (
              <span className="text-sm font-semibold text-[#0B5D3B]">{fmtBonus(values.round_multiplier)}</span>
            )}
          </Row>
          <Row label="Points per stroke over par">
            <span className="text-sm font-semibold text-[#DC2626]">{fmtBonus(-values.round_multiplier)}</span>
          </Row>
        </div>

        {/* Cut section */}
        <p className="mt-4 mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#6f7a67]">Cut</p>
        <div className="rounded-xl border border-[#d9ddcf] bg-[#f9f8f4] px-4 divide-y divide-[#f0ede6]">
          <Row label="Made cut bonus">
            {editing ? (
              <NumInput value={values.cut_bonus} onChange={(v) => set("cut_bonus", v)} />
            ) : (
              <span className="text-sm font-semibold text-[#0B5D3B]">{fmtBonus(values.cut_bonus)}</span>
            )}
          </Row>
          <Row label="Missed cut penalty">
            {editing ? (
              <NumInput value={values.cut_penalty} onChange={(v) => set("cut_penalty", v)} />
            ) : (
              <span className="text-sm font-semibold text-[#DC2626]">{fmtBonus(values.cut_penalty)}</span>
            )}
          </Row>
        </div>

        {/* Finish bonuses */}
        <p className="mt-4 mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#6f7a67]">Finish Bonuses</p>
        <div className="rounded-xl border border-[#d9ddcf] bg-[#f9f8f4] px-4 divide-y divide-[#f0ede6]">
          {displayFinish.map((bonus, i) => (
            <Row key={i} label={`${FINISH_LABELS[i]} place`}>
              {editing ? (
                <NumInput value={bonus} onChange={(v) => setFinishBonus(i, v)} allowNegative={false} />
              ) : (
                <span className="text-sm font-semibold text-[#C9A84C]">{fmtBonus(bonus)}</span>
              )}
            </Row>
          ))}
        </div>

        {/* Round bonuses */}
        <p className="mt-4 mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#6f7a67]">Round Bonuses</p>
        <div className="rounded-xl border border-[#d9ddcf] bg-[#f9f8f4] px-4 divide-y divide-[#f0ede6]">
          <Row label="Bogey-free round">
            {editing ? (
              <NumInput value={values.bogey_free_bonus} onChange={(v) => set("bogey_free_bonus", v)} allowNegative={false} />
            ) : (
              <span className="text-sm font-semibold text-[#0B5D3B]">{fmtBonus(values.bogey_free_bonus)}</span>
            )}
          </Row>
          <Row label="Best round of the day">
            {editing ? (
              <NumInput value={values.best_round_bonus} onChange={(v) => set("best_round_bonus", v)} allowNegative={false} />
            ) : (
              <span className="text-sm font-semibold text-[#0B5D3B]">{fmtBonus(values.best_round_bonus)}</span>
            )}
          </Row>
        </div>

        {/* Special bonuses */}
        <p className="mt-4 mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#6f7a67]">Special</p>
        <div className="rounded-xl border border-[#d9ddcf] bg-[#f9f8f4] px-4 divide-y divide-[#f0ede6]">
          <Row label="Eagle">
            {editing ? (
              <NumInput value={values.eagle_bonus} onChange={(v) => set("eagle_bonus", v)} allowNegative={false} />
            ) : (
              <span className="text-sm font-semibold text-[#0B5D3B]">{fmtBonus(values.eagle_bonus)}</span>
            )}
          </Row>
          <Row label="Hole in one">
            {editing ? (
              <NumInput value={values.hole_in_one_bonus} onChange={(v) => set("hole_in_one_bonus", v)} allowNegative={false} />
            ) : (
              <span className="text-sm font-semibold text-[#0B5D3B]">{fmtBonus(values.hole_in_one_bonus)}</span>
            )}
          </Row>
          <Row label={`Birdie streak (${values.birdie_streak_min}+ in a row)`}>
            {editing ? (
              <NumInput value={values.birdie_streak_bonus} onChange={(v) => set("birdie_streak_bonus", v)} allowNegative={false} />
            ) : (
              <span className="text-sm font-semibold text-[#0B5D3B]">{fmtBonus(values.birdie_streak_bonus)}</span>
            )}
          </Row>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Edit-mode buttons */}
        {editing && (
          <div className="mt-5 flex gap-2 pb-5">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex-1 rounded-xl bg-[#0B5D3B] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0a4f32] disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save Changes"}
            </button>
            <button
              onClick={handleCancel}
              disabled={isPending}
              className="rounded-xl border border-[#d9ddcf] bg-white px-4 py-2.5 text-sm font-semibold text-[#162317] transition-colors hover:bg-[#f6f4ed] disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        )}

        {!editing && <div className="pb-1" />}
      </div>
    </div>
  );
}
