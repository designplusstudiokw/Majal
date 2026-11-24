-- Majal schema. All access goes through the app's server with the secret key
-- (service_role). Row level security is on for every table with no policies,
-- so the public (anon/authenticated) Data API cannot read or write anything.

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------- projects
create sequence if not exists public.project_code_seq;

create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  status      text not null default 'pending_review' check (status in (
                'pending_review','open_for_signatures','open_for_design','sponsorship',
                'submitted_to_authority','in_progress','completed','rejected')),
  problem     text not null,
  fix         text,
  title       text not null check (char_length(title) between 5 and 120),
  description text not null check (char_length(description) between 10 and 2000),
  lat         double precision not null check (lat between 28.52 and 30.1),
  lng         double precision not null check (lng between 46.55 and 48.45),
  location    extensions.geography(point, 4326)
                generated always as (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography) stored,
  photos      text[] not null default '{}',
  source      text not null default 'resident' check (source in ('resident','curated')),
  theme       text,
  area        text,
  created_at  timestamptz not null default now()
);
create index projects_status_idx on public.projects (status);
create index projects_location_idx on public.projects using gist (location);

-- ---------------------------------------------------------------- signatures
create table public.signatures (
  project_code text not null references public.projects (code) on delete cascade,
  phone_hash   text not null,
  created_at   timestamptz not null default now(),
  primary key (project_code, phone_hash)
);

-- ---------------------------------------------------------------- one-time codes
create table public.otps (
  phone_hash   text primary key,
  code_hash    text,
  expires_at   bigint not null default 0,
  attempts     int not null default 0,
  recent_sends bigint[] not null default '{}'
);

-- ---------------------------------------------------------------- signals
create table public.signals (
  id            uuid primary key default gen_random_uuid(),
  url_key       text not null unique,
  url           text not null,
  source_name   text not null,
  published     date,
  language      text not null,
  excerpt       text not null,
  summary_ar    text not null,
  summary_en    text not null,
  problem       text not null,
  theme         text,
  area          text,
  location_hint text,
  confidence    text not null check (confidence in ('high','medium','low')),
  found_at      timestamptz not null default now(),
  via           text not null,
  status        text not null default 'new' check (status in ('new','dismissed','converted')),
  project_code  text references public.projects (code) on delete set null
);
create index signals_status_idx on public.signals (status, found_at desc);

create table public.scan_state (
  id     int primary key default 1 check (id = 1),
  cursor_pos int not null default 0,
  runs   jsonb not null default '[]'
);
insert into public.scan_state (id) values (1) on conflict do nothing;

-- ---------------------------------------------------------------- lock down
alter table public.projects   enable row level security;
alter table public.signatures enable row level security;
alter table public.otps       enable row level security;
alter table public.signals    enable row level security;
alter table public.scan_state enable row level security;
revoke all on public.projects, public.signatures, public.otps, public.signals, public.scan_state from anon, authenticated;
revoke all on sequence public.project_code_seq from anon, authenticated;

-- ---------------------------------------------------------------- functions
-- Create projects with sequential public codes (P-0001…), all or nothing.
create or replace function public.create_projects(items jsonb)
returns setof public.projects
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  created public.projects;
begin
  for item in select * from jsonb_array_elements(items) loop
    insert into public.projects (code, status, problem, fix, title, description, lat, lng, photos, source, theme, area)
    values (
      'P-' || lpad(nextval('public.project_code_seq')::text, 4, '0'),
      coalesce(item->>'status', 'pending_review'),
      item->>'problem',
      item->>'fix',
      item->>'title',
      item->>'description',
      (item->>'lat')::double precision,
      (item->>'lng')::double precision,
      coalesce(array(select jsonb_array_elements_text(item->'photos')), '{}'),
      coalesce(item->>'source', 'resident'),
      item->>'theme',
      item->>'area'
    )
    returning * into created;
    return next created;
  end loop;
end;
$$;

-- Public projects with signature counts in one query (explorer, home).
create or replace function public.list_public_projects()
returns table (project jsonb, signatures bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select to_jsonb(p) - 'location', count(s.phone_hash)
  from public.projects p
  left join public.signatures s on s.project_code = p.code
  where p.status in ('open_for_signatures','open_for_design','sponsorship',
                     'submitted_to_authority','in_progress','completed')
  group by p.id
  order by p.created_at desc;
$$;

-- One-time codes. All decisions happen inside the database with the row
-- locked (select ... for update), so concurrent requests cannot beat the
-- resend cooldown or the attempt limit.
create or replace function public.otp_request(
  p_phone_hash text, p_code_hash text, p_now bigint,
  p_ttl_ms int, p_cooldown_ms int, p_window_ms int, p_max_sends int)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r public.otps;
  recent bigint[];
  last_send bigint;
begin
  insert into public.otps (phone_hash) values (p_phone_hash) on conflict do nothing;
  select * into r from public.otps where phone_hash = p_phone_hash for update;
  recent := array(select t from unnest(r.recent_sends) t where p_now - t < p_window_ms order by t);
  last_send := recent[cardinality(recent)];
  if last_send is not null and p_now - last_send < p_cooldown_ms then
    update public.otps set recent_sends = recent where phone_hash = p_phone_hash;
    return jsonb_build_object('ok', false, 'error', 'cooldown',
      'retryAfter', ceil((p_cooldown_ms - (p_now - last_send)) / 1000.0));
  end if;
  if cardinality(recent) >= p_max_sends then
    update public.otps set recent_sends = recent where phone_hash = p_phone_hash;
    return jsonb_build_object('ok', false, 'error', 'limit');
  end if;
  update public.otps
     set code_hash = p_code_hash, expires_at = p_now + p_ttl_ms, attempts = 0,
         recent_sends = recent || p_now
   where phone_hash = p_phone_hash;
  return jsonb_build_object('ok', true);
end;
$$;

-- Returns 'ok', 'invalid', 'expired' or 'locked'. A code works once.
create or replace function public.otp_verify(
  p_phone_hash text, p_code_hash text, p_now bigint, p_max_attempts int)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r public.otps;
begin
  select * into r from public.otps where phone_hash = p_phone_hash for update;
  if not found or r.code_hash is null then
    return 'invalid';
  end if;
  if p_now > r.expires_at then
    update public.otps set code_hash = null where phone_hash = p_phone_hash;
    return 'expired';
  end if;
  if r.attempts >= p_max_attempts then
    update public.otps set code_hash = null where phone_hash = p_phone_hash;
    return 'locked';
  end if;
  if r.code_hash = p_code_hash then
    update public.otps set code_hash = null where phone_hash = p_phone_hash;
    return 'ok';
  end if;
  update public.otps
     set attempts = r.attempts + 1,
         code_hash = case when r.attempts + 1 >= p_max_attempts then null else r.code_hash end
   where phone_hash = p_phone_hash;
  return case when r.attempts + 1 >= p_max_attempts then 'locked' else 'invalid' end;
end;
$$;

revoke execute on function public.create_projects(jsonb) from public, anon, authenticated;
revoke execute on function public.list_public_projects() from public, anon, authenticated;
revoke execute on function public.otp_request(text, text, bigint, int, int, int, int) from public, anon, authenticated;
revoke execute on function public.otp_verify(text, text, bigint, int) from public, anon, authenticated;
grant execute on function public.create_projects(jsonb) to service_role;
grant execute on function public.list_public_projects() to service_role;
grant execute on function public.otp_request(text, text, bigint, int, int, int, int) to service_role;
grant execute on function public.otp_verify(text, text, bigint, int) to service_role;

-- ---------------------------------------------------------------- photos
-- Private bucket: photos are served through the app (/api/uploads/...), so a
-- moderator can withdraw one at any time.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 6291456, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
