"use client";

import { useState } from "react";

// Boite d'inscription aux alertes "nouveau stock disponible" (voir
// /api/subscribe et le bouton de diffusion dans l'espace producteur).
export function SubscribeBox() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } finally {
      setStatus("done");
    }
  }

  if (status === "done") {
    return (
      <p className="rounded-xl border border-border bg-white/60 p-4 text-sm text-muted">
        Tu seras prevenu(e) par email des qu&apos;un nouveau stock est disponible !
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 rounded-xl border border-border bg-white/60 p-3"
    >
      <input
        type="email"
        required
        placeholder="ton@email.fr"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="shrink-0 rounded-full bg-accent px-3 py-2 text-xs font-medium text-accent-foreground disabled:opacity-60"
      >
        Me prevenir
      </button>
    </form>
  );
}
