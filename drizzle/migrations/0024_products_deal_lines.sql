-- What a company sells (products) and what each deal includes (deal lines). With price, discount and
-- cost per line, a deal has a real amount and a real margin, and Métricas can use the margin of the
-- deals actually won instead of only the target margin of the segment. Everything is in the company's
-- currency (organizations.currency), so totals never mix currencies.

create table public.products (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  description text not null default '',
  sku text,
  -- Price and cost per unit and billing period: a monthly plan of 49 is 588 of ACV.
  price numeric not null default 0 check (price >= 0),
  cost numeric check (cost is null or cost >= 0),
  billing text not null default 'annual' check (billing in ('monthly', 'annual', 'one_off')),
  active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.products.cost is 'Cost per unit and period (cost to serve, licences…); null = unknown, so no margin';
create index products_org on public.products (org_id);
create unique index products_org_name on public.products (org_id, lower(trim(name)));

grant select, insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "org read" on public.products for select to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id));
create policy "pricing insert" on public.products for insert to authenticated
  with check (org_id = public.current_org() and (public.has_org_role(org_id, 'owner') or public.has_org_role(org_id, 'sales_leader') or public.has_org_role(org_id, 'deal_desk')));
create policy "pricing update" on public.products for update to authenticated
  using (org_id = public.current_org() and (public.has_org_role(org_id, 'owner') or public.has_org_role(org_id, 'sales_leader') or public.has_org_role(org_id, 'deal_desk')));
create policy "pricing delete" on public.products for delete to authenticated
  using (org_id = public.current_org() and (public.has_org_role(org_id, 'owner') or public.has_org_role(org_id, 'sales_leader') or public.has_org_role(org_id, 'deal_desk')));
create trigger products_audit before insert or update on public.products
  for each row execute function public.set_audit();

-- A line copies the product's price and cost when it is added, so changing the catalogue later
-- doesn't rewrite deals already negotiated.
create table public.deal_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references public.organizations(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null check (length(trim(name)) between 1 and 120),
  quantity numeric not null default 1 check (quantity > 0),
  unit_price numeric not null default 0 check (unit_price >= 0),
  unit_cost numeric check (unit_cost is null or unit_cost >= 0),
  discount_pct numeric not null default 0 check (discount_pct between 0 and 100),
  billing text not null default 'annual' check (billing in ('monthly', 'annual', 'one_off')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index deal_lines_deal on public.deal_lines (deal_id);
create index deal_lines_org on public.deal_lines (org_id);

grant select, insert, update, delete on public.deal_lines to authenticated;
grant all on public.deal_lines to service_role;
alter table public.deal_lines enable row level security;
-- Same people who can edit a deal can edit what it includes.
create policy "org read" on public.deal_lines for select to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id));
create policy "org insert" on public.deal_lines for insert to authenticated
  with check (org_id = public.current_org() and public.is_org_member(org_id));
create policy "org update" on public.deal_lines for update to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id)) with check (org_id = public.current_org());
create policy "org delete" on public.deal_lines for delete to authenticated
  using (org_id = public.current_org() and public.is_org_member(org_id));

-- A line always belongs to its deal's company, and its product too.
create or replace function public.deal_lines_scope()
returns trigger language plpgsql security definer set search_path = public as $$
declare d_org uuid;
begin
  select org_id into d_org from public.deals where id = new.deal_id;
  if d_org is null then raise exception 'Ese deal no existe.' using errcode = '22023'; end if;
  if new.org_id is distinct from d_org then
    raise exception 'La línea tiene que ser de la misma empresa que el deal.' using errcode = '42501';
  end if;
  if new.product_id is not null and not exists (select 1 from public.products p where p.id = new.product_id and p.org_id = d_org) then
    raise exception 'Ese producto no es de esta empresa.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.deal_id is distinct from old.deal_id then
    raise exception 'Una línea no se puede mover a otro deal.' using errcode = '22023';
  end if;
  if tg_op = 'INSERT' then new.created_by := coalesce(auth.uid(), new.created_by); end if;
  -- Prices are Deal Desk's: without a pricing role (Owner, Sales Leader, Deal Desk) a person adds
  -- catalogue products at their list price and cost, without discount, and changes only the quantity.
  -- A discount goes through «Solicitar descuento». Privileged jobs (no user) pass.
  if auth.uid() is not null and not (public.has_org_role(d_org, 'owner') or public.has_org_role(d_org, 'sales_leader') or public.has_org_role(d_org, 'deal_desk')) then
    if tg_op = 'INSERT' and not exists (
      select 1 from public.products p where p.id = new.product_id
        and p.price = new.unit_price and p.cost is not distinct from new.unit_cost and p.billing = new.billing and new.discount_pct = 0
    ) then
      raise exception 'Solo el Owner, el Sales Leader o Deal Desk pueden fijar precios, costes o descuentos. Añade el producto tal como está en el catálogo y pide el descuento a Deal Desk.' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and (new.unit_price, new.unit_cost, new.discount_pct, new.billing, new.name, new.product_id) is distinct from (old.unit_price, old.unit_cost, old.discount_pct, old.billing, old.name, old.product_id) then
      raise exception 'Solo el Owner, el Sales Leader o Deal Desk pueden cambiar precios, costes o descuentos. Puedes cambiar la cantidad o pedir el descuento a Deal Desk.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger deal_lines_scope before insert or update on public.deal_lines
  for each row execute function public.deal_lines_scope();

-- The deal's amount (ACV) and gross margin follow its recurring lines (monthly lines count twelve
-- times); one-off lines (set-up, training…) go to one_off_amount and stay out of the ACV, as the usual
-- definition of ACV asks. A recurring line without cost leaves the margin unknown. With no lines left,
-- the amount stays as it was (the person can type it again) and margin and one-off are cleared.
alter table public.deals add column gross_margin numeric;
alter table public.deals add column one_off_amount numeric;
comment on column public.deals.gross_margin is 'Yearly gross margin of the recurring deal_lines (revenue - cost); null = no lines or a recurring line without cost';
comment on column public.deals.one_off_amount is 'Sum of one-off deal_lines (not part of the ACV in amount); null = no lines';

create or replace function public.deal_lines_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare _deal uuid := coalesce(new.deal_id, old.deal_id); n int; rev numeric; cst numeric; unknown int; once numeric;
begin
  -- Two people changing lines of the same deal at once: the second waits and sums both.
  perform 1 from public.deals where id = _deal for update;
  select count(*),
         coalesce(sum(l.quantity * l.unit_price * (1 - l.discount_pct / 100) * case l.billing when 'monthly' then 12 else 1 end) filter (where l.billing <> 'one_off'), 0),
         coalesce(sum(l.quantity * coalesce(l.unit_cost, 0) * case l.billing when 'monthly' then 12 else 1 end) filter (where l.billing <> 'one_off'), 0),
         count(*) filter (where l.unit_cost is null and l.billing <> 'one_off'),
         coalesce(sum(l.quantity * l.unit_price * (1 - l.discount_pct / 100)) filter (where l.billing = 'one_off'), 0)
    into n, rev, cst, unknown, once
    from public.deal_lines l where l.deal_id = _deal;
  perform set_config('app.deal_lines_sync', 'on', true);
  if n = 0 then
    update public.deals set gross_margin = null, one_off_amount = null where id = _deal;
  else
    update public.deals set amount = round(rev, 2), one_off_amount = round(once, 2),
      gross_margin = case when unknown > 0 or rev = 0 then null else round(rev - cst, 2) end where id = _deal;
  end if;
  perform set_config('app.deal_lines_sync', 'off', true);
  return null;
end $$;
create trigger deal_lines_sync after insert or update or delete on public.deal_lines
  for each row execute function public.deal_lines_sync();

-- Only the lines write a deal's margin and one-off total, and a deal with lines keeps the amount they
-- give: a screen, the agent or a CRM webhook that writes them is ignored on those columns
-- instead of leaving a margin that no longer matches the amount. The sync itself doesn't count as
-- activity (updated_at stays), so a line change doesn't move a won deal to this quarter.
create or replace function public.deals_lines_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.gross_margin := null;
    new.one_off_amount := null;
    return new;
  end if;
  if coalesce(current_setting('app.deal_lines_sync', true), 'off') = 'on' then
    new.updated_at := old.updated_at;
    new.updated_by := old.updated_by;
    return new;
  end if;
  new.gross_margin := old.gross_margin;
  new.one_off_amount := old.one_off_amount;
  if exists (select 1 from public.deal_lines l where l.deal_id = new.id) then
    new.amount := old.amount;
  end if;
  return new;
end $$;
create trigger deals_lines_guard before insert or update on public.deals
  for each row execute function public.deals_lines_guard();
