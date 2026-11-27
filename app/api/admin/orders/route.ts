import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Ledger complet des commandes de stock (celles passées via la boutique
// + celles ajoutées manuellement par le producteur pour des ventes hors
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
    deliveryDate?: string | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const { recipeId, recipeName, quantity, customerName, createdAt, orderType, unitAmount, deliveryDate } = body;

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
      delivery_date: deliveryDate && /^\d{4}-\d{2}-\d{2}$/.test(deliveryDate) ? deliveryDate : null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Une saisie manuelle ne touche JAMAIS au stock : les commandes prises dans
  // le stock passent par la boutique (décrémentation atomique anti-survente).
  // La recette sert uniquement à rattacher la vente au goût du catalogue.

  return NextResponse.json({ order }, { status: 201 });
}
