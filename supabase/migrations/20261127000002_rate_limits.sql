-- Shared rate limits (fixed windows). Keys contain hashed IPs, never raw ones.
create table public.rate_limits (
  key          text not null,
  window_start bigint not null,
  count        int not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Counts one hit and returns true while the key is within its limit.
create or replace function public.rate_limit_hit(p_key text, p_window_ms bigint, p_limit int, p_now bigint)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  bucket bigint := (p_now / p_window_ms) * p_window_ms;
  hits int;
begin
  insert into public.rate_limits (key, window_start, count) values (p_key, bucket, 1)
  on conflict (key, window_start) do update set count = public.rate_limits.count + 1
  returning count into hits;
  -- Housekeeping: drop this key's expired windows.
  delete from public.rate_limits where key = p_key and window_start < bucket;
  return hits <= p_limit;
end;
$$;
revoke execute on function public.rate_limit_hit(text, bigint, int, bigint) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, bigint, int, bigint) to service_role;
