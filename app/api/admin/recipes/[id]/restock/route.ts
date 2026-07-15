import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// "Remettre en stock en 1 clic" : ajoute la quantite de reappro par
// defaut de la recette (ou une quantite precisee) au stock courant.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let quantity: number | undefined;
  try {
    const body = await request.json();
    quantity = body?.quantity;
  } catch {
    // pas de body -> on utilise la quantite de reappro par defaut de la recette
  }

  const { data, error } = await supabaseAdmin.rpc("restock_recipe", {
    p_recipe_id: id,
    p_quantity: quantity ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ recipe: data });
}
