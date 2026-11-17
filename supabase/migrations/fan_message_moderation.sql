-- Runaway with Becky: private fan submissions with admin-only moderation.
create table if not exists public.fan_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 50),
  message text not null check (char_length(btrim(message)) between 1 and 700),
  photo_path text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  constraint fan_messages_photo_path_format check (
    photo_path is null or photo_path ~ '^[0-9a-f-]{36}/picture\.(jpg|png|webp)$'
  )
);

create index if not exists fan_messages_approved_created_idx
  on public.fan_messages (created_at desc) where status = 'approved';
create index if not exists fan_messages_pending_created_idx
  on public.fan_messages (created_at asc) where status = 'pending';

create or replace function public.is_fan_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'fan_admin')::boolean, false)
$$;

alter table public.fan_messages enable row level security;
revoke all on public.fan_messages from anon, authenticated;
grant select on public.fan_messages to anon, authenticated;
grant insert on public.fan_messages to anon;
grant update (status, reviewed_at, reviewed_by) on public.fan_messages to authenticated;

drop policy if exists "Read approved fan messages or admin queue" on public.fan_messages;
create policy "Read approved fan messages or admin queue"
  on public.fan_messages for select to anon, authenticated
  using (status = 'approved' or public.is_fan_admin());

drop policy if exists "Submit messages for review" on public.fan_messages;
create policy "Submit messages for review"
  on public.fan_messages for insert to anon
  with check (
    status = 'pending'
    and char_length(btrim(name)) between 1 and 50
    and char_length(btrim(message)) between 1 and 700
  );

drop policy if exists "Admins moderate fan messages" on public.fan_messages;
create policy "Admins moderate fan messages"
  on public.fan_messages for update to authenticated
  using (public.is_fan_admin())
  with check (public.is_fan_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fan-submissions', 'fan-submissions', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Fan photo uploads enter review storage" on storage.objects;
create policy "Fan photo uploads enter review storage"
  on storage.objects for insert to anon
  with check (
    bucket_id = 'fan-submissions'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and storage.extension(name) in ('jpg', 'png', 'webp')
  );

drop policy if exists "Approved photos or admin review access" on storage.objects;
create policy "Approved photos or admin review access"
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'fan-submissions'
    and (
      public.is_fan_admin()
      or exists (
        select 1 from public.fan_messages m
        where m.photo_path = storage.objects.name and m.status = 'approved'
      )
    )
  );

drop policy if exists "Admins remove submitted photos" on storage.objects;
create policy "Admins remove submitted photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'fan-submissions' and public.is_fan_admin());

-- After the admin account exists, promote its Auth user. Replace the email
-- with your own signed-in admin account. Never grant this flag to fan accounts.
-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"fan_admin": true}'::jsonb
-- where email = 'YOUR_ADMIN_EMAIL';
