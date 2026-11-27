-- =====================================================================
-- Kombucha App - migration 0008 : date de livraison prevue des commandes
-- A executer APRES 0007.
--
-- Permet de trier et de regrouper par semaine les commandes de la zone
-- « A honorer » (onglet Ventes). Colonne optionnelle (NULL = pas de date) :
-- les commandes existantes restent "sans date de livraison". Pour une
-- demande "sur commande", la date souhaitee (custom_orders.desired_date)
-- est reprise quand la demande est honoree.
-- =====================================================================

alter table orders
  add column if not exists delivery_date date;
