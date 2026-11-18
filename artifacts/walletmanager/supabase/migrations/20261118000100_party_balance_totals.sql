-- Expose all-time party totals without exposing individual rows to users
-- who do not have access to the NPR wallet that owns those rows.
create or replace function public.walletmanager_party_balance_totals()
returns table (receivable numeric, payable numeric)
language sql
stable
security definer
set search_path = public, auth
as $$
  with party_nets as (
    select
      party_id,
      sum(
        case
          when entry_type = 'OUTGOING' then amount_npr
          when entry_type = 'INCOMING' then -amount_npr
          else 0
        end
      ) as net
    from public.party_transactions
    group by party_id
  )
  select
    coalesce(sum(greatest(net, 0)), 0) as receivable,
    coalesce(sum(greatest(-net, 0)), 0) as payable
  from party_nets;
$$;

revoke all on function public.walletmanager_party_balance_totals() from public;
revoke all on function public.walletmanager_party_balance_totals() from anon;
grant execute on function public.walletmanager_party_balance_totals() to authenticated;

create or replace function public.walletmanager_party_balance_summary()
returns table (
  party_id uuid,
  party_name text,
  receivable numeric,
  payable numeric,
  net numeric,
  entry_count bigint,
  latest_entry_date timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
  with party_ledger as (
    select
      pt.party_id,
      sum(
        case
          when pt.entry_type = 'OUTGOING' then pt.amount_npr
          when pt.entry_type = 'INCOMING' then -pt.amount_npr
          else 0
        end
      ) as net,
      count(*) as entry_count,
      max(pt.created_at) as latest_entry_date
    from public.party_transactions pt
    group by pt.party_id
  )
  select
    p.id,
    p.party_name,
    greatest(coalesce(pl.net, 0), 0),
    greatest(-coalesce(pl.net, 0), 0),
    coalesce(pl.net, 0),
    coalesce(pl.entry_count, 0),
    pl.latest_entry_date
  from public.parties p
  left join party_ledger pl on pl.party_id = p.id
  order by p.party_name;
$$;

revoke all on function public.walletmanager_party_balance_summary() from public;
revoke all on function public.walletmanager_party_balance_summary() from anon;
grant execute on function public.walletmanager_party_balance_summary() to authenticated;
