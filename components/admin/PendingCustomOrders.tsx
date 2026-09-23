"use client";

import { useEffect, useState } from "react";
import type { CustomOrder, Recipe } from "@/lib/types";
import { findMatchingRecipe } from "@/lib/matchRecipe";

type RowSettings = {
  recipeId: string;
  orderType: "vendu" | "donne";
  unitAmount: number | "";
};

// Zone tampon de l'onglet Ventes : demandes "sur commande" validées mais
// pas encore livrées. Chacune peut être honorée depuis le stock (si le
// stock suffit) ou en "production dédiée" (sans toucher au stock).
export function PendingCustomOrders({
  recipes,
  onHonored,
}: {
  recipes: Recipe[];
  onHonored: () => Promise<void> | void;
}) {
  const [requests, setRequests] = useState<CustomOrder[]>([]);
  const [settings, setSettings] = useState<Record<string, RowSettings>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function loadRequests() {
    const res = await fetch("/api/admin/commandes");
    const data = await res.json();
    if (res.ok) {
      setRequests((data.customOrders as CustomOrder[]).filter((o) => o.status === "validee"));
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRequests();
  }, []);

  function getSettings(request: CustomOrder): RowSettings {
    return (
      settings[request.id] ?? {
        recipeId: findMatchingRecipe(request.recipe_name, recipes)?.id ?? "",
        orderType: "vendu",
        unitAmount: "",
      }
    );
  }

  function updateSettings(request: CustomOrder, patch: Partial<RowSettings>) {
    setSettings((prev) => ({ ...prev, [request.id]: { ...getSettings(request), ...patch } }));
  }

  async function handleHonor(request: CustomOrder, fromStock: boolean) {
    const s = getSettings(request);
    const recipe = recipes.find((r) => r.id === s.recipeId);
    const confirmation = fromStock
      ? `Honorer la demande de ${request.customer_name} en prenant ${request.quantity} bouteille(s) dans le stock de "${recipe?.name}" ?`
      : `Honorer la demande de ${request.customer_name} en production dédiée (le stock ne sera pas modifié) ?`;
    if (!window.confirm(confirmation)) return;

    setBusyId(request.id);
    setErrors((prev) => ({ ...prev, [request.id]: "" }));
    const res = await fetch(`/api/admin/commandes/${request.id}/honorer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipeId: s.recipeId || null,
        fromStock,
        orderType: s.orderType,
        unitAmount: s.orderType === "vendu" && s.unitAmount !== "" ? Number(s.unitAmount) : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrors((prev) => ({ ...prev, [request.id]: data.error ?? "Erreur lors de l'opération." }));
    } else {
      await loadRequests();
      await onHonored();
    }
    setBusyId(null);
  }

  if (requests.length === 0) return null;

  return (
    <div className="space-y-3 rounded-xl border border-accent/40 bg-accent/5 p-4">
      <div>
        <p className="text-sm font-medium">À honorer ({requests.length})</p>
        <p className="text-xs text-muted">
          Demandes « sur commande » validées, pas encore transformées en vente.
        </p>
      </div>

      {requests.map((request) => {
        const s = getSettings(request);
        const recipe = recipes.find((r) => r.id === s.recipeId);
        const enoughStock = recipe ? recipe.quantity >= request.quantity : false;

        return (
          <div key={request.id} className="space-y-2 rounded-lg border border-border bg-white/70 p-3">
            <div>
              <p className="font-medium">
                {request.recipe_name} × {request.quantity}
              </p>
              <p className="text-xs text-muted">
                {request.customer_name}
                {request.desired_date ? ` · souhaitée pour le ${request.desired_date}` : ""}
                {request.customer_email ? "" : " · pas d'email (pas de notification)"}
              </p>
            </div>

            <select
              value={s.recipeId}
              onChange={(e) => updateSettings(request, { recipeId: e.target.value })}
              className="w-full rounded-lg border border-border bg-white px-2 py-2 text-sm"
            >
              <option value="">-- Recette hors catalogue --</option>
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.quantity} en stock)
                </option>
              ))}
            </select>

            {recipe && (
              <p className={`text-xs ${enoughStock ? "text-accent" : "text-danger"}`}>
                {recipe.quantity} dispo / {request.quantity} demandée{request.quantity > 1 ? "s" : ""}
                {enoughStock ? "" : " : stock insuffisant"}
              </p>
            )}

            <div className="flex gap-2">
              <select
                value={s.orderType}
                onChange={(e) => updateSettings(request, { orderType: e.target.value as "vendu" | "donne" })}
                className="rounded-lg border border-border bg-white px-2 py-2 text-sm"
              >
                <option value="vendu">Vendu</option>
                <option value="donne">Offert</option>
              </select>
              {s.orderType === "vendu" && (
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  placeholder="Montant (EUR)"
                  value={s.unitAmount}
                  onChange={(e) =>
                    updateSettings(request, {
                      unitAmount: e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                  className="flex-1 rounded-lg border border-border bg-white px-2 py-2 text-sm"
                />
              )}
            </div>

            {errors[request.id] && <p className="text-xs text-danger">{errors[request.id]}</p>}

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleHonor(request, true)}
                disabled={busyId === request.id || !recipe || !enoughStock}
                className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-40"
              >
                Honorer depuis le stock
              </button>
              <button
                onClick={() => handleHonor(request, false)}
                disabled={busyId === request.id}
                className="rounded-full border border-border px-3 py-1.5 text-xs disabled:opacity-50"
              >
                Honorer (production dédiée)
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
