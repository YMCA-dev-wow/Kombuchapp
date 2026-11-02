# CLAUDE.md — YMCA Kombucha

Contexte projet pour Claude Code. À lire avant toute intervention.

## Le projet et son propriétaire

Appli web (PWA installable) de vente de kombucha maison entre amis (~100 clients), en production sur **https://ymcakombucha.com**.

- Propriétaire : Yves-Marie (« YMCA »), **non-développeur**. Parler **en français**, le **tutoyer**, expliquer simplement, sans jargon inutile. Il exécute volontiers des commandes si on lui dit exactement quoi taper.
- Poste : **Windows 11 + PowerShell**, VS Code. Dossier : `C:\Users\yves.marie.chene_ais\Kombuchapp`.
- Deux publics : les **clients** (boutique, peu technophiles, surtout sur mobile) et le **producteur** (espace `/admin`, utilisé quasi quotidiennement depuis l'appli installée sur son téléphone).
- `GUIDE_DEMARRAGE.md` = guide utilisateur en français destiné au propriétaire. **Le tenir à jour** à chaque nouvelle fonctionnalité visible ou nouvelle migration.

## Stack

- **Next.js 16** (App Router, Turbopack), React 19, TypeScript, **Tailwind CSS v4** (couleurs de thème définies en variables CSS dans `app/globals.css` : `accent`, `muted`, `border`, `danger`, `background`, `foreground`).
- **Supabase** : Postgres + Realtime (stock en direct sur la boutique) + RLS.
- **Resend** : emails transactionnels et newsletter, domaine `ymcakombucha.com` vérifié.
- **Vercel** : hébergement, déploiement automatique à chaque push sur `main` (GitHub `YMCA-dev-wow/Kombuchapp`).
- **iron-session** (cookie admin), **bcryptjs**, **recharts** (graphiques du Suivi).
- Next.js 16 : le middleware s'appelle **`proxy.ts`** (fonction exportée `proxy`), pas `middleware.ts`.

## Carte du code

- `app/page.tsx` boutique · `app/sur-commande` demandes personnalisées · `app/contact` formulaire de contact · `app/manifest.ts` + `public/sw.js` PWA (service worker volontairement **sans cache** : le stock doit toujours être frais).
- `app/admin/*` espace producteur : tableau de bord, `recipes`, `ventes` (registre des commandes + zone « À honorer »), `commandes` (demandes sur commande), `suivi` (statistiques), `abonnes` (newsletter, envoi ciblé).
- `app/api/*` routes publiques (`orders/stock`, `orders/custom`, `subscribe`, `unsubscribe`, `contact`) ; `app/api/admin/*` routes protégées par `proxy.ts`.
- `lib/notifications.ts` **tous les emails** (point d'entrée unique `notify(event)` + diffusion newsletter + bienvenue + contact). Conçu pour accueillir plus tard un canal Web Push sans toucher au reste.
- `lib/auth.ts` session admin (1 an, glissante, renouvelée dans `proxy.ts`) · `lib/supabaseAdmin.ts` client **service_role, serveur uniquement** · `lib/supabaseClient.ts` client anon (navigateur) · `lib/types.ts` · `lib/matchRecipe.ts` rapprochement nom libre → recette · `lib/unsubscribe.ts` jetons HMAC de désinscription.
- `supabase/migrations/000X_*.sql` schéma de la base.

## Modèle de données (essentiel)

- `recipes` : le stock vit sur la recette (`quantity`). Visible en boutique si `active` et `quantity > 0`.
- `orders` : registre des ventes. `order_type` (`vendu`/`donne`), `unit_amount` (montant **total** de la ligne), `created_by` (`site`/`admin`/`sur_commande`), `delivery_status` (`a_livrer`/`livree`), `pickup_status` (`a_recuperer`/`recuperee`).
  - Règle métier : le statut bouteille n'a de sens **qu'après livraison** (repasser en `a_livrer` remet `pickup_status` à `a_recuperer`, côté API et UI).
- `custom_orders` : demandes « sur commande », statut `en_attente` → `validee`/`refusee` → `honoree` (devient une ligne `orders` via la fonction `honor_custom_order`).
- `subscribers` : abonnés newsletter.
- Fonctions Postgres **atomiques** (`create_stock_order`, `honor_custom_order`, `restock_recipe`) : toute décrémentation de stock passe par elles (`UPDATE ... WHERE quantity >= n`) pour empêcher la survente. Ne jamais décrémenter le stock en lecture-puis-écriture côté JS.
- ⚠️ Les valeurs d'énumération ci-dessus sont **sans accents** et protégées par des `CHECK` en base : ne jamais les « corriger ». Les **libellés affichés**, eux, doivent toujours porter les accents.

## Règles de travail

### Avant chaque push (= mise en production)

Un push sur `main` déploie **immédiatement** en production. Avant de pousser, toujours :

```
npx tsc --noEmit
npm run lint
```

Les deux doivent être **sans aucune erreur**. `tsc` vérifie la même chose que le build Vercel (un build a déjà échoué en prod à cause d'une erreur de type que seul `tsc` voyait).

- Ne pas lancer `npm run build` pendant que `npm run dev` tourne (conflits de fichiers dans `.next`).
- Demander l'accord du propriétaire avant chaque `git push`, avec un résumé de ce qui part en prod. Messages de commit **en français**, descriptifs.
- Après le push, vérifier que le déploiement Vercel passe (statut « Ready »). En cas d'échec, lire les logs de build et corriger.

### Base de données / migrations

- ⚠️ **Une seule base Supabase pour le local et la prod** : `npm run dev` lit et écrit les **vraies données** (vraies commandes, vrais abonnés). Tester prudemment, ne pas créer de fausses commandes sans les nettoyer, ne jamais envoyer de diffusion de test à tous les abonnés (utiliser l'envoi ciblé de l'onglet Abonnés).
- Toute modification de schéma = **nouveau fichier** `supabase/migrations/000N_description.sql` (numérotation suivie), idempotent si possible (`if not exists`, `drop constraint if exists`…). **Ne jamais modifier une migration déjà appliquée.**
- Jusqu'ici, le propriétaire exécute les migrations à la main (Supabase → SQL Editor). Si la CLI Supabase est mise en place, **toujours demander confirmation avant d'exécuter du SQL sur la base**, et ne jamais exécuter de `delete`/`update` de masse sans avoir montré au préalable les lignes concernées.
- Une fonction Postgres réservée à l'admin doit être `security definer` **et** `revoke execute ... from public, anon, authenticated` + `grant ... to service_role`.

### Sécurité

- La clé `SUPABASE_SERVICE_ROLE_KEY` ne doit **jamais** arriver côté navigateur (pas de `NEXT_PUBLIC_`, pas d'import de `supabaseAdmin` dans un composant client).
- `.env.local` contient les secrets : ne jamais l'afficher, le committer ou en recopier les valeurs dans une réponse.
- Le mot de passe admin est stocké en **hash bcrypt encodé en base64** (`ADMIN_PASSWORD_HASH`), car les `$` du hash brut cassent le parsing des fichiers `.env*` de Next.js. Générer avec `node scripts/hash-password.mjs "motdepasse"`.
- Échapper tout texte saisi par un utilisateur avant de l'insérer dans un email HTML (`escapeHtml` dans `lib/notifications.ts`).

### Emails (délivrabilité : sujet sensible, déjà beaucoup travaillé)

- Expéditeur : `YMCA Kombucha <no-reply@ymcakombucha.com>`. SPF, DKIM et DMARC (`p=none`) sont configurés et passent (DNS gérés chez Vercel).
- Chaque email a une **version texte** (`htmlToText`) en plus du HTML.
- Newsletter et mail de bienvenue : en-têtes `List-Unsubscribe` + `List-Unsubscribe-Post` (désinscription en un clic, exigée par Gmail/Yahoo). La route `/api/unsubscribe` affiche une confirmation en **GET** et ne désinscrit qu'en **POST** (les antivirus visitent les liens des emails).
- **Ne jamais mettre une adresse Gmail/messagerie gratuite en `Reply-To`** d'un mail envoyé depuis `ymcakombucha.com` (pénalité SpamAssassin `FREEMAIL_FORGED_REPLYTO`, -2,5). Exception voulue : le message de contact transmis **au producteur** a pour Reply-To l'adresse de l'auteur. Reply-To générique optionnel : variable `RESEND_REPLY_TO` (adresse sur le domaine).
- Quota gratuit Resend : 100 emails/jour. Pour tester la délivrabilité : mail-tester.com + envoi ciblé.
- Un email qui échoue ne doit jamais faire échouer une commande : on log l'erreur et on continue.

### Conventions de code

- Interface et textes **en français avec accents**, ton chaleureux et tutoiement envers les clients. Apostrophes en JSX : `&apos;`.
- Design épuré, **mobile d'abord** (conteneur `max-w-md`), cartes `rounded-xl border border-border bg-white/60`, boutons arrondis `rounded-full bg-accent`.
- Chargement de données au montage dans les composants client : motif existant avec `// eslint-disable-next-line react-hooks/set-state-in-effect`.
- Pages admin dépendant de données live : `export const dynamic = "force-dynamic"`.
- Commentaires de code en français, expliquant le « pourquoi ».

## Variables d'environnement

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD_HASH` (base64), `SESSION_SECRET` (≥ 32 caractères, signe aussi les liens de désinscription : le changer invalide tous les liens déjà envoyés), `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ADMIN_NOTIFICATION_EMAIL`, `RESEND_REPLY_TO` (optionnel).

Elles existent **à deux endroits** : `.env.local` (local) et Vercel → Settings → Environment Variables (prod). Toute nouvelle variable doit être ajoutée aux deux, puis un redéploiement est nécessaire côté Vercel.

## Historique des pièges déjà rencontrés

- `node_modules` local parfois corrompu (paquets incomplets, ex. `es-toolkit`, types de `recharts`) : réinstaller le paquet concerné (`npm install <paquet>`) plutôt que de contourner l'erreur.
- Build Vercel en échec alors que tout semblait OK en local : c'était une erreur TypeScript masquée localement → d'où la règle `npx tsc --noEmit` avant chaque push.
- Ne pas mettre npm à jour vers une version majeure ni lancer `npm audit fix --force` sans raison précise.

## Idées en attente

- Notifications Web Push (PWA) pour le producteur et les clients, via un nouveau canal dans `lib/notifications.ts`.
- Bouton « Déjà traitée » dans la zone « À honorer » (clore une demande sans créer de vente).
