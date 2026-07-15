"use client";

// Client Supabase utilise cote NAVIGATEUR (cle publique "anon").
// Cette cle ne donne acces qu'a ce que les policies RLS autorisent
// (lecture des recettes actives, insertion des commandes "sur commande",
// et appel des fonctions RPC publiques). Voir supabase/migrations/0001_init.sql.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Variables NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY manquantes. Verifie ton fichier .env.local (voir GUIDE_DEMARRAGE.md)."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
