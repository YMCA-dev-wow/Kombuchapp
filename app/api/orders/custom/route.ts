import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { notify } from "@/lib/notifications";

// Depot d'une demande "sur commande" (recette precise, quantite, date
// souhaitee). Reste en statut "en_attente" jusqu'a validation manuelle
// par le producteur dans l'espace admin.
export async function POST(request: NextRequest) {
  let body: {
    recipeName?: string;
    details?: string;
    quantity?: number;
    desiredDate?: string;
    customerName?: string;
    customerEmail?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requete invalide." }, { status: 400 });
  }

  const { recipeName, details, quantity, desiredDate, customerName, customerEmail } = body;

  if (!recipeName?.trim() || !quantity || quantity <= 0 || !customerName?.trim()) {
    return NextResponse.json(
      { error: "Champs manquants : recipeName, quantity (> 0) et customerName sont requis." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("custom_orders")
    .insert({
      recipe_name: recipeName.trim(),
      details: details?.trim() || "",
      quantity,
      desired_date: desiredDate || null,
      customer_name: customerName.trim(),
      customer_email: customerEmail?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    console.error("[api/orders/custom] erreur:", error);
    return NextResponse.json({ error: "Une erreur est survenue, reessaie." }, { status: 500 });
  }

  await notify({
    type: "nouvelle_demande_sur_commande",
    recipeName: data.recipe_name,
    quantity: data.quantity,
    desiredDate: data.desired_date,
    customerName: data.customer_name,
    customerEmail: data.customer_email,
  });

  return NextResponse.json({ customOrder: data }, { status: 201 });
}
