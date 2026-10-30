import { NextRequest, NextResponse } from "next/server";
import { sendContactMessage } from "@/lib/notifications";

const MAX_MESSAGE = 3000;

// Formulaire de contact public : transmet le message au producteur par
// email et envoie un accusé de réception à l'auteur.
export async function POST(request: NextRequest) {
  let body: { name?: string; email?: string; message?: string; website?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  // Champ "piège" invisible pour les humains : s'il est rempli, c'est un
  // robot. On fait semblant que tout s'est bien passé, sans rien envoyer.
  if (body.website) {
    return NextResponse.json({ ok: true });
  }

  const name = body.name?.trim().slice(0, 100) ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const message = body.message?.trim() ?? "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Adresse email invalide." }, { status: 400 });
  }
  if (message.length < 2) {
    return NextResponse.json({ error: "Écris ton message avant d'envoyer." }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE) {
    return NextResponse.json(
      { error: `Message trop long (${MAX_MESSAGE} caractères maximum).` },
      { status: 400 }
    );
  }

  const { ok } = await sendContactMessage({ name, email, message });
  if (!ok) {
    return NextResponse.json(
      { error: "L'envoi a échoué, réessaie un peu plus tard." },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
