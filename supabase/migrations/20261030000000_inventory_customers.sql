-- Stock cards and immutable quantity history. Existing sales remain unlinked.
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 200),
  sku text unique,
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  reorder_at integer not null default 2 check (reorder_at >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  quantity_delta integer not null check (quantity_delta <> 0),
  kind text not null check (kind in ('opening', 'manual', 'sale')),
  note text,
  sale_item_id uuid references public.sale_items(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index on public.stock_movements (product_id, created_at desc);
create unique index on public.stock_movements (sale_item_id) where sale_item_id is not null;
alter table public.sale_items add column product_id uuid references public.products(id);
create index on public.sale_items (product_id) where product_id is not null;
alter table public.customers add column deleted_at timestamptz;

alter table public.products enable row level security;
alter table public.stock_movements enable row level security;
revoke all on public.products, public.stock_movements from anon, authenticated;
grant select on public.products, public.stock_movements to authenticated;
grant update (full_name, address, home_phone, work_phone, mobile_phone,
  tc_identity_no, birth_place, province, birth_date, neighborhood_village,
  district, volume_no, registration_no, row_no, serial_no, tax_office,
  tax_no, deleted_at) on public.customers to authenticated;
create policy products_read on public.products for select to authenticated
using ((select private.is_staff()));
create policy stock_movements_read on public.stock_movements for select to authenticated
using ((select private.is_staff()));
create policy customers_update on public.customers for update to authenticated
using ((select private.is_staff())) with check ((select private.is_staff()));

create function private.create_product_impl(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_name text := nullif(trim(p->>'name'), '');
  v_sku text := nullif(trim(p->>'sku'), '');
  v_price bigint := (p->>'unit_price_cents')::bigint;
  v_opening integer := (p->>'initial_quantity')::integer;
  v_reorder integer := (p->>'reorder_at')::integer;
begin
  if not private.is_staff() then raise exception 'Yetkisiz işlem'; end if;
  if v_name is null or length(v_name) > 200 or v_price < 0 or
     v_opening < 0 or v_reorder < 0 then raise exception 'Geçersiz ürün bilgisi'; end if;
  insert into public.products (name, sku, unit_price_cents, stock_quantity, reorder_at)
  values (v_name, v_sku, v_price, v_opening, v_reorder) returning id into v_id;
  if v_opening > 0 then
    insert into public.stock_movements
      (product_id, quantity_delta, kind, note, created_by)
    values (v_id, v_opening, 'opening', 'Açılış stoku', auth.uid());
  end if;
  return v_id;
end;
$$;

create function private.update_product_impl(p_id uuid, p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() then raise exception 'Yetkisiz işlem'; end if;
  update public.products set
    name = trim(p->>'name'),
    sku = nullif(trim(p->>'sku'), ''),
    unit_price_cents = (p->>'unit_price_cents')::bigint,
    reorder_at = (p->>'reorder_at')::integer,
    active = (p->>'active')::boolean
  where id = p_id;
  if not found then raise exception 'Ürün bulunamadı'; end if;
end;
$$;

create function private.adjust_stock_impl(p_id uuid, p_delta integer, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() then raise exception 'Yetkisiz işlem'; end if;
  if p_delta is null or p_delta = 0 or nullif(trim(p_note), '') is null then
    raise exception 'Adet ve açıklama gerekli';
  end if;
  update public.products set stock_quantity = stock_quantity + p_delta
  where id = p_id and stock_quantity + p_delta >= 0;
  if not found then raise exception 'Ürün bulunamadı veya stok yetersiz'; end if;
  insert into public.stock_movements
    (product_id, quantity_delta, kind, note, created_by)
  values (p_id, p_delta, 'manual', trim(p_note), auth.uid());
end;
$$;

create function private.deduct_sale_stock() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.product_id is null then return new; end if;
  update public.products set stock_quantity = stock_quantity - new.quantity
  where id = new.product_id and active and stock_quantity >= new.quantity;
  if not found then raise exception 'Ürün stokta yok veya adet yetersiz'; end if;
  insert into public.stock_movements
    (product_id, quantity_delta, kind, note, sale_item_id, created_by)
  values (new.product_id, -new.quantity, 'sale', 'Satış', new.id, auth.uid());
  return new;
end;
$$;
create trigger sale_item_stock_after_insert after insert on public.sale_items
for each row execute function private.deduct_sale_stock();

revoke all on function private.create_product_impl(jsonb) from public;
revoke all on function private.update_product_impl(uuid, jsonb) from public;
revoke all on function private.adjust_stock_impl(uuid, integer, text) from public;
revoke all on function private.deduct_sale_stock() from public;
grant execute on function private.create_product_impl(jsonb) to authenticated;
grant execute on function private.update_product_impl(uuid, jsonb) to authenticated;
grant execute on function private.adjust_stock_impl(uuid, integer, text) to authenticated;

create function public.create_product(p jsonb) returns uuid
language sql security invoker set search_path = ''
as $$ select private.create_product_impl(p) $$;
create function public.update_product(p_id uuid, p jsonb) returns void
language sql security invoker set search_path = ''
as $$ select private.update_product_impl(p_id, p) $$;
create function public.adjust_stock(p_id uuid, p_delta integer, p_note text) returns void
language sql security invoker set search_path = ''
as $$ select private.adjust_stock_impl(p_id, p_delta, p_note) $$;
revoke all on function public.create_product(jsonb) from public, anon;
revoke all on function public.update_product(uuid, jsonb) from public, anon;
revoke all on function public.adjust_stock(uuid, integer, text) from public, anon;
grant execute on function public.create_product(jsonb) to authenticated;
grant execute on function public.update_product(uuid, jsonb) to authenticated;
grant execute on function public.adjust_stock(uuid, integer, text) to authenticated;

-- Preserve the existing sale transaction and pass catalog IDs to the stock trigger.
create or replace function private.create_sale_impl(p jsonb) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_customer uuid;
  v_guarantor uuid;
  v_sale uuid;
  v_item jsonb;
  v_total bigint := 0;
  v_down bigint;
  v_financed bigint;
  v_count integer;
  v_first_due date;
  v_month_start date;
  v_month_last date;
  v_due date;
  v_base bigint;
  v_amount bigint;
  i integer;
begin
  if not private.is_staff() then raise exception 'Yetkisiz işlem'; end if;
  if jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') = 0 then
    raise exception 'En az bir ürün gerekli';
  end if;
  v_count := (p->>'installment_count')::integer;
  v_first_due := (p->>'first_due_date')::date;
  v_down := (p->>'down_payment_cents')::bigint;
  if v_count not between 1 and 60 or v_first_due is null or v_down < 0 then
    raise exception 'Geçersiz ödeme planı';
  end if;
  for v_item in select value from jsonb_array_elements(p->'items') loop
    if nullif(trim(v_item->>'product_name'), '') is null
       or (v_item->>'quantity')::integer <= 0
       or (v_item->>'unit_price_cents')::bigint <= 0 then
      raise exception 'Geçersiz ürün';
    end if;
    v_total := v_total + (v_item->>'quantity')::integer * (v_item->>'unit_price_cents')::bigint;
  end loop;
  v_financed := v_total - v_down;
  if v_financed < v_count then
    raise exception 'Taksit tutarı en az 1 kuruş olmalı';
  end if;
  if nullif(trim(p->'customer'->>'full_name'), '') is null then
    raise exception 'Müşteri adı gerekli';
  end if;

  insert into public.customers (
    full_name, address, home_phone, work_phone, mobile_phone, tc_identity_no,
    birth_place, province, birth_date, neighborhood_village, district,
    volume_no, registration_no, row_no, serial_no, tax_office, tax_no
  ) values (
    trim(p->'customer'->>'full_name'), nullif(p->'customer'->>'address', ''),
    nullif(p->'customer'->>'home_phone', ''), nullif(p->'customer'->>'work_phone', ''),
    nullif(p->'customer'->>'mobile_phone', ''), nullif(p->'customer'->>'tc_identity_no', ''),
    nullif(p->'customer'->>'birth_place', ''), nullif(p->'customer'->>'province', ''),
    nullif(p->'customer'->>'birth_date', '')::date,
    nullif(p->'customer'->>'neighborhood_village', ''), nullif(p->'customer'->>'district', ''),
    nullif(p->'customer'->>'volume_no', ''), nullif(p->'customer'->>'registration_no', ''),
    nullif(p->'customer'->>'row_no', ''), nullif(p->'customer'->>'serial_no', ''),
    nullif(p->'customer'->>'tax_office', ''), nullif(p->'customer'->>'tax_no', '')
  ) returning id into v_customer;

  if nullif(trim(p->'guarantor'->>'full_name'), '') is not null then
    insert into public.guarantors (full_name, address, home_phone, work_phone, mobile_phone)
    values (trim(p->'guarantor'->>'full_name'), nullif(p->'guarantor'->>'address', ''),
      nullif(p->'guarantor'->>'home_phone', ''), nullif(p->'guarantor'->>'work_phone', ''),
      nullif(p->'guarantor'->>'mobile_phone', '')) returning id into v_guarantor;
  end if;

  insert into public.sales (
    customer_id, guarantor_id, invoice_date, invoice_no, account_no,
    installment_count, first_due_date, total_cents, down_payment_cents, created_by
  ) values (
    v_customer, v_guarantor, nullif(p->>'invoice_date', '')::date,
    nullif(p->>'invoice_no', ''), nullif(p->>'account_no', ''),
    v_count, v_first_due, v_total, v_down, v_user
  ) returning id into v_sale;

  for v_item in select value from jsonb_array_elements(p->'items') loop
    insert into public.sale_items (
      sale_id, product_id, product_name, quantity, unit_price_cents,
      sale_date, delivery_date, delivered
    ) values (
      v_sale, nullif(v_item->>'product_id', '')::uuid,
      trim(v_item->>'product_name'), (v_item->>'quantity')::integer,
      (v_item->>'unit_price_cents')::bigint, (v_item->>'sale_date')::date,
      nullif(v_item->>'delivery_date', '')::date,
      coalesce((v_item->>'delivered')::boolean, false)
    );
  end loop;

  if v_down > 0 then
    insert into public.payments (sale_id, kind, amount_cents, paid_on, created_by)
    values (v_sale, 'down_payment', v_down, (p->>'down_payment_date')::date, v_user);
  end if;

  v_base := v_financed / v_count;
  for i in 0..(v_count - 1) loop
    v_month_start := (date_trunc('month', v_first_due)::date + make_interval(months => i))::date;
    v_month_last := (v_month_start + interval '1 month - 1 day')::date;
    v_due := v_month_start +
      (least(extract(day from v_first_due)::integer, extract(day from v_month_last)::integer) - 1);
    v_amount := v_base + case when i = v_count - 1 then v_financed - v_base * v_count else 0 end;
    insert into public.installments (sale_id, installment_no, due_date, amount_cents)
    values (v_sale, i + 1, v_due, v_amount);
  end loop;
  return v_sale;
end;
$$;
