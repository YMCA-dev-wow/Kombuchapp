"use client";

import type { Recipe } from "@/lib/types";

export function RecipeCard({
  recipe,
  onOrder,
}: {
  recipe: Recipe;
  onOrder: (recipe: Recipe) => void;
}) {
  const enRupture = recipe.quantity <= 0;

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-white/60 p-4 shadow-sm">
      <div className="min-w-0">
        <h3 className="truncate font-medium">{recipe.name}</h3>
        {recipe.description && (
          <p className="mt-0.5 line-clamp-2 text-sm text-muted">{recipe.description}</p>
        )}
        <p className="mt-1 text-xs text-muted">
          {enRupture ? "Rupture de stock" : `${recipe.quantity} bouteille${recipe.quantity > 1 ? "s" : ""} disponible${recipe.quantity > 1 ? "s" : ""}`}
        </p>
      </div>
      <button
        onClick={() => onOrder(recipe)}
        disabled={enRupture}
        className="shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        Commander
      </button>
    </div>
  );
}
