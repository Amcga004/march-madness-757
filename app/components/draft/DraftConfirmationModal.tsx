"use client";

import TeamLogo from "../TeamLogo";

type Props = {
  isOpen: boolean;
  teamName: string;
  managerName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
};

export default function DraftConfirmationModal({
  isOpen,
  teamName,
  managerName,
  onConfirm,
  onCancel,
  isSubmitting = false,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <TeamLogo teamName={teamName} size={36} />
          <div>
            <h3 className="text-xl font-bold text-slate-900">Confirm Draft Pick</h3>
            <p className="text-sm text-slate-500">
              This will assign the team immediately.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border bg-slate-50 p-4">
          <p className="text-sm text-slate-500">Manager</p>
          <p className="text-base font-semibold text-slate-900">{managerName}</p>

          <div className="mt-4">
            <p className="text-sm text-slate-500">Selected Team</p>
            <p className="text-lg font-bold text-slate-900">{teamName}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-xl border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {isSubmitting ? "Drafting..." : "Confirm Draft"}
          </button>
        </div>
      </div>
    </div>
  );
}