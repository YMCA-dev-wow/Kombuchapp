"use client";

import { useEffect, useState } from "react";

export function NotifyStockButton() {
  const [count, setCount] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/notify-stock");
      const data = await res.json();
      if (res.ok) setCount(data.count);
    })();
  }, []);

  async function handleSend() {
    if (count === 0) return;
    const confirmed = window.confirm(
      `Envoyer une invitation "nouveau stock disponible" a ${count} abonne${count && count > 1 ? "s" : ""} ?`
    );
    if (!confirmed) return;

    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/notify-stock", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setResult(`Envoye a ${data.sent} personne${data.sent > 1 ? "s" : ""}.`);
      } else {
        setResult(data.error ?? "Erreur lors de l'envoi.");
      }
    } catch {
      setResult("Impossible de contacter le serveur.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-white/60 p-4">
      <p className="text-sm font-medium">Nouveau stock disponible</p>
      <p className="mt-1 text-xs text-muted">
        {count === null
          ? "Chargement..."
          : `${count} abonne${count > 1 ? "s" : ""} recevront une invitation a consulter la boutique.`}
      </p>
      {result && <p className="mt-2 text-xs text-accent">{result}</p>}
      <button
        onClick={handleSend}
        disabled={sending || !count}
        className="mt-3 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50"
      >
        {sending ? "Envoi..." : "Prevenir du nouveau stock"}
      </button>
    </div>
  );
}
