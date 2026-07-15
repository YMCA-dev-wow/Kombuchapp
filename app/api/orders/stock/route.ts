import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { notify } from "@/lib/notifications";

// Commande d'une bouteille deja en stock. Passe par la fonction Postgres
// `create_stock_order` (voir supabase/migrations/0001_init.sql) qui gere
// la decrementation ATOMIQUE du stock : si 2 personnes commandent la
// derniere bouteille en meme temps, une seule requete reussit, l'autre
// recoit l'erreur "stock_insuffisant".
export async function POST(request: NextRequest) {
  let body: {
    recipeId?: string;
    quantity?: number;
    customerName?: string;
    customerEmail?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requete invalide." }, { status: 400 });
  }

  const { recipeId, quantity, customerName, customerEmail } = body;

  if (!recipeId || !quantity || quantity <= 0 || !customerName?.trim()) {
    return NextResponse.json(
      { error: "Champs manquants : recipeId, quantity (> 0) et customerName sont requis." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin.rpc("create_stock_order", {
    p_recipe_id: recipeId,
    p_quantity: quantity,
    p_customer_name: customerName.trim(),
    p_customer_email: customerEmail?.trim() || null,
  });

  if (error) {
    if (error.message.includes("stock_insuffisant")) {
      return NextResponse.json(
        { error: "Desole, il n'y a plus assez de stock disponible pour cette quantite." },
        { status: 409 }
      );
    }
    console.error("[api/orders/stock] erreur:", error);
    return NextResponse.json({ error: "Une erreur est survenue, reessaie." }, { status: 500 });
  }

  await notify({
    type: "nouvelle_commande_stock",
    recipeName: data.recipe_name_snapshot,
    quantity: data.quantity,
    customerName: data.customer_name,
    customerEmail: data.customer_email,
  });

  return NextResponse.json({ order: data }, { status: 201 });
}
