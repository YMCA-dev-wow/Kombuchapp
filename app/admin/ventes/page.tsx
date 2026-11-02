"use client";

import { useEffect, useState } from "react";
import type { Order, Recipe } from "@/lib/types";
import { PendingCustomOrders } from "@/components/admin/PendingCustomOrders";

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

type EditableFields = {
  recipeName: string;
  quantity: number;
  customerName: string;
  createdAt: string;
  orderType: "vendu" | "donne";
  unitAmount: number | null;
  deliveryStatus: "a_livrer" | "livree";
  pickupStatus: "a_recuperer" | "recuperee";
};

// Filtres combinables : à l'intérieur d'un même groupe, une commande doit
// correspondre à AU MOINS UNE option cochée (OU) ; entre groupes, elle doit
// satisfaire TOUS les groupes actifs (ET). Ex : "À livrer" + "Vendues" =
// commandes vendues pas encore livrées.
type FilterKey =
  | "a_livrer" | "livree"
  | "a_recuperer" | "recuperee"
  | "vendu" | "donne"
  | "site" | "admin" | "sur_commande";

const FILTER_GROUPS: { label: string; options: { key: FilterKey; label: string }[] }[] = [
  { label: "Livraison", options: [{ key: "a_livrer", label: "À livrer" }, { key: "livree", label: "Livrées" }] },
  { label: "Bouteille", options: [{ key: "a_recuperer", label: "À récupérer" }, { key: "recuperee", label: "Récupérées" }] },
  { label: "Type", options: [{ key: "vendu", label: "Vendues" }, { key: "donne", label: "Offertes" }] },
  {
    label: "Origine",
    options: [
      { key: "site", label: "Site" },
      { key: "admin", label: "Saisie manuelle" },
      { key: "sur_commande", label: "Sur commande" },
    ],
  },
];

// Une bouteille ne peut être "à récupérer" (ou "récupérée") qu'une fois la
// commande livrée : avant livraison, le statut bouteille n'a pas de sens.
function effectivePickup(order: Pick<Order, "delivery_status" | "pickup_status">) {
  return order.delivery_status === "livree" ? order.pickup_status : null;
}

function matchesKey(order: Order, key: FilterKey): boolean {
  switch (key) {
    case "a_livrer":
    case "livree":
      return order.delivery_status === key;
    case "a_recuperer":
    case "recuperee":
      return effectivePickup(order) === key;
    case "vendu":
    case "donne":
      return order.order_type === key;
    case "site":
    case "admin":
    case "sur_commande":
      return order.created_by === key;
  }
}

function customerKey(name: string): string {
  return name.trim().toLowerCase();
}

export default function AdminVentesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [formRecipeId, setFormRecipeId] = useState<string>("");
  const [formRecipeName, setFormRecipeName] = useState("");
  const [formQuantity, setFormQuantity] = useState(1);
  const [formCustomerName, setFormCustomerName] = useState("");
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formType, setFormType] = useState<"vendu" | "donne">("vendu");
  const [formAmount, setFormAmount] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<EditableFields | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set());
  // Clients cochés (plusieurs possibles) ; vide = tous les clients.
  const [customerFilter, setCustomerFilter] = useState<Set<string>>(new Set());
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  function toggleCustomer(key: string) {
    setCustomerFilter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleFilter(key: FilterKey) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function resetFilters() {
    setActiveFilters(new Set());
    setCustomerFilter(new Set());
  }

  async function loadAll() {
    setLoading(true);
    const [ordersRes, recipesRes] = await Promise.all([
      fetch("/api/admin/orders"),
      fetch("/api/admin/recipes"),
    ]);
    const ordersData = await ordersRes.json();
    const recipesData = await recipesRes.json();
    if (ordersRes.ok) setOrders(ordersData.orders);
    if (recipesRes.ok) setRecipes(recipesData.recipes);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const recipeName = formRecipeId
      ? recipes.find((r) => r.id === formRecipeId)?.name ?? formRecipeName
      : formRecipeName;

    if (!recipeName.trim()) {
      setError("Choisis une recette ou saisis un nom de recette.");
      return;
    }

    const res = await fetch("/api/admin/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipeId: formRecipeId || null,
        recipeName,
        quantity: formQuantity,
        customerName: formCustomerName,
        createdAt: formDate,
        orderType: formType,
        unitAmount: formType === "vendu" && formAmount !== "" ? Number(formAmount) : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Erreur lors de la création.");
      return;
    }

    setFormRecipeId("");
    setFormRecipeName("");
    setFormQuantity(1);
    setFormCustomerName("");
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormType("vendu");
    setFormAmount("");
    setShowForm(false);
    loadAll();
  }

  function startEditing(order: Order) {
    setEditingId(order.id);
    setEditFields({
      recipeName: order.recipe_name_snapshot,
      quantity: order.quantity,
      customerName: order.customer_name,
      createdAt: toDateInputValue(order.created_at),
      orderType: order.order_type,
      unitAmount: order.unit_amount,
      deliveryStatus: order.delivery_status,
      pickupStatus: order.pickup_status,
    });
  }

  async function handleSaveEdit(orderId: string) {
    if (!editFields) return;
    setBusyId(orderId);
    await fetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipeName: editFields.recipeName,
        quantity: editFields.quantity,
        customerName: editFields.customerName,
        createdAt: editFields.createdAt,
        orderType: editFields.orderType,
        unitAmount: editFields.orderType === "donne" ? null : editFields.unitAmount,
        deliveryStatus: editFields.deliveryStatus,
        pickupStatus: editFields.pickupStatus,
      }),
    });
    setEditingId(null);
    setEditFields(null);
    await loadAll();
    setBusyId(null);
  }

  async function handleDelete(orderId: string) {
    const confirmed = window.confirm("Supprimer définitivement cette commande ? Cette action est irréversible.");
    if (!confirmed) return;
    setBusyId(orderId);
    await fetch(`/api/admin/orders/${orderId}`, { method: "DELETE" });
    await loadAll();
    setBusyId(null);
  }

  function matchesFilters(order: Order): boolean {
    if (customerFilter.size > 0 && !customerFilter.has(customerKey(order.customer_name))) return false;
    return FILTER_GROUPS.every((group) => {
      const active = group.options.filter((o) => activeFilters.has(o.key));
      return active.length === 0 || active.some((o) => matchesKey(order, o.key));
    });
  }

  // Liste des clients (sans doublons, insensible à la casse) pour le filtre.
  const customers = Array.from(
    new Map(orders.map((o): [string, string] => [customerKey(o.customer_name), o.customer_name.trim()])).entries()
  ).sort((a, b) => a[1].localeCompare(b[1], "fr"));

  const filtersActive = activeFilters.size > 0 || customerFilter.size > 0;

  // Tri par date de la commande (la plus récente d'abord par défaut).
  const visibleOrders = orders
    .filter(matchesFilters)
    .sort((a, b) => {
      const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return sortOrder === "desc" ? diff : -diff;
    });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Ventes</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground"
        >
          {showForm ? "Annuler" : "+ Commande manuelle"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-3 rounded-xl border border-border bg-white/60 p-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Recette</label>
            <select
              value={formRecipeId}
              onChange={(e) => setFormRecipeId(e.target.value)}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
            >
              <option value="">-- Recette hors catalogue (saisie libre) --</option>
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          {!formRecipeId && (
            <div>
              <label className="mb-1 block text-sm font-medium">Nom de la recette</label>
              <input
                value={formRecipeName}
                onChange={(e) => setFormRecipeName(e.target.value)}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
              />
            </div>
          )}

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium">Quantité</label>
              <input
                type="number"
                min={1}
                value={formQuantity}
                onChange={(e) => setFormQuantity(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium">Date</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Client</label>
            <input
              value={formCustomerName}
              onChange={(e) => setFormCustomerName(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium">Type</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as "vendu" | "donne")}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
              >
                <option value="vendu">Vendu</option>
                <option value="donne">Offert</option>
              </select>
            </div>
            {formType === "vendu" && (
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium">Montant encaissé (EUR)</label>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          <button className="w-full rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground">
            Ajouter la commande
          </button>
        </form>
      )}

      <PendingCustomOrders recipes={recipes} onHonored={loadAll} />

      {orders.length > 0 && (
        <div className="space-y-3 rounded-xl border border-border bg-white/60 p-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Trier par date"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "desc" | "asc")}
              className="rounded-lg border border-border bg-white px-2 py-1.5"
            >
              <option value="desc">Plus récentes d&apos;abord</option>
              <option value="asc">Plus anciennes d&apos;abord</option>
            </select>
            <button
              type="button"
              onClick={() => setShowCustomerPicker((v) => !v)}
              aria-expanded={showCustomerPicker}
              className={`min-w-0 flex-1 truncate rounded-lg border px-2 py-1.5 text-left ${
                customerFilter.size > 0 ? "border-accent bg-accent/10" : "border-border bg-white"
              }`}
            >
              {customerFilter.size === 0
                ? "Tous les clients"
                : `${customerFilter.size} client${customerFilter.size > 1 ? "s" : ""} sélectionné${customerFilter.size > 1 ? "s" : ""}`}{" "}
              {showCustomerPicker ? "▴" : "▾"}
            </button>
          </div>

          {showCustomerPicker && (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-white p-2">
              {customers.map(([key, name]) => (
                <label key={key} className="flex items-center gap-2 py-1">
                  <input type="checkbox" checked={customerFilter.has(key)} onChange={() => toggleCustomer(key)} />
                  <span className="min-w-0 truncate">{name}</span>
                </label>
              ))}
            </div>
          )}

          {FILTER_GROUPS.map((group) => (
            <div key={group.label} className="flex flex-wrap items-center gap-1.5">
              <span className="w-16 shrink-0 text-muted">{group.label}</span>
              {group.options.map((option) => {
                const on = activeFilters.has(option.key);
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => toggleFilter(option.key)}
                    aria-pressed={on}
                    className={`rounded-full border px-2.5 py-1 ${
                      on ? "border-accent bg-accent text-accent-foreground" : "border-border bg-white"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          ))}

          <div className="flex items-center justify-between text-muted">
            <span>
              {visibleOrders.length} commande{visibleOrders.length > 1 ? "s" : ""} ·{" "}
              {visibleOrders.reduce((sum, o) => sum + o.quantity, 0)} bouteille
              {visibleOrders.reduce((sum, o) => sum + o.quantity, 0) > 1 ? "s" : ""}
            </span>
            {filtersActive && (
              <button type="button" onClick={resetFilters} className="underline">
                Effacer les filtres
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted">Chargement...</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-muted">Aucune commande enregistrée pour le moment.</p>
      ) : visibleOrders.length === 0 ? (
        <p className="text-sm text-muted">Aucune commande ne correspond à ces filtres.</p>
      ) : (
        <div className="space-y-3">
          {visibleOrders.map((order) => (
            <div key={order.id} className="rounded-xl border border-border bg-white/60 p-4">
              {editingId === order.id && editFields ? (
                <div className="space-y-2">
                  <input
                    value={editFields.recipeName}
                    onChange={(e) => setEditFields({ ...editFields, recipeName: e.target.value })}
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      value={editFields.quantity}
                      onChange={(e) => setEditFields({ ...editFields, quantity: Number(e.target.value) })}
                      className="w-20 rounded-lg border border-border bg-white px-2 py-2 text-sm"
                    />
                    <input
                      value={editFields.customerName}
                      onChange={(e) => setEditFields({ ...editFields, customerName: e.target.value })}
                      className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm"
                    />
                    <input
                      type="date"
                      value={editFields.createdAt}
                      onChange={(e) => setEditFields({ ...editFields, createdAt: e.target.value })}
                      className="rounded-lg border border-border bg-white px-2 py-2 text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={editFields.orderType}
                      onChange={(e) =>
                        setEditFields({ ...editFields, orderType: e.target.value as "vendu" | "donne" })
                      }
                      className="rounded-lg border border-border bg-white px-2 py-2 text-sm"
                    >
                      <option value="vendu">Vendu</option>
                      <option value="donne">Offert</option>
                    </select>
                    {editFields.orderType === "vendu" && (
                      <input
                        type="number"
                        min={0}
                        step="0.5"
                        placeholder="Montant (EUR)"
                        value={editFields.unitAmount ?? ""}
                        onChange={(e) =>
                          setEditFields({
                            ...editFields,
                            unitAmount: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        className="flex-1 rounded-lg border border-border bg-white px-2 py-2 text-sm"
                      />
                    )}
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={editFields.deliveryStatus}
                      onChange={(e) => {
                        const deliveryStatus = e.target.value as "a_livrer" | "livree";
                        // Repasser en "à livrer" remet le statut bouteille à zéro.
                        setEditFields({
                          ...editFields,
                          deliveryStatus,
                          pickupStatus: deliveryStatus === "a_livrer" ? "a_recuperer" : editFields.pickupStatus,
                        });
                      }}
                      className="flex-1 rounded-lg border border-border bg-white px-2 py-2 text-sm"
                    >
                      <option value="a_livrer">À livrer</option>
                      <option value="livree">Livrée</option>
                    </select>
                    {editFields.deliveryStatus === "livree" ? (
                      <select
                        value={editFields.pickupStatus}
                        onChange={(e) =>
                          setEditFields({ ...editFields, pickupStatus: e.target.value as "a_recuperer" | "recuperee" })
                        }
                        className="flex-1 rounded-lg border border-border bg-white px-2 py-2 text-sm"
                      >
                        <option value="a_recuperer">Bouteille à récupérer</option>
                        <option value="recuperee">Bouteille récupérée</option>
                      </select>
                    ) : (
                      <span className="flex flex-1 items-center px-2 text-xs text-muted">
                        Bouteille : après livraison
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveEdit(order.id)}
                      disabled={busyId === order.id}
                      className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50"
                    >
                      Enregistrer
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditFields(null);
                      }}
                      className="rounded-full border border-border px-3 py-1.5 text-xs"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {order.recipe_name_snapshot} x{order.quantity}
                    </p>
                    <p className="text-sm text-muted">
                      {order.customer_name} · {formatDate(order.created_at)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {order.order_type === "vendu"
                        ? `Vendu${order.unit_amount ? ` · ${order.unit_amount} EUR` : ""}`
                        : "Offert"}
                      {" · "}
                      {order.created_by === "site"
                        ? "commande site"
                        : order.created_by === "sur_commande"
                          ? "sur commande"
                          : "saisie manuelle"}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] ${
                          order.delivery_status === "livree"
                            ? "bg-accent/20 text-accent"
                            : "bg-muted/20 text-muted"
                        }`}
                      >
                        {order.delivery_status === "livree" ? "Livrée" : "À livrer"}
                      </span>
                      {effectivePickup(order) && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] ${
                            effectivePickup(order) === "recuperee"
                              ? "bg-accent/20 text-accent"
                              : "bg-muted/20 text-muted"
                          }`}
                        >
                          {effectivePickup(order) === "recuperee" ? "Bouteille récupérée" : "Bouteille à récupérer"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => startEditing(order)}
                      className="rounded-full border border-border px-3 py-1.5 text-xs"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => handleDelete(order.id)}
                      disabled={busyId === order.id}
                      className="rounded-full border border-danger px-3 py-1.5 text-xs text-danger disabled:opacity-50"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
