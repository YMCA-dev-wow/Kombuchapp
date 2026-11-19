"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { RecipeNameSelect } from "@/components/RecipeNameSelect";

// Une ligne = un goût + sa quantité. L'id sert de clé React stable (le menu
// de chaque ligne garde son propre état « Autre »).
type Line = { id: number; recipeName: string; quantity: number };
// Doit rester aligné avec la limite de l'API /api/orders/custom.
const MAX_LINES = 10;

export default function SurCommandePage() {
  const [lines, setLines] = useState<Line[]>([{ id: 1, recipeName: "", quantity: 1 }]);
  const [nextLineId, setNextLineId] = useState(2);

  function updateLine(id: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { id: nextLineId, recipeName: "", quantity: 1 }]);
    setNextLineId((n) => n + 1);
  }

  function removeLine(id: number) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  // Goûts du catalogue proposés dans le menu (même en rupture : on peut
  // commander un goût qui n'est plus en stock).
  const [recipeNames, setRecipeNames] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("recipes").select("name").eq("active", true).order("name");
      if (data) setRecipeNames(data.map((r) => r.name as string));
    })();
  }, []);
  const [details, setDetails] = useState("");
  const [desiredDate, setDesiredDate] = useState("");
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
      const res = await fetch("/api/orders/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({ recipeName: l.recipeName, quantity: l.quantity })),
          details,
          desiredDate: desiredDate || undefined,
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
    } catch {
      setError("Impossible de contacter le serveur. Vérifie ta connexion.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="py-10 text-center">
        <p className="text-lg font-medium">Demande envoyée !</p>
        <p className="mt-1 text-sm text-muted">
          Le producteur va étudier ta demande et te recontacter pour la valider.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Sur commande</h1>
      <p className="mb-5 text-sm text-muted">
        Une recette précise en tête, une quantité ou une date particulière ? Fais ta demande,
        elle sera validée manuellement.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium">Recette souhaitée et quantité</label>
          {lines.map((line, index) => (
            <div key={line.id} className="space-y-2 rounded-lg border border-border bg-white/60 p-3">
              <RecipeNameSelect
                ariaLabel={`Goût ${index + 1}`}
                value={line.recipeName}
                onChange={(name) => updateLine(line.id, { recipeName: name })}
                names={recipeNames}
                required
                otherPlaceholder="Ex : Kombucha Fraise-Basilic"
              />
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted" htmlFor={`quantite-${line.id}`}>
                  Quantité
                </label>
                <input
                  id={`quantite-${line.id}`}
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(e) => updateLine(line.id, { quantity: Number(e.target.value) })}
                  required
                  className="w-24 rounded-lg border border-border bg-white px-3 py-2 text-sm"
                />
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(line.id)}
                    className="ml-auto text-xs text-muted underline"
                  >
                    Retirer ce goût
                  </button>
                )}
              </div>
            </div>
          ))}
          {lines.length < MAX_LINES && (
            <button
              type="button"
              onClick={addLine}
              className="w-full rounded-full border border-border bg-white px-4 py-2 text-sm"
            >
              + Ajouter un autre goût
            </button>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Détails (optionnel)</label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Date souhaitée (optionnel)</label>
          <input
            type="date"
            value={desiredDate}
            onChange={(e) => setDesiredDate(e.target.value)}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Ton prénom / nom</label>
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
          {loading ? "Envoi..." : "Envoyer la demande"}
        </button>
      </form>
    </div>
  );
}
