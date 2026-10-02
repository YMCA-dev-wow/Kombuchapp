import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { unsubscribeToken } from "@/lib/unsubscribe";

// Désinscription des alertes "nouveau stock".
// Lien de la forme /api/unsubscribe?email=...&token=... : le token est
// vérifié avant toute suppression pour éviter qu'on puisse désinscrire
// l'adresse de quelqu'un d'autre en devinant juste l'URL.
//
// - GET  : page de confirmation avec un bouton. On ne désinscrit PAS
//          directement sur un simple clic/ouverture du lien, car les
//          antivirus et filtres de messagerie "visitent" automatiquement
//          les liens des emails, ce qui désinscrirait les gens à leur insu.
// - POST : désinscription effective. Utilisé par le bouton de la page de
//          confirmation ET par le bouton "Se désabonner" natif de Gmail /
//          Yahoo (désinscription en un clic, RFC 8058, en-tête
//          List-Unsubscribe-Post ajouté dans lib/notifications.ts).

function readParams(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.trim().toLowerCase() ?? "";
  const token = searchParams.get("token") ?? "";
  const valid = Boolean(email && token && token === unsubscribeToken(email));
  return { email, token, valid };
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function GET(request: NextRequest) {
  const { email, token, valid } = readParams(request);
  if (!valid) {
    return htmlResponse("<p>Ce lien de désinscription est invalide.</p>", 400);
  }

  const action = `/api/unsubscribe?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
  return htmlResponse(
    `<p>Ne plus recevoir les alertes de nouveau stock sur <strong>${escapeHtml(email)}</strong> ?</p>
     <form method="post" action="${escapeHtml(action)}">
       <button type="submit">Confirmer la désinscription</button>
     </form>`,
    200
  );
}

export async function POST(request: NextRequest) {
  const { email, valid } = readParams(request);
  if (!valid) {
    return htmlResponse("<p>Ce lien de désinscription est invalide.</p>", 400);
  }

  const { error } = await supabaseAdmin.from("subscribers").delete().eq("email", email);

  if (error) {
    console.error("[api/unsubscribe] erreur:", error);
    return htmlResponse("<p>Une erreur est survenue, réessaie plus tard.</p>", 500);
  }

  return htmlResponse(
    `<p>L'adresse ${escapeHtml(email)} a bien été désinscrite des alertes de nouveau stock.</p>`,
    200
  );
}

function htmlResponse(content: string, status: number) {
  const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Désinscription - YMCA Kombucha</title>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 480px; margin: 90px auto; padding: 0 20px; text-align: center; color: #23201b; }
      a { color: #7a8450; }
      button { background: #7a8450; color: #fff; border: 0; border-radius: 999px; padding: 10px 20px; font-size: 14px; cursor: pointer; }
    </style>
  </head>
  <body>
    ${content}
    <p><a href="/">Retour à la boutique</a></p>
  </body>
</html>`;

  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
