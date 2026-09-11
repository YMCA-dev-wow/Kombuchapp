import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Liste complete des inscrits aux alertes "nouveau stock disponible",
// pour l'espace producteur (voir /admin/abonnes).
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("subscribers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ subscribers: data });
}
