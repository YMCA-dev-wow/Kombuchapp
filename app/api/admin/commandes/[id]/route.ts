import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { notify } from "@/lib/notifications";
import { diffCustomOrder } from "@/lib/customOrderChanges";
import type { CustomOrderContent } from "@/lib/types";

// Deux usages :
// - { status: "validee" | "refusee" } : validation manuelle (par le producteur)
//   d'une commande "sur commande". Si la demande a été modifiée avant, l'email
//   de validation récapitule la différence avec la demande initiale.
// - { recipeName, quantity, desiredDate, details } : modification de la demande
//   par le producteur (après un échange avec le client), tant qu'elle est en
//   attente. La demande initiale est conservée dans `original_request`.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: {
    status?: "validee" | "refusee";
    adminNote?: string;
    recipeName?: string;
    quantity?: number;
    desiredDate?: string | null;
    details?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  if (body.status === undefined) {
    return editRequest(id, body);
  }

  if (body.status !== "validee" && body.status !== "refusee") {
    return NextResponse.json(
      { error: "status doit valoir 'validee' ou 'refusee'." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("custom_orders")
    .update({ status: body.status, admin_note: body.adminNote?.trim() || "" })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const changes =
    body.status === "validee"
      ? diffCustomOrder(data.original_request as CustomOrderContent | null, {
          recipe_name: data.recipe_name,
          quantity: data.quantity,
          desired_date: data.desired_date,
          details: data.details ?? "",
        })
      : [];

  await notify({
    type:
      body.status === "validee"
        ? "commande_personnalisee_validee"
        : "commande_personnalisee_refusee",
    recipeName: data.recipe_name,
    customerEmail: data.customer_email,
    adminNote: data.admin_note,
    changes,
    quantity: data.quantity,
    desiredDate: data.desired_date,
  });

  return NextResponse.json({ customOrder: data });
}

async function editRequest(
  id: string,
  body: { recipeName?: string; quantity?: number; desiredDate?: string | null; details?: string }
) {
  const recipeName = (body.recipeName ?? "").trim();
  const quantity = Number(body.quantity);
  const desiredDate = body.desiredDate ? body.desiredDate : null;
  const details = (body.details ?? "").trim();

  if (!recipeName) {
    return NextResponse.json({ error: "Le goût est obligatoire." }, { status: 400 });
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return NextResponse.json({ error: "La quantité doit être un nombre entier d'au moins 1." }, { status: 400 });
  }
  if (desiredDate && !/^\d{4}-\d{2}-\d{2}$/.test(desiredDate)) {
    return NextResponse.json({ error: "Date invalide." }, { status: 400 });
  }

  const { data: current, error: readError } = await supabaseAdmin
    .from("custom_orders")
    .select("*")
    .eq("id", id)
    .single();
  if (readError || !current) {
    return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
  }
  // Une demande déjà validée, refusée ou honorée ne se modifie plus : le client
  // a déjà été prévenu de ce qui avait été convenu.
  if (current.status !== "en_attente") {
    return NextResponse.json(
      { error: "Seule une demande en attente peut être modifiée." },
      { status: 409 }
    );
  }

  // La demande initiale est mémorisée une seule fois, à la première modification.
  const original: CustomOrderContent =
    (current.original_request as CustomOrderContent | null) ?? {
      recipe_name: current.recipe_name,
      quantity: current.quantity,
      desired_date: current.desired_date,
      details: current.details ?? "",
    };

  const { data, error } = await supabaseAdmin
    .from("custom_orders")
    .update({
      recipe_name: recipeName,
      quantity,
      desired_date: desiredDate,
      details,
      original_request: original,
    })
    .eq("id", id)
    .eq("status", "en_attente")
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ customOrder: data });
}
