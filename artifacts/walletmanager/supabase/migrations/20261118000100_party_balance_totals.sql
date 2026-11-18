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
