-- Müşteri hesap kartı. All money is stored as integer kuruş.
create schema if not exists private;

create table public.staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  address text,
  home_phone text,
  work_phone text,
  mobile_phone text,
  tc_identity_no text,
  birth_place text,
  province text,
  birth_date date,
  neighborhood_village text,
  district text,
  volume_no text,
  registration_no text,
  row_no text,
  serial_no text,
  tax_office text,
  tax_no text,
  created_at timestamptz not null default now()
);

create table public.guarantors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  address text,
  home_phone text,
  work_phone text,
  mobile_phone text
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  guarantor_id uuid references public.guarantors(id),
  invoice_date date,
  invoice_no text,
  account_no text,
  installment_count integer not null check (installment_count between 1 and 60),
  first_due_date date not null,
  total_cents bigint not null check (total_cents > 0),
  down_payment_cents bigint not null default 0 check (down_payment_cents >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (down_payment_cents < total_cents)
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price_cents bigint not null check (unit_price_cents > 0),
  sale_date date not null,
  delivery_date date,
  delivered boolean not null default false
);

create table public.installments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  installment_no integer not null check (installment_no > 0),
  due_date date not null,
  amount_cents bigint not null check (amount_cents > 0),
  unique (sale_id, installment_no)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  installment_id uuid references public.installments(id),
  kind text not null check (kind in ('down_payment', 'installment')),
  amount_cents bigint not null check (amount_cents > 0),
  paid_on date not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  void_reason text,
  check ((kind = 'down_payment' and installment_id is null) or
         (kind = 'installment' and installment_id is not null))
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null,
  created_at timestamptz not null default now()
);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  installment_id uuid not null references public.installments(id) on delete cascade,
  reminder_kind text not null check (reminder_kind in ('three_days', 'overdue')),
  sent_on date not null,
  created_at timestamptz not null default now(),
  unique (user_id, installment_id, reminder_kind)
);

create index on public.sales (customer_id);
create index on public.sale_items (sale_id);
create index on public.installments (sale_id, due_date);
create index on public.payments (sale_id, paid_on) where voided_at is null;
create index on public.payments (installment_id) where voided_at is null;
create index on public.push_subscriptions (user_id);

alter table public.staff enable row level security;
alter table public.customers enable row level security;
alter table public.guarantors enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.installments enable row level security;
alter table public.payments enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_deliveries enable row level security;

revoke all on public.staff, public.customers, public.guarantors,
  public.sales, public.sale_items, public.installments, public.payments,
  public.push_subscriptions, public.notification_deliveries from anon, authenticated;
grant select on public.staff, public.customers, public.guarantors,
  public.sales, public.sale_items, public.installments, public.payments to authenticated;
grant select, insert, delete on public.push_subscriptions to authenticated;

create function private.is_staff() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (
  select 1 from public.staff
  where user_id = (select auth.uid()) and active
) $$;
revoke all on function private.is_staff() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_staff() to authenticated;

create policy staff_read on public.staff for select to authenticated
using (user_id = (select auth.uid()));
create policy customers_read on public.customers for select to authenticated
using ((select private.is_staff()));
create policy guarantors_read on public.guarantors for select to authenticated
using ((select private.is_staff()));
create policy sales_read on public.sales for select to authenticated
using ((select private.is_staff()));
create policy sale_items_read on public.sale_items for select to authenticated
using ((select private.is_staff()));
create policy installments_read on public.installments for select to authenticated
using ((select private.is_staff()));
create policy payments_read on public.payments for select to authenticated
using ((select private.is_staff()));
create policy push_read on public.push_subscriptions for select to authenticated
using (user_id = (select auth.uid()) and (select private.is_staff()));
create policy push_insert on public.push_subscriptions for insert to authenticated
with check (user_id = (select auth.uid()) and (select private.is_staff()));
create policy push_delete on public.push_subscriptions for delete to authenticated
using (user_id = (select auth.uid()) and (select private.is_staff()));

-- The card's calculated cells are database view columns, so they cannot drift
-- from the actual payment ledger. Every partial payment remains a separate row.
create view public.installment_ledger with (security_invoker = true) as
select i.id, i.sale_id, i.installment_no, i.due_date, i.amount_cents,
  p.last_paid_on as paid_date,
  p.paid_cents,
  greatest(0, i.amount_cents - p.paid_cents) as remaining_cents
from public.installments i
left join lateral (
  select coalesce(sum(amount_cents), 0)::bigint as paid_cents,
    max(paid_on) as last_paid_on
  from public.payments
  where installment_id = i.id and voided_at is null
) p on true;

create view public.sale_balances with (security_invoker = true) as
select s.id as sale_id, s.total_cents as total_debt_cents,
  p.paid_cents as total_paid_cents,
  greatest(0, s.total_cents - p.paid_cents) as remaining_debt_cents,
  s.installment_count
from public.sales s
left join lateral (
  select coalesce(sum(amount_cents), 0)::bigint as paid_cents
  from public.payments
  where sale_id = s.id and voided_at is null
) p on true;

revoke all on public.installment_ledger, public.sale_balances from anon, authenticated;
grant select on public.installment_ledger, public.sale_balances to authenticated;

-- A single transaction creates the customer, sale, items, down payment and plan.
create function private.create_sale_impl(p jsonb) returns uuid
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
      sale_id, product_name, quantity, unit_price_cents, sale_date, delivery_date, delivered
    ) values (
      v_sale, trim(v_item->>'product_name'), (v_item->>'quantity')::integer,
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

create function private.record_payment_impl(
  p_installment_id uuid, p_amount_cents bigint, p_paid_on date
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_installment public.installments%rowtype;
  v_paid bigint;
  v_id uuid;
begin
  if not private.is_staff() then raise exception 'Yetkisiz işlem'; end if;
  if p_amount_cents <= 0 or p_paid_on is null then raise exception 'Geçersiz ödeme'; end if;
  select * into v_installment from public.installments
  where id = p_installment_id for update;
  if not found then raise exception 'Taksit bulunamadı'; end if;
  select coalesce(sum(amount_cents), 0) into v_paid from public.payments
  where installment_id = p_installment_id and voided_at is null;
  if p_amount_cents > v_installment.amount_cents - v_paid then
    raise exception 'Ödeme kalan taksit tutarını aşamaz';
  end if;
  insert into public.payments (sale_id, installment_id, kind, amount_cents, paid_on, created_by)
  values (v_installment.sale_id, p_installment_id, 'installment', p_amount_cents,
    p_paid_on, auth.uid()) returning id into v_id;
  return v_id;
end;
$$;

create function private.void_payment_impl(p_payment_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
begin
  if not private.is_staff() then raise exception 'Yetkisiz işlem'; end if;
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found or v_payment.voided_at is not null or v_payment.kind = 'down_payment' then
    raise exception 'Bu ödeme geri alınamaz';
  end if;
  if nullif(trim(p_reason), '') is null then raise exception 'Gerekçe gerekli'; end if;
  update public.payments set voided_at = now(), voided_by = auth.uid(), void_reason = trim(p_reason)
  where id = p_payment_id;
end;
$$;

create function private.set_delivery_impl(p_item_id uuid, p_delivered boolean, p_delivery_date date)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_staff() then raise exception 'Yetkisiz işlem'; end if;
  update public.sale_items
  set delivered = p_delivered, delivery_date = p_delivery_date
  where id = p_item_id;
  if not found then raise exception 'Ürün bulunamadı'; end if;
end;
$$;

revoke all on function private.create_sale_impl(jsonb) from public;
revoke all on function private.record_payment_impl(uuid, bigint, date) from public;
revoke all on function private.void_payment_impl(uuid, text) from public;
revoke all on function private.set_delivery_impl(uuid, boolean, date) from public;
grant execute on function private.create_sale_impl(jsonb) to authenticated;
grant execute on function private.record_payment_impl(uuid, bigint, date) to authenticated;
grant execute on function private.void_payment_impl(uuid, text) to authenticated;
grant execute on function private.set_delivery_impl(uuid, boolean, date) to authenticated;

create function public.create_sale(p jsonb) returns uuid
language sql security invoker set search_path = ''
as $$ select private.create_sale_impl(p) $$;
create function public.record_payment(p_installment_id uuid, p_amount_cents bigint, p_paid_on date)
returns uuid language sql security invoker set search_path = ''
as $$ select private.record_payment_impl(p_installment_id, p_amount_cents, p_paid_on) $$;
create function public.void_payment(p_payment_id uuid, p_reason text)
returns void language sql security invoker set search_path = ''
as $$ select private.void_payment_impl(p_payment_id, p_reason) $$;
create function public.set_delivery(p_item_id uuid, p_delivered boolean, p_delivery_date date)
returns void language sql security invoker set search_path = ''
as $$ select private.set_delivery_impl(p_item_id, p_delivered, p_delivery_date) $$;
revoke all on function public.create_sale(jsonb) from public, anon;
revoke all on function public.record_payment(uuid, bigint, date) from public, anon;
revoke all on function public.void_payment(uuid, text) from public, anon;
revoke all on function public.set_delivery(uuid, boolean, date) from public, anon;
grant execute on function public.create_sale(jsonb) to authenticated;
grant execute on function public.record_payment(uuid, bigint, date) to authenticated;
grant execute on function public.void_payment(uuid, text) to authenticated;
grant execute on function public.set_delivery(uuid, boolean, date) to authenticated;
