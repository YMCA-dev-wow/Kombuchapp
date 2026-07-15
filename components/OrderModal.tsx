"use client";

import { useState } from "react";
import type { Recipe } from "@/lib/types";

export function OrderModal({
  recipe,
  onClose,
  onSuccess,
}: {
  recipe: Recipe;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/orders/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeId: recipe.id,
          quantity,
          customerName,
          customerEmail: customerEmail || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Une erreur est survenue.");
        return;
      }
      setSuccess(true);
      onSuccess();
    } catch {
      setError("Impossible de contacter le serveur. Verifie ta connexion.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-background p-5 shadow-xl sm:rounded-2xl">
        {success ? (
          <div className="py-6 text-center">
            <p className="text-lg font-medium">Commande confirmee !</p>
            <p className="mt-1 text-sm text-muted">Merci {customerName}, ta commande de {quantity} x {recipe.name} est enregistree.</p>
            <button
              onClick={onClose}
              className="mt-5 w-full rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
            >
              Fermer
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{recipe.name}</h2>
              <button type="button" onClick={onClose} aria-label="Fermer" className="text-muted">
                ✕
              </button>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Quantite</label>
              <input
                type="number"
                min={1}
                max={recipe.quantity}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                required
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-muted">{recipe.quantity} disponible(s)</p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Ton prenom / nom</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Email (optionnel)</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
              />
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-60"
            >
              {loading ? "Envoi..." : "Confirmer la commande"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
