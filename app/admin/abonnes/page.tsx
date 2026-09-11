"use client";

import { useEffect, useState } from "react";
import type { Subscriber } from "@/lib/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function AdminAbonnesPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    const res = await fetch("/api/admin/subscribers");
    const data = await res.json();
    if (res.ok) setSubscribers(data.subscribers);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
  }, []);

  async function handleDelete(id: string, email: string) {
    const confirmed = window.confirm(`Désinscrire ${email} des alertes de nouveau stock ?`);
    if (!confirmed) return;
    setBusyId(id);
    await fetch(`/api/admin/subscribers/${id}`, { method: "DELETE" });
    await loadAll();
    setBusyId(null);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Abonnés</h1>
        <p className="mt-1 text-sm text-muted">
          {loading
            ? "Chargement..."
            : `${subscribers.length} adresse${subscribers.length > 1 ? "s" : ""} inscrite${subscribers.length > 1 ? "s" : ""} aux alertes de nouveau stock.`}
        </p>
      </div>

      {loading ? null : subscribers.length === 0 ? (
        <p className="text-sm text-muted">Aucun abonné pour le moment.</p>
      ) : (
        <div className="space-y-2">
          {subscribers.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white/60 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{s.email}</p>
                <p className="text-xs text-muted">Inscrit(e) le {formatDate(s.created_at)}</p>
              </div>
              <button
                onClick={() => handleDelete(s.id, s.email)}
                disabled={busyId === s.id}
                className="shrink-0 rounded-full border border-danger px-3 py-1.5 text-xs text-danger disabled:opacity-50"
              >
                Désinscrire
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
