import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendStockAvailableBroadcast } from "@/lib/notifications";

// GET : nombre d'abonnés actuel (pour afficher une confirmation avant envoi).
export async function GET() {
  const { count, error } = await supabaseAdmin
    .from("subscribers")
    .select("*", { count: "exact", head: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ count: count ?? 0 });
}

// POST : diffuse une invitation "nouveau stock disponible" à tous les abonnés,
// avec un message personnalisé optionnel (nouveaux goûts, pause de
// production pendant les vacances, etc.).
export async function POST(request: NextRequest) {
  let message: string | undefined;
  try {
    const body = await request.json();
    message = typeof body?.message === "string" ? body.message : undefined;
  } catch {
    // Corps vide ou invalide : on continue sans message personnalisé.
  }

  const { data, error } = await supabaseAdmin.from("subscribers").select("email");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  const emails = (data ?? []).map((row) => row.email as string);
  const { sent } = await sendStockAvailableBroadcast(emails, origin, message);

  return NextResponse.json({ sent, total: emails.length });
}
