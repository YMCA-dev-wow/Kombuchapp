-- =====================================================================
-- Kombucha App - migration 0003 : ledger des commandes (type, prix, origine)
-- A executer APRES 0001 et 0002, dans Supabase > SQL Editor.
-- =====================================================================

alter table orders
  add column if not exists order_type text not null default 'vendu' check (order_type in ('vendu', 'donne')),
  add column if not exists unit_amount numeric(8,2),
  add column if not exists created_by text not null default 'site' check (created_by in ('site', 'admin'));

-- Permet d'enregistrer manuellement une commande qui ne correspond a
-- aucune recette existante (ex: ancienne recette supprimee, vente
-- ponctuelle hors catalogue) : recipe_id devient optionnel, seul
-- recipe_name_snapshot (texte libre) reste obligatoire.
alter table orders
  alter column recipe_id drop not null;

-- created_at existe deja (rempli automatiquement a la creation) et reste
-- modifiable normalement par une simple mise a jour (UPDATE) depuis
-- l'espace admin, pas besoin de nouvelle colonne pour la date.

comment on column orders.order_type is 'vendu = bouteille payee, donne = offerte (pas comptee dans le CA)';
comment on column orders.unit_amount is 'Montant total encaisse pour cette ligne de commande (en euros), rempli seulement si order_type = vendu';
comment on column orders.created_by is 'site = commande passee par un client via la boutique, admin = ligne ajoutee manuellement par le producteur';
