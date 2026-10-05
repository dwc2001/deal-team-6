-- Deal Team 6 database. Paste into Supabase > SQL Editor and run once.
-- Safe to run again: everything is "if not exists" or replaces itself.
--
-- Access model: the whole office signs in as one shared team login (the team
-- passcode is that login's password). Only that login can read or write.
-- If you change the team email, change it in is_team() below as well.

create extension if not exists pgcrypto;

create or replace function public.is_team() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'team@dealteam6.app'
$$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Services in the directory and the group each is listed under.
create table if not exists public.categories (
  name text primary key,
  grp text not null default 'Everything else',
  created_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  name text not null default '',
  company text not null default '',
  title text not null default '',
  phone text not null default '',
  phone_alt text not null default '',
  email text not null default '',
  website text not null default '',
  address text not null default '',
  territory text not null default '',
  notes text not null default '',
  connection text not null default '',   -- who on the team knows them
  preferred boolean not null default false,
  pays_referral boolean not null default false,
  card_front text,                         -- path in the "cards" storage bucket
  added_by text not null default '',
  updated_by text not null default '',
  archived boolean not null default false, -- removed from view, can be restored
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comps (
  id uuid primary key default gen_random_uuid(),
  address text not null,
  center_name text not null default '',
  submarket text not null default '',
  city text not null default '',
  state text not null default '',
  county text not null default '',
  space_type text not null default '',     -- Office, Retail, Industrial, Flex, Medical
  use_type text not null default '',       -- Restaurant, Salon, ...
  tenant text not null default '',
  year_built int,
  year_renovated int,
  sign_date date,
  start_date date,
  sf numeric,
  floor text not null default '',
  rate_psf numeric,
  term_months int,
  lease_type text not null default '',     -- Full Service, NNN, Modified Gross
  deal_type text not null default '',      -- New, Renewal
  escalations text not null default '',
  options text not null default '',
  ti text not null default '',
  free_rent text not null default '',
  notes text not null default '',
  added_by text not null default '',
  updated_by text not null default '',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  section text not null,                   -- Grants and incentives, Tools and websites
  jurisdiction text not null default '',
  title text not null,
  url text not null default '',
  description text not null default '',
  status text not null default '',         -- Open, Closed, or blank when unknown
  more jsonb not null default '[]'::jsonb, -- extra links: [{"label": "Brochure", "url": "..."}]
  sort int not null default 0,
  added_by text not null default '',
  updated_by text not null default '',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists contacts_touch on public.contacts;
create trigger contacts_touch before update on public.contacts
  for each row execute function public.touch_updated_at();
drop trigger if exists comps_touch on public.comps;
create trigger comps_touch before update on public.comps
  for each row execute function public.touch_updated_at();
drop trigger if exists links_touch on public.links;
create trigger links_touch before update on public.links
  for each row execute function public.touch_updated_at();

-- Row level security: the team login can read, add and edit. Nobody can hard
-- delete through the app; "Remove" archives a record so it can be restored.
alter table public.categories enable row level security;
alter table public.contacts enable row level security;
alter table public.comps enable row level security;
alter table public.links enable row level security;

do $$
declare t text;
begin
  foreach t in array array['categories', 'contacts', 'comps', 'links'] loop
    execute format('drop policy if exists "team reads" on public.%I', t);
    execute format('drop policy if exists "team adds" on public.%I', t);
    execute format('drop policy if exists "team edits" on public.%I', t);
    execute format('create policy "team reads" on public.%I for select to authenticated using (public.is_team())', t);
    execute format('create policy "team adds" on public.%I for insert to authenticated with check (public.is_team())', t);
    execute format('create policy "team edits" on public.%I for update to authenticated using (public.is_team()) with check (public.is_team())', t);
  end loop;
end $$;

-- Photos of scanned business cards. Private: the app shows them through
-- short-lived signed links.
insert into storage.buckets (id, name, public)
values ('cards', 'cards', false)
on conflict (id) do nothing;

drop policy if exists "team reads cards" on storage.objects;
drop policy if exists "team uploads cards" on storage.objects;
create policy "team reads cards" on storage.objects
  for select to authenticated using (bucket_id = 'cards' and public.is_team());
create policy "team uploads cards" on storage.objects
  for insert to authenticated with check (bucket_id = 'cards' and public.is_team());
