"use client";

import { useState } from "react";

type Props = { code: string; label: string; copied: string; text: string };

/** Shares the short link (/p/CODE), the same one printed on the plaque. */
export default function ShareButton({ code, label, copied, text }: Props) {
  const [done, setDone] = useState(false);

  async function share() {
    const url = `${location.origin}/p/${code}`;
    try {
      if (navigator.share) {
        await navigator.share({ url, text });
        return;
      }
      await navigator.clipboard.writeText(url);
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    } catch {
      // The person dismissed the share sheet, or clipboard access was denied.
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="min-h-12 rounded-full bg-accent px-6 font-semibold text-accent-ink"
    >
      <span role="status">{done ? copied : label}</span>
    </button>
  );
}
