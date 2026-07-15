# Kombucha maison

Application de commande de kombucha maison (boutique + espace producteur).

Stack : Next.js + Tailwind CSS + Supabase (base de données, temps réel) + Resend (emails).

Toutes les étapes d'installation et de configuration sont dans **[GUIDE_DEMARRAGE.md](./GUIDE_DEMARRAGE.md)** — commence par ce fichier.

## Commandes utiles

```
npm install       # installer les dépendances
npm run dev       # lancer en local (http://localhost:3000)
npm run build     # construire la version de production
npm run lint      # vérifier la qualité du code
```

## Structure du projet

- `app/` — pages de la boutique (`/`, `/sur-commande`) et de l'espace admin (`/admin/*`)
- `app/api/` — routes API (commandes, connexion admin, gestion des recettes)
- `lib/` — logique partagée (accès Supabase, authentification, notifications)
- `supabase/migrations/` — schéma SQL de la base de données à exécuter dans Supabase
- `scripts/hash-password.mjs` — génère le hash du mot de passe admin
