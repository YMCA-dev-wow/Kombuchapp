"use client";

import { useState } from "react";
import type { Recipe } from "@/lib/types";

export function RecipeCard({
  recipe,
  onOrder,
}: {
  recipe: Recipe;
  onOrder: (recipe: Recipe) => void;
}) {
  const enRupture = recipe.quantity <= 0;
  const [expanded, setExpanded] = useState(false);
  const hasDescription = Boolean(recipe.description);

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-white/60 p-4 shadow-sm">
      <div
        className={`min-w-0${hasDescription ? " cursor-pointer" : ""}`}
        onClick={hasDescription ? () => setExpanded((v) => !v) : undefined}
      >
        <h3 className="font-medium">{recipe.name}</h3>
        {recipe.description && (
          <p className={`mt-0.5 text-sm text-muted${expanded ? "" : " line-clamp-2"}`}>
            {recipe.description}
          </p>
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
