"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Recipe } from "@/lib/types";
import { RecipeCard } from "@/components/RecipeCard";
import { OrderModal } from "@/components/OrderModal";

// Affiche le stock des recettes actives et le tient a jour EN TEMPS REEL
// grace a Supabase Realtime : des qu'une commande decremente le stock
// (ou qu'un reappro l'augmente), tous les navigateurs ouverts sur la
// boutique voient la quantite se mettre a jour automatiquement.
export function StockList() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Recipe | null>(null);

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

  if (loading) {
    return <p className="text-sm text-muted">Chargement du stock...</p>;
  }

  if (recipes.length === 0) {
    return <p className="text-sm text-muted">Aucun kombucha disponible pour le moment.</p>;
  }

  return (
    <div className="space-y-3">
      {recipes.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} onOrder={setSelected} />
      ))}

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
