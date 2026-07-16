-- =====================================================================
-- Kombucha App - migration 0002 : liste d'abonnes aux alertes de stock
-- A executer APRES 0001_init.sql, dans Supabase > SQL Editor.
-- =====================================================================

create table if not exists subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table subscribers enable row level security;

-- Le site public peut s'inscrire (inserer son email), mais ne peut jamais
-- lire la liste des abonnes : seule la cle service_role (espace admin,
-- cote serveur) peut la consulter pour envoyer les alertes.
drop policy if exists "public can subscribe" on subscribers;
create policy "public can subscribe"
  on subscribers for insert
  with check (true);
