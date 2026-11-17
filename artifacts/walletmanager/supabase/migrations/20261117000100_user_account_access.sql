-- Per-user wallet access. Apply this migration to the existing Supabase project
-- before deploying the UI changes that use these policies and RPCs.

create table public.user_account_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  paypal_account_id uuid references public.paypal_accounts(id) on delete cascade,
  nepali_account_id uuid references public.nepali_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_account_access_exactly_one_account
    check ((paypal_account_id is not null) <> (nepali_account_id is not null))
);

create unique index user_account_access_paypal_unique
  on public.user_account_access(user_id, paypal_account_id)
  where paypal_account_id is not null;
create unique index user_account_access_nepali_unique
  on public.user_account_access(user_id, nepali_account_id)
  where nepali_account_id is not null;

alter table public.user_account_access enable row level security;
grant select on public.user_account_access to authenticated;

create or replace function public.walletmanager_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role::text = 'ADMIN'
  );
$$;

create or replace function public.walletmanager_has_usd_access(_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.walletmanager_is_admin() or exists (
    select 1 from public.user_account_access
    where user_id = auth.uid() and paypal_account_id = _account_id
  );
$$;

create or replace function public.walletmanager_has_npr_access(_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.walletmanager_is_admin() or exists (
    select 1 from public.user_account_access
    where user_id = auth.uid() and nepali_account_id = _account_id
  );
$$;

revoke all on function public.walletmanager_is_admin() from public;
revoke all on function public.walletmanager_has_usd_access(uuid) from public;
revoke all on function public.walletmanager_has_npr_access(uuid) from public;
grant execute on function public.walletmanager_is_admin() to authenticated;
grant execute on function public.walletmanager_has_usd_access(uuid) to authenticated;
grant execute on function public.walletmanager_has_npr_access(uuid) to authenticated;

create policy walletmanager_access_read
  on public.user_account_access as permissive for select to authenticated
  using (user_id = auth.uid() or public.walletmanager_is_admin());
create policy walletmanager_access_admin_write
  on public.user_account_access as permissive for all to authenticated
  using (public.walletmanager_is_admin())
  with check (public.walletmanager_is_admin());

create or replace function public.walletmanager_replace_user_account_access(
  _target_user_id uuid,
  _paypal_account_ids uuid[],
  _nepali_account_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.walletmanager_is_admin() then
    raise exception 'Only admins can change wallet access';
  end if;

  delete from public.user_account_access where user_id = _target_user_id;

  insert into public.user_account_access (user_id, paypal_account_id)
  select _target_user_id, account_id
  from (select distinct unnest(coalesce(_paypal_account_ids, '{}'::uuid[])) as account_id) ids
  where account_id is not null;

  insert into public.user_account_access (user_id, nepali_account_id)
  select _target_user_id, account_id
  from (select distinct unnest(coalesce(_nepali_account_ids, '{}'::uuid[])) as account_id) ids
  where account_id is not null;
end;
$$;

revoke all on function public.walletmanager_replace_user_account_access(uuid, uuid[], uuid[]) from public;
grant execute on function public.walletmanager_replace_user_account_access(uuid, uuid[], uuid[]) to authenticated;

create or replace function public.walletmanager_create_npr_transfer(
  _from_account_id uuid,
  _to_account_id uuid,
  _amount_npr numeric,
  _transfer_date date,
  _remark text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  _source_id uuid := gen_random_uuid();
begin
  if _amount_npr <= 0 or (_from_account_id is null and _to_account_id is null)
    or (_from_account_id is not null and _from_account_id = _to_account_id) then
    raise exception 'Invalid transfer details';
  end if;

  if not public.walletmanager_is_admin() and (
    _from_account_id is null or _to_account_id is null
    or not public.walletmanager_has_npr_access(_from_account_id)
    or not public.walletmanager_has_npr_access(_to_account_id)
  ) then
    raise exception 'Both NPR accounts must be assigned to your user';
  end if;

  if _from_account_id is not null then
    insert into public.nepali_account_ledger
      (nepali_account_id, entry_date, entry_type, amount_npr, source_type, source_id, remark)
    values (_from_account_id, _transfer_date, 'TRANSFER_OUT', _amount_npr, 'TRANSFER', _source_id, nullif(trim(_remark), ''));
  end if;

  if _to_account_id is not null then
    insert into public.nepali_account_ledger
      (nepali_account_id, entry_date, entry_type, amount_npr, source_type, source_id, remark)
    values (_to_account_id, _transfer_date, 'TRANSFER_IN', _amount_npr, 'TRANSFER', _source_id, nullif(trim(_remark), ''));
  end if;

  return _source_id;
end;
$$;

revoke all on function public.walletmanager_create_npr_transfer(uuid, uuid, numeric, date, text) from public;
grant execute on function public.walletmanager_create_npr_transfer(uuid, uuid, numeric, date, text) to authenticated;

alter table public.paypal_accounts enable row level security;
alter table public.paypal_emails enable row level security;
alter table public.transactions enable row level security;
alter table public.wallet_transfers enable row level security;
alter table public.nepali_accounts enable row level security;
alter table public.party_transactions enable row level security;
alter table public.nepali_account_ledger enable row level security;

create policy walletmanager_paypal_account_scope
  on public.paypal_accounts as restrictive for select to public
  using (public.walletmanager_has_usd_access(id));
create policy walletmanager_paypal_account_admin_insert
  on public.paypal_accounts as restrictive for insert to public
  with check (public.walletmanager_is_admin());
create policy walletmanager_paypal_account_admin_update
  on public.paypal_accounts as restrictive for update to public
  using (public.walletmanager_is_admin())
  with check (public.walletmanager_is_admin());
create policy walletmanager_paypal_account_admin_delete
  on public.paypal_accounts as restrictive for delete to public
  using (public.walletmanager_is_admin());

create policy walletmanager_paypal_email_scope
  on public.paypal_emails as restrictive for select to public
  using (public.walletmanager_has_usd_access(paypal_account_id));
create policy walletmanager_paypal_email_admin_insert
  on public.paypal_emails as restrictive for insert to public
  with check (public.walletmanager_is_admin());
create policy walletmanager_paypal_email_admin_update
  on public.paypal_emails as restrictive for update to public
  using (public.walletmanager_is_admin())
  with check (public.walletmanager_is_admin());
create policy walletmanager_paypal_email_admin_delete
  on public.paypal_emails as restrictive for delete to public
  using (public.walletmanager_is_admin());

create policy walletmanager_transaction_scope
  on public.transactions as restrictive for all to public
  using (public.walletmanager_has_usd_access(paypal_account_id))
  with check (public.walletmanager_has_usd_access(paypal_account_id));

-- A permitted side remains readable for accurate per-account balance calculations.
-- The transfer form itself only offers accounts returned by the scoped account query.
create policy walletmanager_wallet_transfer_read_scope
  on public.wallet_transfers as restrictive for select to public
  using (
    public.walletmanager_is_admin()
    or public.walletmanager_has_usd_access(from_wallet_id)
    or public.walletmanager_has_usd_access(to_wallet_id)
  );
create policy walletmanager_wallet_transfer_insert_scope
  on public.wallet_transfers as restrictive for insert to public
  with check (
    public.walletmanager_is_admin()
    or (
      from_wallet_id is not null and to_wallet_id is not null
      and public.walletmanager_has_usd_access(from_wallet_id)
      and public.walletmanager_has_usd_access(to_wallet_id)
    )
  );
create policy walletmanager_wallet_transfer_update_scope
  on public.wallet_transfers as restrictive for update to public
  using (
    public.walletmanager_is_admin()
    or (
      from_wallet_id is not null and to_wallet_id is not null
      and public.walletmanager_has_usd_access(from_wallet_id)
      and public.walletmanager_has_usd_access(to_wallet_id)
    )
  )
  with check (
    public.walletmanager_is_admin()
    or (
      from_wallet_id is not null and to_wallet_id is not null
      and public.walletmanager_has_usd_access(from_wallet_id)
      and public.walletmanager_has_usd_access(to_wallet_id)
    )
  );
create policy walletmanager_wallet_transfer_delete_scope
  on public.wallet_transfers as restrictive for delete to public
  using (
    public.walletmanager_is_admin()
    or (
      from_wallet_id is not null and to_wallet_id is not null
      and public.walletmanager_has_usd_access(from_wallet_id)
      and public.walletmanager_has_usd_access(to_wallet_id)
    )
  );

create policy walletmanager_nepali_account_scope
  on public.nepali_accounts as restrictive for select to public
  using (public.walletmanager_has_npr_access(id));
create policy walletmanager_nepali_account_admin_insert
  on public.nepali_accounts as restrictive for insert to public
  with check (public.walletmanager_is_admin());
create policy walletmanager_nepali_account_admin_update
  on public.nepali_accounts as restrictive for update to public
  using (public.walletmanager_is_admin())
  with check (public.walletmanager_is_admin());
create policy walletmanager_nepali_account_admin_delete
  on public.nepali_accounts as restrictive for delete to public
  using (public.walletmanager_is_admin());

create policy walletmanager_party_transaction_scope
  on public.party_transactions as restrictive for all to public
  using (public.walletmanager_has_npr_access(nepali_account_id))
  with check (public.walletmanager_has_npr_access(nepali_account_id));

create policy walletmanager_npr_ledger_read_scope
  on public.nepali_account_ledger as restrictive for select to public
  using (public.walletmanager_has_npr_access(nepali_account_id));
create policy walletmanager_npr_ledger_insert_scope
  on public.nepali_account_ledger as restrictive for insert to public
  with check (
    public.walletmanager_is_admin()
    or (
      source_type <> 'TRANSFER'
      and public.walletmanager_has_npr_access(nepali_account_id)
    )
  );
create policy walletmanager_npr_ledger_update_scope
  on public.nepali_account_ledger as restrictive for update to public
  using (
    public.walletmanager_is_admin()
    or (source_type <> 'TRANSFER' and public.walletmanager_has_npr_access(nepali_account_id))
  )
  with check (
    public.walletmanager_is_admin()
    or (source_type <> 'TRANSFER' and public.walletmanager_has_npr_access(nepali_account_id))
  );
create policy walletmanager_npr_ledger_delete_scope
  on public.nepali_account_ledger as restrictive for delete to public
  using (
    public.walletmanager_is_admin()
    or (source_type <> 'TRANSFER' and public.walletmanager_has_npr_access(nepali_account_id))
  );

-- Balance views must execute with the caller's RLS policies, not the view owner's rights.
alter view public.paypal_accounts_with_balance set (security_invoker = true);
alter view public.nepali_accounts_with_balance set (security_invoker = true);
