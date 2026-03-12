"use client";

import { useState } from "react";

export default function SyncPage() {
  const [message, setMessage] = useState("");

  async function handleSync() {
    setMessage("Syncing...");

    try {
      const response = await fetch("/api/sync-results", {
        method: "POST",
      });

      const text = await response.text();

      let result: any = null;

      try {
        result = JSON.parse(text);
      } catch {
        setMessage(`Sync failed. Non-JSON response: ${text.slice(0, 200)}`);
        return;
      }

      if (result.ok) {
        setMessage(`Sync complete. Applied ${result.applied}, skipped ${result.skipped}.`);
      } else {
        setMessage(result.error || "Sync failed.");
      }
    } catch (error) {
      setMessage("Sync failed due to a network or server error.");
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold">Sync Results</h1>
        <p className="mt-2 text-gray-600">
          Pull completed NCAA games from the public feed and apply scoring automatically.
        </p>

        <button
          onClick={handleSync}
          className="mt-6 rounded-xl bg-black px-4 py-2 text-white"
        >
          Run Manual Sync
        </button>

        {message ? <p className="mt-4 text-sm text-gray-600">{message}</p> : null}
      </div>
    </main>
  );
}