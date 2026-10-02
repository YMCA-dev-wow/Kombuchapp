"use client";

import { useState } from "react";

// Boîte d'inscription aux alertes "nouveau stock disponible" (voir
// /api/subscribe et le bouton de diffusion dans l'espace producteur).
export function SubscribeBox() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "already" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) setStatus("error");
      else setStatus(data.alreadySubscribed ? "already" : "done");
    } catch {
      setStatus("error");
    }
  }

  if (status === "already") {
    return (
      <p className="rounded-xl border border-border bg-white/60 p-4 text-sm text-muted">
        Cette adresse est déjà inscrite : tu seras prévenu(e) dès qu&apos;un nouveau stock est disponible.
      </p>
    );
  }

  if (status === "done") {
    return (
      <div className="space-y-2 rounded-xl border border-border bg-white/60 p-4 text-sm">
        <p className="font-medium">C&apos;est noté ! Un email de bienvenue vient de t&apos;être envoyé.</p>
        <p className="text-muted">
          Vérifie dans quelques minutes qu&apos;il est bien arrivé dans ta boîte de réception{" "}
          <strong>principale</strong>. Sinon :
        </p>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>
            dans les <strong>spams</strong> : ouvre-le et clique sur « Signaler comme non-spam » ;
          </li>
          <li>
            dans l&apos;onglet <strong>Promotions</strong> (Gmail) : fais-le glisser vers « Principale » ;
          </li>
          <li>
            ajoute <strong>no-reply@ymcakombucha.com</strong> à tes contacts.
          </li>
        </ul>
        <p className="text-muted">Sans ça, les alertes de stock risquent de t&apos;échapper.</p>
      </div>
    );
  }

  return (
    <>
    {status === "error" && (
      <p className="mb-2 text-sm text-danger">Une erreur est survenue, réessaie.</p>
    )}
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
        Me prévenir
      </button>
    </form>
    </>
  );
}
