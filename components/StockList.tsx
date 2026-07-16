"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Recipe } from "@/lib/types";
import { RecipeCard } from "@/components/RecipeCard";
import { OrderModal } from "@/components/OrderModal";

type SortOption = "alpha" | "stock-desc" | "stock-asc";

const SORT_LABELS: Record<SortOption, string> = {
  alpha: "Alphabetique (A -> Z)",
  "stock-desc": "Stock decroissant",
  "stock-asc": "Stock croissant",
};

// Affiche le stock des recettes actives et le tient a jour EN TEMPS REEL
// grace a Supabase Realtime : des qu'une commande decremente le stock
// (ou qu'un reappro l'augmente), tous les navigateurs ouverts sur la
// boutique voient la quantite se mettre a jour automatiquement.
export function StockList() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("alpha");

  async function loadRecipes() {
    const { data, error } = await supabase
      .from("recipes")
      .select("*")
      .eq("active", true)
      .order("name", { ascending: true });

    if (!error && data) {
      setRecipes(data as Recipe[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    // Chargement initial des donnees au montage : cas d'usage explicitement
    // recommande par React (fetch au mount), la regle react-hooks/set-state-in-effect
    // vise d'autres anti-patterns (etat derive), pas celui-ci.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRecipes();

    const channel = supabase
      .channel("recipes-stock")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recipes" },
        () => {
          loadRecipes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const inStock = useMemo(() => {
    const list = recipes.filter((r) => r.quantity > 0);
    return [...list].sort((a, b) => {
      if (sortBy === "alpha") return a.name.localeCompare(b.name, "fr");
      if (sortBy === "stock-desc") return b.quantity - a.quantity || a.name.localeCompare(b.name, "fr");
      return a.quantity - b.quantity || a.name.localeCompare(b.name, "fr");
    });
  }, [recipes, sortBy]);

  const outOfStock = useMemo(() => {
    return recipes
      .filter((r) => r.quantity <= 0)
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [recipes]);

  if (loading) {
    return <p className="text-sm text-muted">Chargement du stock...</p>;
  }

  if (recipes.length === 0) {
    return <p className="text-sm text-muted">Aucun kombucha disponible pour le moment.</p>;
  }

  return (
    <div className="space-y-4">
      {inStock.length > 0 && (
        <div className="flex items-center justify-end gap-2 text-xs text-muted">
          <label htmlFor="sort-recipes">Trier par</label>
          <select
            id="sort-recipes"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="rounded-lg border border-border bg-white px-2 py-1 text-xs"
          >
            {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
              <option key={option} value={option}>
                {SORT_LABELS[option]}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-3">
        {inStock.length === 0 ? (
          <p className="text-sm text-muted">Tout est en rupture de stock pour le moment.</p>
        ) : (
          inStock.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} onOrder={setSelected} />
          ))
        )}
      </div>

      {outOfStock.length > 0 && (
        <details className="rounded-xl border border-border bg-white/60 p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Gouts en rupture de stock ({outOfStock.length})
          </summary>
          <div className="mt-3 space-y-3">
            {outOfStock.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} onOrder={setSelected} />
            ))}
          </div>
        </details>
      )}

      {selected && (
        <OrderModal
          recipe={selected}
          onClose={() => setSelected(null)}
          onSuccess={loadRecipes}
        />
      )}
    </div>
  );
}
