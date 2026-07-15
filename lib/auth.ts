import "server-only";
import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";
import bcrypt from "bcryptjs";

// ---------------------------------------------------------------------
// Authentification admin ultra-simple : UN mot de passe (pas de compte,
// pas d'email). Le mot de passe n'est jamais stocke en clair : on stocke
// son hash bcrypt dans la variable d'environnement ADMIN_PASSWORD_HASH
// (voir scripts/hash-password.mjs + GUIDE_DEMARRAGE.md pour le generer).
// La session est un cookie chiffre (iron-session) signe avec SESSION_SECRET.
// ---------------------------------------------------------------------

export type SessionData = {
  isAdmin?: boolean;
};

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 32) {
  // On ne "throw" pas au chargement du module pour ne pas casser le build,
  // mais getSession() ci-dessous levera une erreur claire si on essaie de
  // s'en servir sans secret valide.
  console.warn(
    "[auth] SESSION_SECRET manquant ou trop court (32 caracteres minimum). Voir GUIDE_DEMARRAGE.md."
  );
}

export const sessionOptions: SessionOptions = {
  cookieName: "kombucha_admin_session",
  password: sessionSecret ?? "",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 jours
  },
};

export async function getSession() {
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error(
      "SESSION_SECRET manquant ou trop court. Ajoute une chaine aleatoire d'au moins 32 caracteres dans .env.local (voir GUIDE_DEMARRAGE.md)."
    );
  }
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function isAdminLoggedIn(): Promise<boolean> {
  const session = await getSession();
  return session.isAdmin === true;
}

/** Verifie le mot de passe saisi contre le hash stocke en env. */
export async function verifyAdminPassword(password: string): Promise<boolean> {
  const encoded = process.env.ADMIN_PASSWORD_HASH;
  if (!encoded) {
    throw new Error(
      "ADMIN_PASSWORD_HASH manquant dans .env.local. Genere-le avec `node scripts/hash-password.mjs` (voir GUIDE_DEMARRAGE.md)."
    );
  }
  // ADMIN_PASSWORD_HASH est stocke encode en base64 (voir scripts/hash-password.mjs) :
  // le hash bcrypt brut contient des "$" que Next.js interprete comme des
  // references a d'autres variables d'environnement dans les fichiers .env*.
  const hash = Buffer.from(encoded, "base64").toString("utf8");
  return bcrypt.compare(password, hash);
}
