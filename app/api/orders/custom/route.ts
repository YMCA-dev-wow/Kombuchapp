import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { notify } from "@/lib/notifications";

// Nombre maximum de goûts différents dans une même demande.
const MAX_LINES = 10;

// Dépôt d'une demande "sur commande" (recette précisée, quantité, date
// souhaitée). Reste en statut "en_attente" jusqu'à validation manuelle
// par le producteur dans l'espace admin.
//
// Une demande peut porter sur plusieurs goûts (`items`) : une ligne
// `custom_orders` est créée par goût (mêmes client, date et précisions), et
// un seul email récapitule l'ensemble. L'ancien format (recipeName +
// quantity) reste accepté.
export async function POST(request: NextRequest) {
  let body: {
    items?: { recipeName?: string; quantity?: number }[];
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
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const { details, desiredDate, customerName, customerEmail } = body;
  const rawLines = Array.isArray(body.items) ? body.items : [{ recipeName: body.recipeName, quantity: body.quantity }];

  if (!customerName?.trim() || rawLines.length === 0) {
    return NextResponse.json(
      { error: "Champs manquants : au moins un goût avec sa quantité, et customerName sont requis." },
      { status: 400 }
    );
  }
  if (rawLines.length > MAX_LINES) {
    return NextResponse.json({ error: `Maximum ${MAX_LINES} goûts par demande.` }, { status: 400 });
  }

  const lines: { recipeName: string; quantity: number }[] = [];
  for (const line of rawLines) {
    const recipeName = line.recipeName?.trim() ?? "";
    const quantity = Number(line.quantity);
    if (!recipeName || !Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: "Chaque ligne doit avoir un goût et une quantité (nombre entier > 0)." },
        { status: 400 }
      );
    }
    lines.push({ recipeName, quantity });
  }

  const { data, error } = await supabaseAdmin
    .from("custom_orders")
    .insert(
      lines.map((line) => ({
        recipe_name: line.recipeName,
        details: details?.trim() || "",
        quantity: line.quantity,
        desired_date: desiredDate || null,
        customer_name: customerName.trim(),
        customer_email: customerEmail?.trim() || null,
      }))
    )
    .select();

  if (error || !data || data.length === 0) {
    console.error("[api/orders/custom] erreur:", error);
    return NextResponse.json({ error: "Une erreur est survenue, réessaie." }, { status: 500 });
  }

  await notify({
    type: "nouvelle_demande_sur_commande",
    recipeName: data[0].recipe_name,
    quantity: data[0].quantity,
    items: data.map((row) => ({ recipeName: row.recipe_name, quantity: row.quantity })),
    desiredDate: data[0].desired_date,
    customerName: data[0].customer_name,
    customerEmail: data[0].customer_email,
  });

  return NextResponse.json({ customOrders: data }, { status: 201 });
}
