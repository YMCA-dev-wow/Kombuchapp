# Guide de démarrage — Kombucha maison

Ce guide t'accompagne pas à pas, même sans aucune compétence en développement. Tu développes et testes tout **en local sur ton ordinateur**, puis tu publies gratuitement en ligne pour que tes 100 amis puissent commander depuis leur téléphone.

Stack utilisée (100% gratuite pour ton usage) : Next.js (le site + les pages admin), Supabase (base de données PostgreSQL + temps réel, plan gratuit), Resend (emails, plan gratuit), Vercel (hébergement, plan gratuit).

---

## 1. Outils à installer sur ton ordinateur

| Outil | Pourquoi | Lien |
|---|---|---|
| **Node.js** (version 20 ou plus) | Fait tourner le site en local | https://nodejs.org (bouton "LTS") |
| **Visual Studio Code** | L'éditeur dans lequel tu ouvriras le projet | https://code.visualstudio.com |
| **Git** | Nécessaire pour envoyer le code sur GitHub puis Vercel | https://git-scm.com |
| **Compte GitHub** (gratuit) | Héberge ton code, relié à Vercel pour le déploiement | https://github.com |

Installe les trois logiciels avec les options par défaut (clique "Suivant" partout). Pour vérifier que Node.js est bien installé, ouvre un terminal (dans VS Code : menu **Terminal > Nouveau terminal**) et tape :

```
node -v
```

Tu dois voir un numéro de version (ex: `v20.x.x`).

---

## 2. Ouvrir le projet dans VS Code

1. Décompresse/copie le dossier `kombucha-app` où tu veux sur ton ordinateur (ex: `Documents/kombucha-app`).
2. Dans VS Code : **Fichier > Ouvrir le dossier...** et sélectionne `kombucha-app`.
3. Ouvre un terminal (**Terminal > Nouveau terminal**) et installe les dépendances :

```
npm install
```

Cela télécharge tout ce dont le site a besoin pour fonctionner (ça prend 1-2 minutes).

---

## 3. Créer ta base de données (Supabase, gratuit)

1. Va sur https://supabase.com, crée un compte gratuit (avec GitHub c'est le plus rapide).
2. Clique **New project**. Choisis un nom (ex: `kombucha`), un mot de passe de base de données (garde-le de côté, tu n'en auras normalement plus besoin), et une région proche de toi (ex: Paris/Frankfurt).
3. Une fois le projet créé, va dans **SQL Editor** (menu de gauche) puis **New query**.
4. Ouvre le fichier `supabase/migrations/0001_init.sql` de ton projet (dans VS Code), copie tout son contenu, colle-le dans l'éditeur SQL de Supabase, et clique **Run**. Cela crée toutes les tables (recettes, commandes) et les règles de sécurité.
   Fais de même avec `supabase/migrations/0002_subscribers.sql` (dans une nouvelle requête SQL) : cette table sert à la liste des amis inscrits aux alertes "nouveau stock disponible". À chaque futur ajout de fonctionnalité nécessitant la base de données, un nouveau fichier `000X_....sql` sera ajouté à exécuter de la même façon — jamais besoin de retoucher les fichiers déjà exécutés.
5. Va dans **Project Settings > API**. Tu vas y trouver trois valeurs à copier pour l'étape 5 :
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key (clique "Reveal") → `SUPABASE_SERVICE_ROLE_KEY` — **garde-la secrète, ne la partage jamais, ne la mets jamais dans du code envoyé au navigateur.**

---

## 4. Créer ton compte Resend (emails, gratuit)

1. Va sur https://resend.com et crée un compte gratuit.
2. Dans **API Keys**, crée une clé et copie-la → ce sera `RESEND_API_KEY`.
3. Pour commencer sans configuration de domaine, tu peux envoyer depuis `onboarding@resend.dev` (déjà prêt à l'emploi). Plus tard, si tu veux envoyer depuis ton propre nom de domaine, Resend te guide pour vérifier un domaine.

---

## 5. Configurer le fichier `.env.local`

1. Dans VS Code, duplique le fichier `.env.example` et renomme la copie en `.env.local` (ce fichier ne sera jamais partagé ni envoyé sur GitHub, c'est normal et voulu — il contient tes secrets).
2. Remplis les valeurs Supabase et Resend récupérées aux étapes précédentes.
3. Génère le hash de ton mot de passe admin. Dans le terminal :

```
node scripts/hash-password.mjs "TonMotDePasseSecret"
```

Copie la ligne `ADMIN_PASSWORD_HASH=...` affichée telle quelle dans `.env.local` (c'est une valeur encodée en base64, sans caractère `$` — volontaire, pour éviter un bug d'interprétation de Next.js sur les fichiers `.env*`, voir dépannage ci-dessous).

4. Génère un `SESSION_SECRET` (une chaîne aléatoire d'au moins 32 caractères). Tu peux utiliser cette commande dans le terminal pour en générer une :

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Colle le résultat dans `SESSION_SECRET`.

5. Renseigne `ADMIN_NOTIFICATION_EMAIL` avec ton adresse email, pour recevoir une alerte à chaque nouvelle commande.

Ton `.env.local` final doit avoir toutes les lignes remplies (aucune ne doit rester vide, sauf si indiqué optionnel).

---

## 6. Lancer le site en local

Dans le terminal :

```
npm run dev
```

Ouvre http://localhost:3000 dans ton navigateur : tu dois voir la boutique avec les 2 recettes d'exemple. Va sur http://localhost:3000/admin/login et connecte-toi avec le mot de passe choisi à l'étape 5 pour accéder à l'espace producteur (recettes, réappro en 1 clic, validation des commandes personnalisées).

Teste une commande depuis la boutique : le stock doit se mettre à jour immédiatement (grâce au temps réel Supabase).

---

## 7. Publier en ligne gratuitement (pour que tes amis puissent commander)

1. Crée un nouveau dépôt sur https://github.com (bouton **New repository**), nom libre (ex: `kombucha-app`), laisse-le vide (pas de README).
2. Dans le terminal de VS Code, à la racine du projet :

```
git init
git add .
git commit -m "Premier envoi"
git branch -M main
git remote add origin https://github.com/TON-PSEUDO/kombucha-app.git
git push -u origin main
```

(Remplace `TON-PSEUDO` par ton nom d'utilisateur GitHub. Le fichier `.gitignore` déjà présent exclut automatiquement `node_modules` et `.env.local` — tes secrets ne partent jamais sur GitHub.)

3. Va sur https://vercel.com, crée un compte gratuit avec GitHub, clique **Add New > Project**, et sélectionne ton dépôt `kombucha-app`.
4. Avant de cliquer "Deploy", ouvre la section **Environment Variables** et ajoute exactement les mêmes variables que dans ton `.env.local` (copie-colle chaque ligne : nom de variable + valeur).
5. Clique **Deploy**. Après 1-2 minutes, Vercel te donne une URL publique (ex: `kombucha-app.vercel.app`) — c'est le lien à partager à tes 100 amis.

Pour toute future modification du code : modifie les fichiers dans VS Code, puis relance `git add . && git commit -m "..." && git push`. Vercel republie automatiquement en 1-2 minutes.

---

## 8. Utilisation au quotidien (espace producteur)

- **Recettes** : crée tes parfums une fois (nom, description, quantité de réapprovisionnement par défaut). Ensuite, un clic sur **"Remettre en stock"** ajoute cette quantité au stock existant — plus besoin de ressaisir les infos à chaque fournée.
- **Commandes** : la section **Commandes** liste les demandes "sur commande" en attente ; tu peux les **Valider** ou **Refuser** en un clic, un email est automatiquement envoyé à la personne.
- **Suivi** : répartition des ventes par recette (camembert) et évolution des volumes par semaine et par mois (courbes par recette + total). Basé sur les commandes de stock confirmées.
- **Nouveau stock disponible** : sur le tableau de bord, un bouton permet de prévenir tous les amis inscrits (voir ci-dessous) qu'un nouveau stock est disponible — un simple email d'invitation à consulter la boutique, sans détail du contenu.
- Le **Tableau de bord** te donne un coup d'œil rapide (nombre de recettes actives, demandes en attente, alertes de stock bas).

### S'inscrire aux alertes de nouveau stock

Sur la boutique, tes amis peuvent laisser leur email dans un petit encart "Être prévenu(e) des nouveaux stocks". C'est cette liste qui reçoit l'invitation quand tu cliques sur "Prévenir du nouveau stock" dans le tableau de bord.

⚠️ Le plan gratuit de Resend limite l'envoi à **100 emails par jour**. Une diffusion complète à tous tes amis inscrits consomme donc une bonne partie (voire la totalité) de ton quota du jour — évite de la déclencher plusieurs fois le même jour, et évite de la combiner avec beaucoup de commandes individuelles la même journée.

---

## 9. Et après ? (notifications Web Push)

Le code est volontairement organisé pour que ce soit facile à ajouter plus tard : tout passe par `lib/notifications.ts`, qui définit un "canal" email (Resend) actif aujourd'hui. Pour ajouter les notifications Web Push (PWA), il suffira d'ajouter un nouveau canal dans ce fichier (voir le commentaire `pushChannel` déjà présent en exemple) — aucune autre partie du code (pages, routes API) n'aura besoin de changer.

---

## 10. Dépannage rapide

- **"Variables NEXT_PUBLIC_SUPABASE_URL... manquantes"** → vérifie que `.env.local` existe bien à la racine du projet (pas juste `.env.example`) et que le serveur (`npm run dev`) a bien été relancé après modification du fichier.
- **"Mot de passe incorrect" en boucle** → régénère le hash avec `node scripts/hash-password.mjs "..."` et vérifie qu'il n'y a pas d'espace en trop dans `.env.local`.
- **"ADMIN_PASSWORD_HASH manquant" alors qu'il est bien rempli** → si la valeur contient des `$` (ancien format), Next.js les interprète comme des références à d'autres variables d'environnement et casse la valeur silencieusement. Régénère le hash avec la dernière version de `scripts/hash-password.mjs` (le résultat ne contient plus de `$`) et remplace la ligne dans `.env.local`, puis redémarre `npm run dev`.
- **Le fichier `.env.local` n'est pas pris en compte** → vérifie qu'il ne s'appelle pas en réalité `.env.local.txt` (Windows masque parfois l'extension). Dans l'explorateur de fichiers, active l'affichage des extensions (onglet Affichage > cocher "Extensions de noms de fichiers"), ou tape `Get-ChildItem -Force` dans un terminal PowerShell à la racine du projet pour voir le nom exact.
- **Le stock ne se met pas à jour en temps réel** → vérifie dans Supabase, section **Database > Replication**, que la table `recipes` est bien cochée (normalement fait automatiquement par la migration SQL).
- **Erreur au moment du `git push`** → vérifie que tu as bien créé le dépôt GitHub et copié la bonne URL dans `git remote add origin ...`.
