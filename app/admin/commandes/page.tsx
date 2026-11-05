"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CustomOrder } from "@/lib/types";
import { diffCustomOrder } from "@/lib/customOrderChanges";
import { RecipeNameSelect } from "@/components/RecipeNameSelect";

type EditFields = { recipeName: string; quantity: number; desiredDate: string; details: string };

const statusLabel: Record<CustomOrder["status"], string> = {
  en_attente: "En attente",
  validee: "Validée",
  refusee: "Refusée",
  honoree: "Honorée",
};

export default function AdminCommandesPage() {
  const [orders, setOrders] = useState<CustomOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<EditFields | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  // Goûts du catalogue pour le menu déroulant de modification.
  const [recipeNames, setRecipeNames] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/recipes");
      const data = await res.json();
      if (res.ok) {
        setRecipeNames((data.recipes as { name: string; active: boolean }[]).filter((r) => r.active).map((r) => r.name));
      }
    })();
  }, []);

  function startEdit(order: CustomOrder) {
    setEditingId(order.id);
    setEditError(null);
    setEditFields({
      recipeName: order.recipe_name,
      quantity: order.quantity,
      desiredDate: order.desired_date ?? "",
      details: order.details ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditFields(null);
    setEditError(null);
  }

  // Modification par le producteur (après un échange avec le client). Aucun
  // email n'est envoyé ici : le client est prévenu à la validation.
  async function saveEdit(order: CustomOrder) {
    if (!editFields) return;
    setBusyId(order.id);
    setEditError(null);
    const res = await fetch(`/api/admin/commandes/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipeName: editFields.recipeName,
        quantity: editFields.quantity,
        desiredDate: editFields.desiredDate || null,
        details: editFields.details,
      }),
    });
    if (res.ok) {
      cancelEdit();
      await loadOrders();
    } else {
      const data = await res.json().catch(() => ({}));
      setEditError(data.error ?? "Erreur lors de l'enregistrement.");
    }
    setBusyId(null);
  }

  async function loadOrders() {
    setLoading(true);
    const res = await fetch("/api/admin/commandes");
    const data = await res.json();
    if (res.ok) setOrders(data.customOrders);
    setLoading(false);
  }

  useEffect(() => {
    // Chargement initial des données au montage : cas d'usage explicitement
    // recommandé par React (fetch au mount), la règle react-hooks/set-state-in-effect
    // vise d'autres anti-patterns (état dérivé), pas celui-ci.
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
      <h1 className="text-xl font-semibold">Commandes personnalisées</h1>

      {loading ? (
        <p className="text-sm text-muted">Chargement...</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-muted">Aucune demande pour le moment.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const changes = diffCustomOrder(order.original_request, {
              recipe_name: order.recipe_name,
              quantity: order.quantity,
              desired_date: order.desired_date,
              details: order.details ?? "",
            });
            return (
            <div key={order.id} className="rounded-xl border border-border bg-white/60 p-4">
              {editingId === order.id && editFields ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted">
                    Demande de {order.customer_name} : modifie ce qui a été convenu avec le client.
                  </p>
                  <RecipeNameSelect
                    ariaLabel="Goût"
                    value={editFields.recipeName}
                    onChange={(name) => setEditFields({ ...editFields, recipeName: name })}
                    names={recipeNames}
                    required
                  />
                  <div className="flex gap-2">
                    <input
                      aria-label="Quantité"
                      type="number"
                      min={1}
                      value={editFields.quantity}
                      onChange={(e) => setEditFields({ ...editFields, quantity: Number(e.target.value) })}
                      className="w-20 rounded-lg border border-border bg-white px-2 py-2 text-sm"
                    />
                    <input
                      aria-label="Date souhaitée"
                      type="date"
                      value={editFields.desiredDate}
                      onChange={(e) => setEditFields({ ...editFields, desiredDate: e.target.value })}
                      className="flex-1 rounded-lg border border-border bg-white px-2 py-2 text-sm"
                    />
                  </div>
                  <textarea
                    aria-label="Précisions"
                    value={editFields.details}
                    onChange={(e) => setEditFields({ ...editFields, details: e.target.value })}
                    rows={3}
                    placeholder="Précisions"
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                  />
                  {editError && <p className="text-xs text-danger">{editError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(order)}
                      disabled={busyId === order.id}
                      className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50"
                    >
                      Enregistrer
                    </button>
                    <button onClick={cancelEdit} className="rounded-full border border-border px-3 py-1.5 text-xs">
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
              <>
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
                    <p className="text-xs text-muted">Souhaitée pour le {order.desired_date}</p>
                  )}
                  {order.details && <p className="mt-1 text-sm">{order.details}</p>}
                  {changes.length > 0 && (
                    <div className="mt-2 rounded-lg border border-accent/40 bg-accent/5 p-2 text-xs">
                      <p className="font-medium">Modifiée par rapport à la demande initiale :</p>
                      <ul className="mt-0.5 space-y-0.5 text-muted">
                        {changes.map((c) => (
                          <li key={c.label}>
                            {c.label} : {c.before} → <span className="text-foreground">{c.after}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <span className="shrink-0 rounded-full border border-border px-2 py-1 text-xs">
                  {statusLabel[order.status]}
                </span>
              </div>

              {order.status === "validee" && (
                <p className="mt-3 text-xs text-muted">
                  En attente de livraison :{" "}
                  <Link href="/admin/ventes" className="text-accent underline">
                    à honorer dans l&apos;onglet Ventes
                  </Link>
                  .
                </p>
              )}

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
                  <button
                    onClick={() => startEdit(order)}
                    disabled={busyId === order.id}
                    className="rounded-full border border-border px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    Modifier
                  </button>
                </div>
              )}
              </>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
