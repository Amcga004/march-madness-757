"use client";

import { useState } from "react";

export default function InviteCopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="shrink-0 rounded-lg border border-[#d9ddcf] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#162317] transition-colors hover:bg-[#f6f4ed]"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}
