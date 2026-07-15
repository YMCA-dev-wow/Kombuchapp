import "server-only";

// Client Supabase utilise UNIQUEMENT cote SERVEUR (routes API / Server
// Components). Il utilise la cle "service_role" qui contourne les
// policies RLS : c'est ce qui permet a l'espace admin de creer des
// recettes, de reapprovisionner le stock et de valider les commandes
// personnalisees. Cette cle ne doit JAMAIS etre exposee au navigateur
// (elle ne commence pas par NEXT_PUBLIC_, donc Next.js ne l'inclut
// jamais dans le code envoye au client).

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Variables NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquantes. Verifie ton fichier .env.local (voir GUIDE_DEMARRAGE.md)."
  );
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});
