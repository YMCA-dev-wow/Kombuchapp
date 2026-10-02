"use client";

import { useEffect, useState } from "react";
import type { Subscriber } from "@/lib/types";
import { NotifyStockButton } from "@/components/admin/NotifyStockButton";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function AdminAbonnesPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Abonnés cochés pour la prochaine diffusion (tous par défaut).
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function loadAll(selectAll = false) {
    setLoading(true);
    const res = await fetch("/api/admin/subscribers");
    const data = await res.json();
    if (res.ok) {
      const list = data.subscribers as Subscriber[];
      setSubscribers(list);
      setSelected((prev) =>
        selectAll ? new Set(list.map((s) => s.id)) : new Set(list.filter((s) => prev.has(s.id)).map((s) => s.id))
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll(true);
  }, []);

  const allSelected = subscribers.length > 0 && selected.size === subscribers.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(subscribers.map((s) => s.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

      {!loading && subscribers.length > 0 && (
        <NotifyStockButton subscriberIds={subscribers.filter((s) => selected.has(s.id)).map((s) => s.id)} />
      )}

      {loading ? null : subscribers.length === 0 ? (
        <p className="text-sm text-muted">Aucun abonné pour le moment.</p>
      ) : (
        <div className="space-y-2">
          <label className="flex items-center gap-2 px-3 text-sm font-medium">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-accent" />
            Tout sélectionner ({selected.size}/{subscribers.length})
          </label>

          {subscribers.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white/60 p-3"
            >
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(s.id)}
                  onChange={() => toggleOne(s.id)}
                  className="h-4 w-4 shrink-0 accent-accent"
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{s.email}</span>
                  <span className="block text-xs text-muted">Inscrit(e) le {formatDate(s.created_at)}</span>
                </span>
              </label>
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
