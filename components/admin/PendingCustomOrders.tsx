"use client";

import { useEffect, useState } from "react";
import type { CustomOrder, Order, Recipe } from "@/lib/types";
import { findMatchingRecipe } from "@/lib/matchRecipe";
import { formatDesiredDate } from "@/lib/customOrderChanges";
import { RecipeNameSelect } from "@/components/RecipeNameSelect";

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

type DeliveryView = "liste" | "gout" | "client" | "semaine";
const VIEW_STORAGE_KEY = "ventes-a-honorer-vue";

const VIEW_OPTIONS: { key: DeliveryView; label: string }[] = [
  { key: "liste", label: "Liste" },
  { key: "gout", label: "Par goût" },
  { key: "client", label: "Par client" },
  { key: "semaine", label: "Par semaine" },
];

// Tri des lignes : par date de livraison (les lignes sans date à la fin) ou
// par date de commande (les plus anciennes d'abord).
type SortMode = "livraison" | "commande";
const SORT_STORAGE_KEY = "ventes-a-honorer-tri";

// Lundi de la semaine d'une date "AAAA-MM-JJ" (calcul en UTC pour éviter tout
// décalage de fuseau horaire).
function weekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d.toISOString().slice(0, 10);
}

function shortDate(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

function weekLabel(start: string): string {
  const end = new Date(`${start}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  return `Semaine du ${shortDate(start)} au ${shortDate(end.toISOString().slice(0, 10))}`;
}

type EditFields = { recipeName: string; quantity: number; customerName: string; date: string };

// Une entrée par demande à honorer (demande « sur commande » validée) ou par
// commande à livrer, pour pouvoir les regrouper ensemble.
type ItemBase = {
  id: string;
  recipe: string;
  customer: string;
  quantity: number;
  inF2: boolean;
  // Date de livraison (demande : date souhaitée ; commande : date prévue) et date de dépôt.
  deliveryDate: string | null;
  createdAt: string;
};
type Item =
  | (ItemBase & { kind: "demande"; request: CustomOrder })
  | (ItemBase & { kind: "livraison"; order: Order });

// Bouteilles en F2 (seconde fermentation) : une couleur dédiée repère les
// lignes déjà lancées en production.
const F2_BADGE = "rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-medium text-amber-900";
function cardClass(inF2: boolean): string {
  return `space-y-2 rounded-lg border p-3 ${inF2 ? "border-amber-300 bg-amber-100" : "border-border bg-white/70"}`;
}
function rowClass(inF2: boolean): string {
  return `flex w-full justify-between gap-2 rounded px-1.5 py-0.5 text-left ${inF2 ? "bg-amber-100 text-amber-900" : ""}`;
}

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
  // Changements de repère F2 faits ici (affichage immédiat, sans recharger la
  // page) ; clé = "demande:<id>" ou "livraison:<id>".
  const [f2Overrides, setF2Overrides] = useState<Record<string, boolean>>({});

  function f2Of(kind: Item["kind"], id: string, saved: boolean): boolean {
    return f2Overrides[`${kind}:${id}`] ?? saved;
  }

  // Un clic sur une ligne la fait basculer de « F2 » à « pas en F2 ».
  async function toggleF2(kind: Item["kind"], id: string, current: boolean) {
    const key = `${kind}:${id}`;
    const next = !current;
    setF2Overrides((prev) => ({ ...prev, [key]: next }));
    const url = kind === "demande" ? `/api/admin/commandes/${id}` : `/api/admin/orders/${id}`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inF2: next }),
    }).catch(() => null);
    if (!res || !res.ok) {
      // Échec : on revient à l'état précédent et on prévient.
      setF2Overrides((prev) => ({ ...prev, [key]: !next }));
      window.alert("Le repère F2 n'a pas pu être enregistré.");
    }
  }

  // Modification d'une ligne (goût, quantité, client, date) : une seule à la fois.
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<EditFields | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  function startEdit(item: Item) {
    setEditingKey(`${item.kind}:${item.id}`);
    setEditError(null);
    setEditFields({
      recipeName: item.recipe,
      quantity: item.quantity,
      customerName: item.customer,
      date: item.deliveryDate ?? "",
    });
  }

  function cancelEdit() {
    setEditingKey(null);
    setEditFields(null);
    setEditError(null);
  }

  async function saveEdit(item: Item) {
    if (!editFields) return;
    setBusyId(`edit:${item.id}`);
    setEditError(null);
    const res =
      item.kind === "demande"
        ? await fetch(`/api/admin/commandes/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipeName: editFields.recipeName,
              quantity: editFields.quantity,
              customerName: editFields.customerName,
              desiredDate: editFields.date || null,
              details: item.request.details ?? "",
            }),
          })
        : await fetch(`/api/admin/orders/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipeName: editFields.recipeName,
              quantity: editFields.quantity,
              customerName: editFields.customerName,
              deliveryDate: editFields.date || null,
            }),
          });
    if (res.ok) {
      cancelEdit();
      if (item.kind === "demande") await loadRequests();
      else await onHonored();
    } else {
      const data = await res.json().catch(() => ({}));
      setEditError(data.error ?? "Erreur lors de l'enregistrement.");
    }
    setBusyId(null);
  }

  async function deleteItem(item: Item) {
    const what =
      item.kind === "demande"
        ? "Cette demande sera supprimée (aucun email n'est envoyé)."
        : "Cette commande sera supprimée ; le stock ne sera pas modifié.";
    if (!window.confirm(`Supprimer définitivement ${item.quantity} x ${item.recipe} pour ${item.customer} ?\n${what} Action irréversible.`)) {
      return;
    }
    setBusyId(`edit:${item.id}`);
    const res = await fetch(
      item.kind === "demande" ? `/api/admin/commandes/${item.id}` : `/api/admin/orders/${item.id}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      cancelEdit();
      if (item.kind === "demande") await loadRequests();
      else await onHonored();
    } else {
      const data = await res.json().catch(() => ({}));
      window.alert(data.error ?? "La suppression a échoué.");
    }
    setBusyId(null);
  }

  // Tri choisi, retenu d'une ouverture à l'autre sur cet appareil.
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    try {
      const saved = typeof window !== "undefined" ? window.localStorage.getItem(SORT_STORAGE_KEY) : null;
      return saved === "commande" ? "commande" : "livraison";
    } catch {
      return "livraison";
    }
  });

  function changeSort(next: SortMode) {
    setSortMode(next);
    try {
      window.localStorage.setItem(SORT_STORAGE_KEY, next);
    } catch {
      // Stockage indisponible : le choix ne sera juste pas retenu.
    }
  }

  // Dernière vue choisie, retenue d'une ouverture à l'autre sur cet appareil
  // (par goût par défaut : combien de bouteilles de chaque goût à préparer).
  const [view, setView] = useState<DeliveryView>(() => {
    try {
      const saved = typeof window !== "undefined" ? window.localStorage.getItem(VIEW_STORAGE_KEY) : null;
      return VIEW_OPTIONS.some((o) => o.key === saved) ? (saved as DeliveryView) : "gout";
    } catch {
      return "gout";
    }
  });

  function changeView(next: DeliveryView) {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // Stockage indisponible (navigation privée…) : le choix ne sera juste pas retenu.
    }
  }

  async function loadRequests() {
    const res = await fetch("/api/admin/commandes");
    const data = await res.json();
    if (res.ok) {
      setRequests((data.customOrders as CustomOrder[]).filter((o) => o.status === "validee"));
    }
  }

  useEffect(() => {
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
      ? `Honorer la demande de ${request.customer_name} en prenant ${request.quantity} bouteille(s) dans le stock de "${recipe?.name}" ? La commande sera marquée comme livrée.`
      : `Honorer la demande de ${request.customer_name} en production dédiée (le stock ne sera pas modifié) ? La commande sera marquée comme livrée.`;
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

  // Une entrée par demande à honorer ou par commande à livrer : les deux sont
  // regroupées ensemble pour savoir combien de bouteilles de chaque goût
  // sont attendues, et ce que chaque client attend.
  const unsorted: Item[] = [
    ...requests.map(
      (request): Item => ({
        kind: "demande",
        id: request.id,
        recipe: request.recipe_name.trim(),
        customer: request.customer_name.trim(),
        quantity: request.quantity,
        inF2: f2Of("demande", request.id, request.in_f2),
        deliveryDate: request.desired_date,
        createdAt: request.created_at,
        request,
      })
    ),
    ...toDeliver.map(
      (order): Item => ({
        kind: "livraison",
        id: order.id,
        recipe: order.recipe_name_snapshot.trim(),
        customer: order.customer_name.trim(),
        quantity: order.quantity,
        inF2: f2Of("livraison", order.id, order.in_f2),
        deliveryDate: order.delivery_date,
        createdAt: order.created_at,
        order,
      })
    ),
  ];
  // Tri choisi : par date de livraison (les lignes sans date à la fin), puis à
  // égalité par date de commande (les plus anciennes d'abord).
  const items = [...unsorted].sort((a, b) => {
    if (sortMode === "livraison") {
      if (a.deliveryDate && b.deliveryDate && a.deliveryDate !== b.deliveryDate) {
        return a.deliveryDate < b.deliveryDate ? -1 : 1;
      }
      if (a.deliveryDate && !b.deliveryDate) return -1;
      if (!a.deliveryDate && b.deliveryDate) return 1;
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
  const sortedRequests = items.flatMap((i) => (i.kind === "demande" ? [i.request] : []));
  const deliveries = items.flatMap((i) => (i.kind === "livraison" ? [i.order] : []));

  // Bouteilles déjà en F2, affichées en haut de la zone à côté du total.
  const f2Total = items.filter((i) => i.inF2).reduce((sum, i) => sum + i.quantity, 0);
  const byRecipe = groupItems(items, (i) => i.recipe).sort(
    (a, b) => b.bottles - a.bottles || a.label.localeCompare(b.label, "fr")
  );
  const byCustomer = groupItems(items, (i) => i.customer).sort((a, b) => a.label.localeCompare(b.label, "fr"));
  // Par semaine : clé = lundi de la semaine de livraison ("" = sans date, à la fin).
  const byWeek = groupItems(items, (i) => (i.deliveryDate ? weekStart(i.deliveryDate) : "")).sort((a, b) =>
    a.key === "" ? 1 : b.key === "" ? -1 : a.key < b.key ? -1 : 1
  );
  const thisWeek = weekStart(new Date().toISOString().slice(0, 10));

  function getItem(kind: Item["kind"], id: string): Item | undefined {
    return items.find((i) => i.kind === kind && i.id === id);
  }

  // Formulaire de modification d'une ligne (goût, quantité, client, date).
  function renderEditForm(item: Item) {
    if (!editFields) return null;
    const busy = busyId === `edit:${item.id}`;
    return (
      <div className="space-y-2 rounded-lg border border-border bg-white p-3 text-sm">
        <RecipeNameSelect
          ariaLabel="Goût"
          value={editFields.recipeName}
          onChange={(name) => setEditFields({ ...editFields, recipeName: name })}
          names={recipes.map((r) => r.name)}
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
            aria-label="Client"
            value={editFields.customerName}
            onChange={(e) => setEditFields({ ...editFields, customerName: e.target.value })}
            list="customer-suggestions"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm"
          />
        </div>
        <label className="block text-xs text-muted">
          {item.kind === "demande" ? "Date souhaitée" : "Date de livraison"}
          <input
            type="date"
            value={editFields.date}
            onChange={(e) => setEditFields({ ...editFields, date: e.target.value })}
            className="mt-0.5 block w-full rounded-lg border border-border bg-white px-2 py-2 text-sm text-foreground"
          />
        </label>
        {editError && <p className="text-xs text-danger">{editError}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => saveEdit(item)}
            disabled={busy}
            className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50"
          >
            Enregistrer
          </button>
          <button type="button" onClick={cancelEdit} className="rounded-full border border-border px-3 py-1.5 text-xs">
            Annuler
          </button>
          <button
            type="button"
            onClick={() => deleteItem(item)}
            disabled={busy}
            className="ml-auto rounded-full border border-danger px-3 py-1.5 text-xs text-danger disabled:opacity-50"
          >
            Supprimer
          </button>
        </div>
      </div>
    );
  }

  // Ligne cliquable des vues groupées : un clic bascule « F2 », le crayon ouvre la modification.
  function renderRow(item: Item, primary: string) {
    const key = `${item.kind}:${item.id}`;
    return (
      <li key={item.id} className="space-y-1">
        <div className="flex items-stretch gap-1">
          <button
            type="button"
            title="Touche pour marquer / démarquer « F2 »"
            onClick={() => toggleF2(item.kind, item.id, item.inF2)}
            className={rowClass(item.inF2)}
          >
            <span className="min-w-0 truncate">
              {primary}{" "}
              <span className="text-[11px]">
                · {KIND_LABELS[item.kind]}
                {item.deliveryDate ? ` · livraison ${shortDate(item.deliveryDate)}` : ""}
              </span>
              {item.inF2 && <span className={`ml-1.5 ${F2_BADGE}`}>F2</span>}
            </span>
            <span className="shrink-0">× {item.quantity}</span>
          </button>
          <button
            type="button"
            aria-label="Modifier cette ligne"
            title="Modifier / supprimer"
            onClick={() => (editingKey === key ? cancelEdit() : startEdit(item))}
            className="shrink-0 rounded border border-border bg-white px-1.5 text-xs"
          >
            ✎
          </button>
        </div>
        {editingKey === key && renderEditForm(item)}
      </li>
    );
  }

  function renderRequestCard(request: CustomOrder) {
    const s = getSettings(request);
    const recipe = recipes.find((r) => r.id === s.recipeId);
    const enoughStock = recipe ? recipe.quantity >= request.quantity : false;
    const inF2 = f2Of("demande", request.id, request.in_f2);
    const item = getItem("demande", request.id);

    if (item && editingKey === `demande:${request.id}`) {
      return (
        <div key={request.id} className={cardClass(inF2)}>
          {renderEditForm(item)}
        </div>
      );
    }

    return (
      <div key={request.id} className={cardClass(inF2)}>
        <div
          role="button"
          tabIndex={0}
          title="Touche pour marquer / démarquer « F2 »"
          onClick={() => toggleF2("demande", request.id, inF2)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleF2("demande", request.id, inF2);
            }
          }}
          className="cursor-pointer"
        >
          <p className="flex items-center gap-2 font-medium">
            <span>
              {request.recipe_name} × {request.quantity}
            </span>
            {inF2 && <span className={F2_BADGE}>F2</span>}
          </p>
          <p className="text-xs text-muted">
            {request.customer_name}
            {request.desired_date ? ` · livraison souhaitée le ${formatDesiredDate(request.desired_date)}` : " · sans date de livraison"}
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
          {item && (
            <button
              onClick={() => startEdit(item)}
              className="rounded-full border border-border px-3 py-1.5 text-xs"
            >
              Modifier
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderDeliveryCard(order: Order) {
    const inF2 = f2Of("livraison", order.id, order.in_f2);
    const item = getItem("livraison", order.id);

    if (item && editingKey === `livraison:${order.id}`) {
      return (
        <div key={order.id} className={cardClass(inF2)}>
          {renderEditForm(item)}
        </div>
      );
    }

    return (
      <div key={order.id} className={cardClass(inF2)}>
        <div
          role="button"
          tabIndex={0}
          title="Touche pour marquer / démarquer « F2 »"
          onClick={() => toggleF2("livraison", order.id, inF2)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleF2("livraison", order.id, inF2);
            }
          }}
          className="cursor-pointer"
        >
          <p className="flex items-center gap-2 font-medium">
            <span>
              {order.recipe_name_snapshot} × {order.quantity}
            </span>
            {inF2 && <span className={F2_BADGE}>F2</span>}
          </p>
          <p className="text-xs text-muted">
            {order.customer_name} · {ORIGIN_LABELS[order.created_by]} ·{" "}
            {order.order_type === "donne"
              ? "offerte"
              : `vendue${order.unit_amount != null ? ` ${Number(order.unit_amount).toLocaleString("fr-FR")} EUR` : ""}`}{" "}
            · commandée le {new Date(order.created_at).toLocaleDateString("fr-FR")}
            {order.delivery_date ? ` · livraison le ${formatDesiredDate(order.delivery_date)}` : " · sans date de livraison"}
          </p>
        </div>
        {errors[order.id] && <p className="text-xs text-danger">{errors[order.id]}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => markDelivered([order], order.id)}
            disabled={busyId === order.id}
            className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50"
          >
            Marquer comme livrée
          </button>
          {item && (
            <button
              onClick={() => startEdit(item)}
              className="rounded-full border border-border px-3 py-1.5 text-xs"
            >
              Modifier
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-accent/40 bg-accent/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">
            À honorer ({requests.length + toDeliver.length} · {bottlesLabel(items.reduce((s, i) => s + i.quantity, 0))}
            {f2Total > 0 && <span className="text-amber-800"> · dont {f2Total} en F2</span>})
          </p>
          <p className="text-xs text-muted">
            Demandes « sur commande » validées à transformer en vente, et commandes à livrer.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Trier"
            value={sortMode}
            onChange={(e) => changeSort(e.target.value as SortMode)}
            className="rounded-lg border border-border bg-white px-2 py-1 text-xs"
          >
            <option value="livraison">Tri : date de livraison</option>
            <option value="commande">Tri : date de commande</option>
          </select>
          <div className="flex rounded-full border border-border bg-white p-0.5 text-xs">
            {VIEW_OPTIONS.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => changeView(o.key)}
                aria-pressed={view === o.key}
                className={`rounded-full px-2.5 py-1 ${view === o.key ? "bg-accent text-accent-foreground" : ""}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Liste : d'abord les demandes à honorer, puis les commandes à livrer. */}
      {view === "liste" && (
        <>
          {sortedRequests.length > 0 && <p className="text-xs font-medium">Demandes à honorer ({sortedRequests.length})</p>}
          {sortedRequests.map(renderRequestCard)}
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
            <ul className="space-y-0.5 text-xs text-muted">{group.items.map((item) => renderRow(item, item.customer))}</ul>
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
              <ul className="space-y-0.5 text-xs text-muted">{group.items.map((item) => renderRow(item, item.recipe))}</ul>
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

      {/* Par semaine : les lignes sont regroupées par semaine de livraison, avec
          toutes leurs actions (honorer, livrer, modifier). */}
      {view === "semaine" &&
        byWeek.map((group) => (
          <div key={group.key || "sans-date"} className="space-y-2 rounded-lg border border-border bg-white/50 p-3">
            <p className="flex items-baseline justify-between gap-2 font-medium">
              <span className="min-w-0">
                {group.key ? weekLabel(group.key) : "Sans date de livraison"}
                {group.key === thisWeek && (
                  <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
                    cette semaine
                  </span>
                )}
                {group.key !== "" && group.key < thisWeek && (
                  <span className="ml-1.5 rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-medium text-white">
                    en retard
                  </span>
                )}
              </span>
              <span className="shrink-0">{bottlesLabel(group.bottles)}</span>
            </p>
            {group.items.map((i) => (i.kind === "demande" ? renderRequestCard(i.request) : renderDeliveryCard(i.order)))}
          </div>
        ))}
    </div>
  );
}
