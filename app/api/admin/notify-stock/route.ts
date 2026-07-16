import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendStockAvailableBroadcast } from "@/lib/notifications";

// GET : nombre d'abonnes actuel (pour afficher une confirmation avant envoi).
export async function GET() {
  const { count, error } = await supabaseAdmin
    .from("subscribers")
    .select("*", { count: "exact", head: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ count: count ?? 0 });
}

// POST : diffuse une invitation "nouveau stock disponible" a tous les abonnes.
export async function POST(request: NextRequest) {
  const { data, error } = await supabaseAdmin.from("subscribers").select("email");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  const emails = (data ?? []).map((row) => row.email as string);
  const { sent } = await sendStockAvailableBroadcast(emails, origin);

  return NextResponse.json({ sent, total: emails.length });
}
