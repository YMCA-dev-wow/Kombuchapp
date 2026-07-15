import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: Partial<{
    name: string;
    description: string;
    quantity: number;
    defaultRestockQuantity: number;
    active: boolean;
  }>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requete invalide." }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) update.name = body.name.trim();
  if (body.description !== undefined) update.description = body.description.trim();
  if (body.quantity !== undefined) update.quantity = body.quantity;
  if (body.defaultRestockQuantity !== undefined)
    update.default_restock_quantity = body.defaultRestockQuantity;
  if (body.active !== undefined) update.active = body.active;

  const { data, error } = await supabaseAdmin
    .from("recipes")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ recipe: data });
}
