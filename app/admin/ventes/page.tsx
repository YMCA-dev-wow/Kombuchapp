"use client";

import { useEffect, useState } from "react";
import type { Order, Recipe } from "@/lib/types";

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

type StatusFilter = "toutes" | "a_livrer" | "livree" | "a_recuperer" | "recuperee" | "vendu" | "donne" | "site" | "admin";

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  toutes: "Tous les statuts",
  a_livrer: "À livrer",
  livree: "Livrées",
  a_recuperer: "À récupérer",
  recuperee: "Récupérées",
  vendu: "Vendues",
  donne: "Offertes",
  site: "Commande site",
  admin: "Saisie manuelle",
};

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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("toutes");

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

  function matchesFilter(order: Order): boolean {
    switch (statusFilter) {
      case "toutes":
        return true;
      case "a_livrer":
      case "livree":
        return order.delivery_status === statusFilter;
      case "a_recuperer":
      case "recuperee":
        return order.pickup_status === statusFilter;
      case "vendu":
      case "donne":
        return order.order_type === statusFilter;
      case "site":
      case "admin":
        return order.created_by === statusFilter;
      default:
        return true;
    }
  }

  // Ordre chronologique décroissant par défaut : l'API renvoie déjà les
  // commandes triées ainsi, on le garantit aussi côté client (utile si la
  // liste est un jour alimentée autrement).
  const visibleOrders = orders
    .filter(matchesFilter)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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

      {orders.length > 0 && (
        <div className="flex items-center justify-end gap-2 text-xs text-muted">
          <label htmlFor="filter-statut">Filtrer par</label>
          <select
            id="filter-statut"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-lg border border-border bg-white px-2 py-1 text-xs"
          >
            {(Object.keys(STATUS_FILTER_LABELS) as StatusFilter[]).map((option) => (
              <option key={option} value={option}>
                {STATUS_FILTER_LABELS[option]}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted">Chargement...</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-muted">Aucune commande enregistrée pour le moment.</p>
      ) : visibleOrders.length === 0 ? (
        <p className="text-sm text-muted">Aucune commande ne correspond à ce filtre.</p>
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
                      onChange={(e) =>
                        setEditFields({ ...editFields, deliveryStatus: e.target.value as "a_livrer" | "livree" })
                      }
                      className="flex-1 rounded-lg border border-border bg-white px-2 py-2 text-sm"
                    >
                      <option value="a_livrer">À livrer</option>
                      <option value="livree">Livrée</option>
                    </select>
                    <select
                      value={editFields.pickupStatus}
                      onChange={(e) =>
                        setEditFields({ ...editFields, pickupStatus: e.target.value as "a_recuperer" | "recuperee" })
                      }
                      className="flex-1 rounded-lg border border-border bg-white px-2 py-2 text-sm"
                    >
                      <option value="a_recuperer">À récupérer</option>
                      <option value="recuperee">Récupérée</option>
                    </select>
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
                      {order.created_by === "site" ? "commande site" : "saisie manuelle"}
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
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] ${
                          order.pickup_status === "recuperee"
                            ? "bg-accent/20 text-accent"
                            : "bg-muted/20 text-muted"
                        }`}
                      >
                        {order.pickup_status === "recuperee" ? "Récupérée" : "À récupérer"}
                      </span>
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
