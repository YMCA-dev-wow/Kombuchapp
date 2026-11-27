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
    inF2?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  // Repère « F2 » (bouteilles en seconde fermentation) : simple indicateur
  // du producteur, sans effet sur le statut de la demande.
  if (typeof body.inF2 === "boolean" && body.status === undefined && body.recipeName === undefined) {
    const { data, error } = await supabaseAdmin
      .from("custom_orders")
      .update({ in_f2: body.inF2 })
      .eq("id", id)
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ customOrder: data });
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
  body: {
    recipeName?: string;
    quantity?: number;
    desiredDate?: string | null;
    details?: string;
    customerName?: string;
  }
) {
  const recipeName = (body.recipeName ?? "").trim();
  const customerName = body.customerName?.trim();
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
  // Modifiable tant que la demande n'est ni refusée ni honorée. En attente :
  // la demande initiale est conservée pour le récapitulatif de l'email de
  // validation. Déjà validée (zone « À honorer ») : correction simple, sans
  // email (le client a déjà reçu la validation).
  if (current.status !== "en_attente" && current.status !== "validee") {
    return NextResponse.json(
      { error: "Seule une demande en attente ou validée peut être modifiée." },
      { status: 409 }
    );
  }

  // La demande initiale est mémorisée une seule fois, à la première
  // modification faite avant validation.
  const original: CustomOrderContent | null =
    current.status === "en_attente"
      ? ((current.original_request as CustomOrderContent | null) ?? {
          recipe_name: current.recipe_name,
          quantity: current.quantity,
          desired_date: current.desired_date,
          details: current.details ?? "",
        })
      : (current.original_request as CustomOrderContent | null);

  const { data, error } = await supabaseAdmin
    .from("custom_orders")
    .update({
      recipe_name: recipeName,
      quantity,
      desired_date: desiredDate,
      details,
      original_request: original,
      ...(customerName ? { customer_name: customerName } : {}),
    })
    .eq("id", id)
    .eq("status", current.status)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ customOrder: data });
}

// Suppression d'une demande « sur commande » (en attente ou validée) : par
// exemple une demande annulée d'un commun accord avec le client. Aucun email,
// et le stock n'est pas touché (une demande n'a rien décompté tant qu'elle
// n'est pas honorée). Une demande déjà honorée est une vente : elle se
// supprime depuis la liste des ventes.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from("custom_orders")
    .delete()
    .eq("id", id)
    .in("status", ["en_attente", "validee"])
    .select("id");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: "Demande introuvable ou déjà honorée / refusée." },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true });
}
