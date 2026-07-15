"use client";

import { useEffect, useState } from "react";
import type { CustomOrder } from "@/lib/types";

const statusLabel: Record<CustomOrder["status"], string> = {
  en_attente: "En attente",
  validee: "Validee",
  refusee: "Refusee",
};

export default function AdminCommandesPage() {
  const [orders, setOrders] = useState<CustomOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadOrders() {
    setLoading(true);
    const res = await fetch("/api/admin/commandes");
    const data = await res.json();
    if (res.ok) setOrders(data.customOrders);
    setLoading(false);
  }

  useEffect(() => {
    // Chargement initial des donnees au montage : cas d'usage explicitement
    // recommande par React (fetch au mount), la regle react-hooks/set-state-in-effect
    // vise d'autres anti-patterns (etat derive), pas celui-ci.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOrders();
  }, []);

  async function updateStatus(order: CustomOrder, status: "validee" | "refusee") {
    setBusyId(order.id);
    await fetch(`/api/admin/commandes/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await loadOrders();
    setBusyId(null);
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Commandes personnalisees</h1>

      {loading ? (
        <p className="text-sm text-muted">Chargement...</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-muted">Aucune demande pour le moment.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="rounded-xl border border-border bg-white/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {order.recipe_name} × {order.quantity}
                  </p>
                  <p className="text-sm text-muted">
                    {order.customer_name}
                    {order.customer_email ? ` · ${order.customer_email}` : ""}
                  </p>
                  {order.desired_date && (
                    <p className="text-xs text-muted">Souhaitee pour le {order.desired_date}</p>
                  )}
                  {order.details && <p className="mt-1 text-sm">{order.details}</p>}
                </div>
                <span className="shrink-0 rounded-full border border-border px-2 py-1 text-xs">
                  {statusLabel[order.status]}
                </span>
              </div>

              {order.status === "en_attente" && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => updateStatus(order, "validee")}
                    disabled={busyId === order.id}
                    className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50"
                  >
                    Valider
                  </button>
                  <button
                    onClick={() => updateStatus(order, "refusee")}
                    disabled={busyId === order.id}
                    className="rounded-full border border-border px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    Refuser
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
