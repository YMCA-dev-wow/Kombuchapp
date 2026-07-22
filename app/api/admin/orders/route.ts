import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Ledger complet des commandes de stock (celles passees via la boutique
// + celles ajoutees manuellement par le producteur pour des ventes hors
// site, ex: remises en main propre).

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ orders: data });
}

export async function POST(request: NextRequest) {
  let body: {
    recipeId?: string | null;
    recipeName?: string;
    quantity?: number;
    customerName?: string;
    createdAt?: string;
    orderType?: "vendu" | "donne";
    unitAmount?: number | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requete invalide." }, { status: 400 });
  }

  const { recipeId, recipeName, quantity, customerName, createdAt, orderType, unitAmount } = body;

  if (!recipeName?.trim() || !quantity || quantity <= 0 || !customerName?.trim()) {
    return NextResponse.json(
      { error: "Champs manquants : recipeName, quantity (> 0) et customerName sont requis." },
      { status: 400 }
    );
  }

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .insert({
      recipe_id: recipeId || null,
      recipe_name_snapshot: recipeName.trim(),
      quantity,
      customer_name: customerName.trim(),
      created_at: createdAt ? new Date(createdAt).toISOString() : new Date().toISOString(),
      order_type: orderType === "donne" ? "donne" : "vendu",
      unit_amount: orderType === "donne" ? null : unitAmount ?? null,
      created_by: "admin",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Si la ligne est rattachee a une recette existante, on decremente son
  // stock pour rester coherent (best-effort : on ne bloque pas si le
  // stock devient negatif, ca reste visible et corrigeable par le
  // producteur -- contrairement a la commande boutique, il n'y a pas de
  // verification atomique ici car c'est une saisie manuelle de confiance).
  if (recipeId) {
    const { data: recipe } = await supabaseAdmin
      .from("recipes")
      .select("quantity")
      .eq("id", recipeId)
      .single();
    if (recipe) {
      await supabaseAdmin
        .from("recipes")
        .update({ quantity: Math.max(0, recipe.quantity - quantity) })
        .eq("id", recipeId);
    }
  }

  return NextResponse.json({ order }, { status: 201 });
}
