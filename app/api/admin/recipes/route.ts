import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Protege par middleware.ts (verifie la session admin avant d'arriver ici).

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("recipes")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ recipes: data });
}

export async function POST(request: NextRequest) {
  let body: {
    name?: string;
    description?: string;
    quantity?: number;
    defaultRestockQuantity?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requete invalide." }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Le nom de la recette est requis." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("recipes")
    .insert({
      name: body.name.trim(),
      description: body.description?.trim() || "",
      quantity: body.quantity ?? 0,
      default_restock_quantity: body.defaultRestockQuantity ?? 6,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ recipe: data }, { status: 201 });
}
