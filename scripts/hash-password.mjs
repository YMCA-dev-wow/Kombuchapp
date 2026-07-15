// Petit utilitaire pour generer le hash bcrypt de ton mot de passe admin.
// Usage : node scripts/hash-password.mjs "MonSuperMotDePasse"
// Le resultat est a coller dans .env.local sous ADMIN_PASSWORD_HASH.
// Voir GUIDE_DEMARRAGE.md pour le contexte complet.

import bcrypt from "bcryptjs";

const password = process.argv[2];

if (!password) {
  console.error("Usage : node scripts/hash-password.mjs \"MonMotDePasse\"");
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);

// On encode le hash en base64 avant de l'ecrire dans .env.local : le hash
// bcrypt contient des caracteres "$" (ex: $2b$10$...) que Next.js essaie
// d'interpreter comme des references a d'autres variables d'environnement
// (voir https://nextjs.org/docs/app/guides/environment-variables#referencing-other-variables),
// ce qui casse silencieusement la valeur. Le base64 evite completement le probleme.
const encoded = Buffer.from(hash, "utf8").toString("base64");

console.log("\nAjoute cette ligne dans ton fichier .env.local :\n");
console.log(`ADMIN_PASSWORD_HASH=${encoded}\n`);
