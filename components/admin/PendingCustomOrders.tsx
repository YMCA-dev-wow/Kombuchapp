"use client";

import { useEffect, useState } from "react";
import type { CustomOrder, Order, Recipe } from "@/lib/types";
import { findMatchingRecipe } from "@/lib/matchRecipe";

type RowSettings = {
  recipeId: string;
  orderType: "vendu" | "donne";
  unitAmount: number | "";
};

const ORIGIN_LABELS: Record<Order["created_by"], string> = {
  site: "Site",
  admin: "Saisie manuelle",
  sur_commande: "Sur commande",
};

type DeliveryView = "liste" | "gout" | "client";

const VIEW_OPTIONS: { key: DeliveryView; label: string }[] = [
  { key: "liste", label: "Liste" },
  { key: "gout", label: "Par goût" },
  { key: "client", label: "Par client" },
];

// Une entrée par demande à honorer (demande « sur commande » validée) ou par
// commande à livrer, pour pouvoir les regrouper ensemble.
type Item =
  | { kind: "demande"; id: string; recipe: string; customer: string; quantity: number; request: CustomOrder }
  | { kind: "livraison"; id: string; recipe: string; customer: string; quantity: number; order: Order };

const KIND_LABELS: Record<Item["kind"], string> = { demande: "à honorer", livraison: "à livrer" };

type Group = { key: string; label: string; items: Item[]; bottles: number };

// Regroupe sans tenir compte de la casse ni des espaces autour du nom.
function groupItems(items: Item[], labelOf: (i: Item) => string): Group[] {
  const map = new Map<string, Group>();
  for (const item of items) {
    const label = labelOf(item);
    const key = label.toLowerCase();
    const group = map.get(key) ?? { key, label, items: [], bottles: 0 };
    group.items.push(item);
    group.bottles += item.quantity;
    map.set(key, group);
  }
  return Array.from(map.values());
}

function bottlesLabel(n: number): string {
  return `${n} bouteille${n > 1 ? "s" : ""}`;
}

// Zone « À honorer » de l'onglet Ventes. Elle regroupe :
// - les demandes "sur commande" validées, pas encore transformées en vente
//   (honorées depuis le stock si le stock suffit, ou en "production dédiée"
//   sans toucher au stock) ;
// - toutes les commandes déjà enregistrées mais pas encore livrées, quelle
//   que soit leur origine (site, saisie manuelle, sur commande) : le stock a
//   déjà été décompté, il ne reste qu'à les marquer comme livrées.
export function PendingCustomOrders({
  recipes,
  toDeliver,
  onHonored,
}: {
  recipes: Recipe[];
  toDeliver: Order[];
  onHonored: () => Promise<void> | void;
}) {
  const [requests, setRequests] = useState<CustomOrder[]>([]);
  const [settings, setSettings] = useState<Record<string, RowSettings>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [view, setView] = useState<DeliveryView>("liste");

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

  // Marque une ou plusieurs commandes comme livrées (un seul clic pour tout
  // un client, par exemple). `busyKey` identifie le bouton occupé.
  async function markDelivered(targets: Order[], busyKey: string) {
    setBusyId(busyKey);
    setErrors((prev) => ({ ...prev, [busyKey]: "" }));
    const results = await Promise.all(
      targets.map((order) =>
        fetch(`/api/admin/orders/${order.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deliveryStatus: "livree" }),
        }).then((res) => res.ok)
      )
    );
    const failed = results.filter((ok) => !ok).length;
    if (failed > 0) {
      setErrors((prev) => ({
        ...prev,
        [busyKey]: `${failed} commande${failed > 1 ? "s" : ""} n'${failed > 1 ? "ont" : "a"} pas pu être mise${failed > 1 ? "s" : ""} à jour.`,
      }));
    }
    await onHonored();
    setBusyId(null);
  }

  function handleDeliverGroup(name: string, targets: Order[]) {
    const bottles = targets.reduce((sum, o) => sum + o.quantity, 0);
    if (!window.confirm(`Marquer comme livrées les ${targets.length} commande(s) (${bottles} bouteille(s)) de ${name} ?`)) return;
    markDelivered(targets, `group:${name}`);
  }

  if (requests.length === 0 && toDeliver.length === 0) return null;

  // Les plus anciennes d'abord : ce sont celles qui attendent depuis le plus longtemps.
  const deliveries = [...toDeliver].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Une entrée par demande à honorer ou par commande à livrer : les deux sont
  // regroupées ensemble pour savoir combien de bouteilles de chaque goût
  // sont attendues, et ce que chaque client attend.
  const items: Item[] = [
    ...requests.map(
      (request): Item => ({
        kind: "demande",
        id: request.id,
        recipe: request.recipe_name.trim(),
        customer: request.customer_name.trim(),
        quantity: request.quantity,
        request,
      })
    ),
    ...deliveries.map(
      (order): Item => ({
        kind: "livraison",
        id: order.id,
        recipe: order.recipe_name_snapshot.trim(),
        customer: order.customer_name.trim(),
        quantity: order.quantity,
        order,
      })
    ),
  ];
  const byRecipe = groupItems(items, (i) => i.recipe).sort(
    (a, b) => b.bottles - a.bottles || a.label.localeCompare(b.label, "fr")
  );
  const byCustomer = groupItems(items, (i) => i.customer).sort((a, b) => a.label.localeCompare(b.label, "fr"));

  function renderRequestCard(request: CustomOrder) {
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
  }

  function renderDeliveryCard(order: Order) {
    return (
      <div key={order.id} className="space-y-2 rounded-lg border border-border bg-white/70 p-3">
        <div>
          <p className="font-medium">
            {order.recipe_name_snapshot} × {order.quantity}
          </p>
          <p className="text-xs text-muted">
            {order.customer_name} · {ORIGIN_LABELS[order.created_by]} ·{" "}
            {order.order_type === "donne"
              ? "offerte"
              : `vendue${order.unit_amount != null ? ` ${Number(order.unit_amount).toLocaleString("fr-FR")} EUR` : ""}`}{" "}
            · le {new Date(order.created_at).toLocaleDateString("fr-FR")}
          </p>
        </div>
        {errors[order.id] && <p className="text-xs text-danger">{errors[order.id]}</p>}
        <button
          onClick={() => markDelivered([order], order.id)}
          disabled={busyId === order.id}
          className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50"
        >
          Marquer comme livrée
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-accent/40 bg-accent/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">
            À honorer ({requests.length + toDeliver.length} · {bottlesLabel(items.reduce((s, i) => s + i.quantity, 0))})
          </p>
          <p className="text-xs text-muted">
            Demandes « sur commande » validées à transformer en vente, et commandes à livrer.
          </p>
        </div>
        <div className="flex rounded-full border border-border bg-white p-0.5 text-xs">
          {VIEW_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setView(o.key)}
              aria-pressed={view === o.key}
              className={`rounded-full px-2.5 py-1 ${view === o.key ? "bg-accent text-accent-foreground" : ""}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Liste : d'abord les demandes à honorer, puis les commandes à livrer. */}
      {view === "liste" && (
        <>
          {requests.length > 0 && <p className="text-xs font-medium">Demandes à honorer ({requests.length})</p>}
          {requests.map(renderRequestCard)}
          {deliveries.length > 0 && (
            <p className="text-xs font-medium">
              Commandes à livrer ({deliveries.length} · {bottlesLabel(deliveries.reduce((s, o) => s + o.quantity, 0))})
            </p>
          )}
          {deliveries.map(renderDeliveryCard)}
        </>
      )}

      {/* Par goût : combien de bouteilles de chaque goût sont attendues, et pour qui. */}
      {view === "gout" &&
        byRecipe.map((group) => (
          <div key={group.key} className="space-y-1.5 rounded-lg border border-border bg-white/70 p-3">
            <p className="flex items-baseline justify-between gap-2 font-medium">
              <span className="min-w-0 truncate">{group.label}</span>
              <span className="shrink-0">{bottlesLabel(group.bottles)}</span>
            </p>
            <ul className="space-y-0.5 text-xs text-muted">
              {group.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">
                    {item.customer} <span className="text-[11px]">· {KIND_LABELS[item.kind]}</span>
                  </span>
                  <span className="shrink-0">× {item.quantity}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}

      {/* Par client : tout ce qu'un client attend. Les demandes restent honorables
          depuis cette vue, et ses livraisons se valident d'un seul bouton. */}
      {view === "client" &&
        byCustomer.map((group) => {
          const busyKey = `group:${group.label}`;
          const groupDeliveries = group.items.flatMap((i) => (i.kind === "livraison" ? [i.order] : []));
          const groupRequests = group.items.flatMap((i) => (i.kind === "demande" ? [i.request] : []));
          return (
            <div key={group.key} className="space-y-2 rounded-lg border border-border bg-white/70 p-3">
              <p className="flex items-baseline justify-between gap-2 font-medium">
                <span className="min-w-0 truncate">{group.label}</span>
                <span className="shrink-0">{bottlesLabel(group.bottles)}</span>
              </p>
              <ul className="space-y-0.5 text-xs text-muted">
                {group.items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">
                      {item.recipe} <span className="text-[11px]">· {KIND_LABELS[item.kind]}</span>
                    </span>
                    <span className="shrink-0">× {item.quantity}</span>
                  </li>
                ))}
              </ul>
              {groupDeliveries.length > 0 && (
                <>
                  {errors[busyKey] && <p className="text-xs text-danger">{errors[busyKey]}</p>}
                  <button
                    onClick={() => handleDeliverGroup(group.label, groupDeliveries)}
                    disabled={busyId === busyKey}
                    className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50"
                  >
                    Tout marquer comme livré ({groupDeliveries.length})
                  </button>
                </>
              )}
              {groupRequests.length > 0 && (
                <div className="space-y-2 border-t border-border pt-2">
                  <p className="text-xs font-medium">À honorer</p>
                  {groupRequests.map(renderRequestCard)}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
