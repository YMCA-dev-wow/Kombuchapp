-- =====================================================================
-- Kombucha App - migration 0006 : modifier une demande "sur commande"
-- A executer APRES 0005.
--
-- Le producteur peut modifier une demande en attente (gout, quantite,
-- date, precisions) apres un echange avec le client. On garde la demande
-- initiale dans `original_request` (renseigne a la PREMIERE modification
-- seulement) pour que l'email de validation puisse recapituler ce qui a
-- change. Colonne nullable : les demandes jamais modifiees restent NULL.
-- Aucune policy publique SELECT sur custom_orders : cette colonne n'est
-- jamais visible depuis le site.
-- =====================================================================

alter table custom_orders
  add column if not exists original_request jsonb;
