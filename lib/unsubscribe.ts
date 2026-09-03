import "server-only";
import crypto from "crypto";

// ---------------------------------------------------------------------
// Génère un lien de désinscription "signé" pour une adresse email, sans
// avoir besoin de compte ni de session : le token est un HMAC de l'email
// avec SESSION_SECRET, donc impossible à deviner/forger sans le secret,
// et personne ne peut désinscrire l'adresse de quelqu'un d'autre en
// devinant juste l'URL.
// ---------------------------------------------------------------------
const secret = process.env.SESSION_SECRET ?? "";

export function unsubscribeToken(email: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 32);
}

export function unsubscribeUrl(email: string, siteUrl: string): string {
  const token = unsubscribeToken(email);
  return `${siteUrl}/api/unsubscribe?email=${encodeURIComponent(email.trim().toLowerCase())}&token=${token}`;
}
