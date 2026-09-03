import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Inscription publique aux alertes "nouveau stock disponible".
export async function POST(request: NextRequest) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Adresse email invalide." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("subscribers").insert({ email });

  // Code 23505 = violation de contrainte unique -> déjà inscrit, on
  // considère ça comme un succès (pas besoin de le dire à l'utilisateur).
  if (error && error.code !== "23505") {
    console.error("[api/subscribe] erreur:", error);
    return NextResponse.json({ error: "Une erreur est survenue, réessaie." }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
