import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { notify } from "@/lib/notifications";

// Validation manuelle (par le producteur) d'une commande "sur commande".
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { status?: "validee" | "refusee"; adminNote?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requete invalide." }, { status: 400 });
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

  await notify({
    type:
      body.status === "validee"
        ? "commande_personnalisee_validee"
        : "commande_personnalisee_refusee",
    recipeName: data.recipe_name,
    customerEmail: data.customer_email,
    adminNote: data.admin_note,
  });

  return NextResponse.json({ customOrder: data });
}
