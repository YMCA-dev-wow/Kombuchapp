-- =====================================================================
-- Kombucha App - migration 0004 : statuts livraison / recuperation
-- A executer APRES 0003_orders_ledger.sql, dans Supabase > SQL Editor.
-- =====================================================================

alter table orders
  add column if not exists delivery_status text not null default 'a_livrer'
    check (delivery_status in ('a_livrer', 'livree'));

alter table orders
  add column if not exists pickup_status text not null default 'a_recuperer'
    check (pickup_status in ('a_recuperer', 'recuperee'));
