create table if not exists public.game_sessions (
  session_id text primary key,
  initiator_name text not null,
  initiator_avatar text not null default 'char01',
  initiator_id text not null,
  challenger_name text,
  challenger_avatar text,
  challenger_id text,
  state jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.game_sessions
add column if not exists initiator_avatar text not null default 'char01';

alter table public.game_sessions
add column if not exists challenger_avatar text;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_game_sessions on public.game_sessions;
create trigger trg_touch_game_sessions
before update on public.game_sessions
for each row execute function public.touch_updated_at();

alter publication supabase_realtime add table public.game_sessions;

alter table public.game_sessions enable row level security;

create policy "public read sessions"
on public.game_sessions
for select
using (true);

create policy "public insert sessions"
on public.game_sessions
for insert
with check (true);

create policy "public update sessions"
on public.game_sessions
for update
using (true)
with check (true);
