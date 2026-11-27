-- Moderation log: who changed what, for accountability between moderators.
create table public.moderation_events (
  id           bigint generated always as identity primary key,
  at           timestamptz not null default now(),
  actor        text not null,
  action       text not null,
  project_code text references public.projects (code) on delete set null,
  details      jsonb not null default '{}'
);
create index moderation_events_project_idx on public.moderation_events (project_code, at desc);
create index moderation_events_at_idx on public.moderation_events (at desc);

alter table public.moderation_events enable row level security;
revoke all on public.moderation_events from anon, authenticated;
