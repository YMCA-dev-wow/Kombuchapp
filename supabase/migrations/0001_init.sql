-- =====================================================================
-- Kombucha App - schema initial
-- A executer dans Supabase > SQL Editor (voir GUIDE_DEMARRAGE.md)
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- RECETTES (= les parfums de kombucha que tu proposes)
-- La quantite en stock vit directement sur la recette : une recette
-- "active" avec quantity > 0 est visible et commandable dans la boutique.
-- ---------------------------------------------------------------------
create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  quantity integer not null default 0 check (quantity >= 0),
  default_restock_quantity integer not null default 6 check (default_restock_quantity > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- COMMANDES "stock" (bouteilles deja pretes, achetees immediatement)
-- ---------------------------------------------------------------------
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete restrict,
  recipe_name_snapshot text not null,
  quantity integer not null check (quantity > 0),
  customer_name text not null,
  customer_email text,
  status text not null default 'confirmee' check (status in ('confirmee', 'annulee')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- COMMANDES PERSONNALISEES ("Sur commande")
-- ---------------------------------------------------------------------
create table if not exists custom_orders (
  id uuid primary key default gen_random_uuid(),
  recipe_name text not null,
  details text default '',
  quantity integer not null check (quantity > 0),
  desired_date date,
  customer_name text not null,
  customer_email text,
  status text not null default 'en_attente' check (status in ('en_attente', 'validee', 'refusee')),
  admin_note text default '',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- FONCTION ATOMIQUE : commander une bouteille en stock
-- Le "WHERE quantity >= p_quantity" + le verrou de ligne implicite d'UPDATE
-- garantissent que si 2 personnes commandent la derniere bouteille en
-- meme temps, une seule des deux requetes reussit : la seconde repart
-- avec 0 ligne mise a jour -> on leve une exception "stock_insuffisant".
-- SECURITY DEFINER permet d'appeler cette fonction avec la cle publique
-- (anon) du site tout en gardant les tables verrouillees en ecriture
-- directe (cf. policies RLS plus bas).
-- ---------------------------------------------------------------------
create or replace function create_stock_order(
  p_recipe_id uuid,
  p_quantity integer,
  p_customer_name text,
  p_customer_email text
) returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipe recipes;
  v_order orders;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantite_invalide';
  end if;

  update recipes
    set quantity = quantity - p_quantity,
        updated_at = now()
    where id = p_recipe_id
      and active = true
      and quantity >= p_quantity
    returning * into v_recipe;

  if not found then
    raise exception 'stock_insuffisant';
  end if;

  insert into orders (recipe_id, recipe_name_snapshot, quantity, customer_name, customer_email)
  values (p_recipe_id, v_recipe.name, p_quantity, p_customer_name, p_customer_email)
  returning * into v_order;

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------
-- FONCTION : reapprovisionner une recette en 1 clic (espace admin)
-- Ajoute la quantite de reappro par defaut de la recette (ou une valeur
-- fournie) au stock existant.
-- ---------------------------------------------------------------------
create or replace function restock_recipe(
  p_recipe_id uuid,
  p_quantity integer default null
) returns recipes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipe recipes;
  v_amount integer;
begin
  select * into v_recipe from recipes where id = p_recipe_id;
  if not found then
    raise exception 'recette_introuvable';
  end if;

  v_amount := coalesce(p_quantity, v_recipe.default_restock_quantity);

  update recipes
    set quantity = quantity + v_amount,
        updated_at = now()
    where id = p_recipe_id
    returning * into v_recipe;

  return v_recipe;
end;
$$;

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- Le site public (cle anon) peut uniquement : lire les recettes actives,
-- inserer des demandes "sur commande", et appeler les fonctions ci-dessus.
-- Toute ecriture directe sur recipes/orders est reservee a la cle
-- "service_role" (utilisee uniquement cote serveur, jamais dans le
-- navigateur) qui, elle, ignore toujours RLS.
-- ---------------------------------------------------------------------
alter table recipes enable row level security;
alter table orders enable row level security;
alter table custom_orders enable row level security;

drop policy if exists "public read active recipes" on recipes;
create policy "public read active recipes"
  on recipes for select
  using (active = true);

drop policy if exists "public can insert custom orders" on custom_orders;
create policy "public can insert custom orders"
  on custom_orders for insert
  with check (true);

-- Pas de policy SELECT/UPDATE/DELETE publique sur orders/custom_orders :
-- seule la cle service_role (admin, cote serveur) peut les lire/modifier.

-- ---------------------------------------------------------------------
-- REALTIME : necessaire pour que la boutique affiche le stock en direct
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'recipes'
  ) then
    alter publication supabase_realtime add table recipes;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Quelques recettes d'exemple (a modifier/supprimer depuis l'espace admin)
-- ---------------------------------------------------------------------
insert into recipes (name, description, quantity, default_restock_quantity)
values
  ('Kombucha Nature', 'Fermentation classique, legerement petillant', 6, 6),
  ('Kombucha Gingembre-Citron', 'Une pointe de peps acidule', 4, 6)
on conflict do nothing;
