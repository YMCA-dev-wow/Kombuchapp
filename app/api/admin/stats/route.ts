import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Statistiques de ventes pour l'onglet "Suivi" de l'espace producteur.
// Se base sur la table `orders` (commandes de stock confirmees). Les
// commandes personnalisees ("sur commande") ne sont pas comptabilisees
// ici car elles ne sont pas toujours rattachees a une recette existante.

function getISOWeekLabel(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-S${String(weekNo).padStart(2, "0")}`;
}

function getMonthLabel(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

type Row = { recipe_name_snapshot: string; quantity: number; created_at: string };

function aggregateByPeriod(rows: Row[], labelFn: (d: Date) => string) {
  const periods = new Map<string, Map<string, number>>();
  const recipeNames = new Set<string>();

  for (const row of rows) {
    const label = labelFn(new Date(row.created_at));
    recipeNames.add(row.recipe_name_snapshot);
    if (!periods.has(label)) periods.set(label, new Map());
    const perRecipe = periods.get(label)!;
    perRecipe.set(row.recipe_name_snapshot, (perRecipe.get(row.recipe_name_snapshot) ?? 0) + row.quantity);
  }

  const sortedLabels = Array.from(periods.keys()).sort();
  const series = sortedLabels.map((label) => {
    const perRecipe = periods.get(label)!;
    const entry: Record<string, string | number> = { period: label };
    let total = 0;
    for (const name of recipeNames) {
      const qty = perRecipe.get(name) ?? 0;
      entry[name] = qty;
      total += qty;
    }
    entry.Total = total;
    return entry;
  });

  return { series, recipeNames: Array.from(recipeNames) };
}

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("recipe_name_snapshot, quantity, created_at")
    .eq("status", "confirmee")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Row[];

  const totalsMap = new Map<string, number>();
  for (const row of rows) {
    totalsMap.set(row.recipe_name_snapshot, (totalsMap.get(row.recipe_name_snapshot) ?? 0) + row.quantity);
  }
  const totalsByRecipe = Array.from(totalsMap.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);

  const weekly = aggregateByPeriod(rows, getISOWeekLabel);
  const monthly = aggregateByPeriod(rows, getMonthLabel);

  return NextResponse.json({
    totalsByRecipe,
    weekly: weekly.series,
    monthly: monthly.series,
    recipeNames: Array.from(new Set([...weekly.recipeNames, ...monthly.recipeNames])),
  });
}
