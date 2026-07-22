import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: Partial<{
    recipeName: string;
    quantity: number;
    customerName: string;
    createdAt: string;
    orderType: "vendu" | "donne";
    unitAmount: number | null;
  }>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requete invalide." }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (body.recipeName !== undefined) update.recipe_name_snapshot = body.recipeName.trim();
  if (body.quantity !== undefined) update.quantity = body.quantity;
  if (body.customerName !== undefined) update.customer_name = body.customerName.trim();
  if (body.createdAt !== undefined) update.created_at = new Date(body.createdAt).toISOString();
  if (body.orderType !== undefined) {
    update.order_type = body.orderType;
    if (body.orderType === "donne") update.unit_amount = null;
  }
  if (body.unitAmount !== undefined && body.orderType !== "donne") update.unit_amount = body.unitAmount;

  const { data, error } = await supabaseAdmin
    .from("orders")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ order: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error } = await supabaseAdmin.from("orders").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
