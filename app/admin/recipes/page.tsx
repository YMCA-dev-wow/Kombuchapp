"use client";

import { useEffect, useState } from "react";
import type { Recipe } from "@/lib/types";

export default function AdminRecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [restockAmounts, setRestockAmounts] = useState<Record<string, number>>({});
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [defaultRestockQuantity, setDefaultRestockQuantity] = useState(6);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  async function loadRecipes() {
    setLoading(true);
    const res = await fetch("/api/admin/recipes");
    const data = await res.json();
    if (res.ok) setRecipes(data.recipes);
    setLoading(false);
  }

  useEffect(() => {
    // Chargement initial des donnees au montage : cas d'usage explicitement
    // recommande par React (fetch au mount), la regle react-hooks/set-state-in-effect
    // vise d'autres anti-patterns (etat derive), pas celui-ci.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRecipes();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, quantity, defaultRestockQuantity }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Erreur lors de la creation.");
      return;
    }
    setName("");
    setDescription("");
    setQuantity(0);
    setDefaultRestockQuantity(6);
    setShowForm(false);
    loadRecipes();
  }

  function getRestockAmount(recipe: Recipe): number {
    return restockAmounts[recipe.id] ?? recipe.default_restock_quantity;
  }

  async function handleRestock(recipe: Recipe) {
    const amount = getRestockAmount(recipe);
    if (!amount || amount <= 0) return;

    setBusyId(recipe.id);
    await fetch(`/api/admin/recipes/${recipe.id}/restock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: amount }),
    });
    await loadRecipes();
    setBusyId(null);
  }

  async function handleToggleActive(recipe: Recipe) {
    setBusyId(recipe.id);
    await fetch(`/api/admin/recipes/${recipe.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !recipe.active }),
    });
    await loadRecipes();
    setBusyId(null);
  }

  function startEditing(recipe: Recipe) {
    setEditingId(recipe.id);
    setEditName(recipe.name);
    setEditDescription(recipe.description);
  }

  async function handleSaveEdit(recipe: Recipe) {
    setBusyId(recipe.id);
    await fetch(`/api/admin/recipes/${recipe.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, description: editDescription }),
    });
    setEditingId(null);
    await loadRecipes();
    setBusyId(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Recettes</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground"
        >
          {showForm ? "Annuler" : "+ Nouvelle recette"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-3 rounded-xl border border-border bg-white/60 p-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Nom</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium">Stock initial</label>
              <input
                type="number"
                min={0}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium">Reappro par defaut</label>
              <input
                type="number"
                min={1}
                value={defaultRestockQuantity}
                onChange={(e) => setDefaultRestockQuantity(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button className="w-full rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground">
            Creer la recette
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-muted">Chargement...</p>
      ) : (
        <div className="space-y-3">
          {recipes.map((recipe) => (
            <div
              key={recipe.id}
              className="rounded-xl border border-border bg-white/60 p-4"
            >
              {editingId === recipe.id ? (
                <div className="space-y-2">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                  />
                  <input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Description"
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveEdit(recipe)}
                      disabled={busyId === recipe.id}
                      className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50"
                    >
                      Enregistrer
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-full border border-border px-3 py-1.5 text-xs"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <button onClick={() => startEditing(recipe)} className="text-left">
                    <p className="font-medium underline decoration-dotted">{recipe.name}</p>
                    {recipe.description && (
                      <p className="text-xs text-muted">{recipe.description}</p>
                    )}
                    <p className="mt-0.5 text-xs text-muted">
                      {recipe.quantity} en stock · reappro +{recipe.default_restock_quantity} ·{" "}
                      {recipe.active ? "visible" : "masquee"}
                    </p>
                  </button>
                </div>
              )}

              {editingId !== recipe.id && (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={getRestockAmount(recipe)}
                    onChange={(e) =>
                      setRestockAmounts((prev) => ({
                        ...prev,
                        [recipe.id]: Number(e.target.value),
                      }))
                    }
                    aria-label={`Quantite a reapprovisionner pour ${recipe.name}`}
                    className="w-16 rounded-lg border border-border bg-white px-2 py-1.5 text-xs"
                  />
                  <button
                    onClick={() => handleRestock(recipe)}
                    disabled={busyId === recipe.id}
                    className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50"
                  >
                    Remettre en stock
                  </button>
                  <button
                    onClick={() => handleToggleActive(recipe)}
                    disabled={busyId === recipe.id}
                    className="rounded-full border border-border px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    {recipe.active ? "Masquer" : "Activer"}
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
