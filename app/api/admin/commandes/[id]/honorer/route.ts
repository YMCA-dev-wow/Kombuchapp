import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { notify } from "@/lib/notifications";

// Transforme une demande "sur commande" validée en vente (onglet Ventes).
// - fromStock = true  : les bouteilles sont prises dans le stock de la
//   recette choisie (refusé si le stock est insuffisant).
// - fromStock = false : "production dédiée", le stock n'est pas touché.
// Toute la logique critique (verrou, stock, création de la vente) est
// dans la fonction Postgres honor_custom_order (migration 0005).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: {
    recipeId?: string | null;
    fromStock?: boolean;
    orderType?: "vendu" | "donne";
    unitAmount?: number | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const fromStock = body.fromStock === true;
  if (fromStock && !body.recipeId) {
    return NextResponse.json(
      { error: "Choisis la recette du catalogue dans laquelle puiser le stock." },
      { status: 400 }
    );
  }

  const { data: order, error } = await supabaseAdmin.rpc("honor_custom_order", {
    p_custom_order_id: id,
    p_recipe_id: body.recipeId || null,
    p_from_stock: fromStock,
    p_order_type: body.orderType === "donne" ? "donne" : "vendu",
    p_unit_amount: body.orderType === "donne" ? null : body.unitAmount ?? null,
  });

  if (error) {
    if (error.message.includes("stock_insuffisant")) {
      return NextResponse.json(
        { error: "Stock insuffisant pour honorer cette demande." },
        { status: 409 }
      );
    }
    if (error.message.includes("demande_non_honorable")) {
      return NextResponse.json(
        { error: "Cette demande n'est plus à honorer (déjà traitée ?)." },
        { status: 409 }
      );
    }
    console.error("[api/admin/commandes/honorer] erreur:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Email "ta commande est prête" uniquement si le client a laissé son adresse.
  await notify({
    type: "commande_sur_commande_prete",
    recipeName: order.recipe_name_snapshot,
    quantity: order.quantity,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
  });

  return NextResponse.json({ order }, { status: 201 });
}
