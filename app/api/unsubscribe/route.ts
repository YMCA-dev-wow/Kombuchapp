import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { unsubscribeToken } from "@/lib/unsubscribe";

// Désinscription en un clic depuis le mail de diffusion "nouveau stock".
// Lien de la forme /api/unsubscribe?email=...&token=... : le token est
// vérifié avant toute suppression pour éviter qu'on puisse désinscrire
// l'adresse de quelqu'un d'autre en devinant juste l'URL.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.trim().toLowerCase();
  const token = searchParams.get("token");

  if (!email || !token || token !== unsubscribeToken(email)) {
    return htmlResponse("Ce lien de désinscription est invalide.", 400);
  }

  const { error } = await supabaseAdmin.from("subscribers").delete().eq("email", email);

  if (error) {
    console.error("[api/unsubscribe] erreur:", error);
    return htmlResponse("Une erreur est survenue, réessaie plus tard.", 500);
  }

  return htmlResponse(`L'adresse ${email} a bien été désinscrite des alertes de nouveau stock.`, 200);
}

function htmlResponse(message: string, status: number) {
  const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Désinscription - YMCA Kombucha</title>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 480px; margin: 90px auto; padding: 0 20px; text-align: center; color: #23201b; }
      a { color: #7a8450; }
    </style>
  </head>
  <body>
    <p>${message}</p>
    <p><a href="/">Retour à la boutique</a></p>
  </body>
</html>`;

  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
