-- =====================================================================
-- Kombucha App - migration 0007 : repere "F2" sur les commandes a honorer
-- A executer APRES 0006.
--
-- Le producteur marque (d'un clic, dans la zone « A honorer » de l'onglet
-- Ventes) les bouteilles qui sont en seconde fermentation (F2), pour savoir
-- lesquelles sont bien lancees en production. Simple indicateur : il ne
-- change ni le stock ni les statuts. Colonnes non nulles, faux par defaut :
-- les lignes existantes restent "pas en F2".
-- =====================================================================

alter table custom_orders
  add column if not exists in_f2 boolean not null default false;

alter table orders
  add column if not exists in_f2 boolean not null default false;
