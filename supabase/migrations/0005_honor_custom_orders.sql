-- =====================================================================
-- Kombucha App - migration 0005 : honorer les demandes "sur commande"
-- A executer APRES 0004, dans Supabase > SQL Editor.
--
-- Une demande validee ("validee") peut ensuite etre "honoree" : elle
-- devient alors une vraie ligne de vente dans `orders` (onglet Ventes),
-- soit en puisant dans le stock, soit en "production dediee" (sans
-- toucher au stock).
-- =====================================================================

-- 1) Nouveau statut "honoree" + lien vers la vente creee
alter table custom_orders drop constraint if exists custom_orders_status_check;
alter table custom_orders
  add constraint custom_orders_status_check
  check (status in ('en_attente', 'validee', 'refusee', 'honoree'));

alter table custom_orders
  add column if not exists order_id uuid references orders(id) on delete set null,
  add column if not exists honored_at timestamptz;

-- 2) Nouvelle origine de vente "sur_commande"
alter table orders drop constraint if exists orders_created_by_check;
alter table orders
  add constraint orders_created_by_check
  check (created_by in ('site', 'admin', 'sur_commande'));

-- 3) Fonction ATOMIQUE : transformer une demande validee en vente.
-- - Verrouille la demande (for update) : impossible de l'honorer deux fois.
-- - Si p_from_stock : decremente le stock avec la meme garantie
--   anti-survente que la boutique (where quantity >= ...).
-- - Tout reussit ou rien ne change (une seule transaction).
create or replace function honor_custom_order(
  p_custom_order_id uuid,
  p_recipe_id uuid,
  p_from_stock boolean,
  p_order_type text default 'vendu',
  p_unit_amount numeric default null
) returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request custom_orders;
  v_recipe recipes;
  v_name text;
  v_order orders;
begin
  select * into v_request
    from custom_orders
    where id = p_custom_order_id and status = 'validee'
    for update;
  if not found then
    raise exception 'demande_non_honorable';
  end if;

  if p_from_stock then
    if p_recipe_id is null then
      raise exception 'recette_requise';
    end if;
    update recipes
      set quantity = quantity - v_request.quantity,
          updated_at = now()
      where id = p_recipe_id
        and quantity >= v_request.quantity
      returning * into v_recipe;
    if not found then
      raise exception 'stock_insuffisant';
    end if;
    v_name := v_recipe.name;
  elsif p_recipe_id is not null then
    select * into v_recipe from recipes where id = p_recipe_id;
    v_name := coalesce(v_recipe.name, v_request.recipe_name);
  else
    v_name := v_request.recipe_name;
  end if;

  insert into orders (
    recipe_id, recipe_name_snapshot, quantity, customer_name, customer_email,
    order_type, unit_amount, created_by
  ) values (
    p_recipe_id, v_name, v_request.quantity, v_request.customer_name, v_request.customer_email,
    case when p_order_type = 'donne' then 'donne' else 'vendu' end,
    case when p_order_type = 'donne' then null else p_unit_amount end,
    'sur_commande'
  )
  returning * into v_order;

  update custom_orders
    set status = 'honoree', order_id = v_order.id, honored_at = now()
    where id = p_custom_order_id;

  return v_order;
end;
$$;

-- Reservee a l'espace producteur (cle service_role, cote serveur) :
-- le site public ne doit JAMAIS pouvoir appeler cette fonction.
revoke execute on function honor_custom_order(uuid, uuid, boolean, text, numeric) from public, anon, authenticated;
grant execute on function honor_custom_order(uuid, uuid, boolean, text, numeric) to service_role;
