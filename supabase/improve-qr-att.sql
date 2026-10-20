-- QR-ATT improvement migration
-- Run this in Supabase SQL Editor AFTER backing up your database.
-- It preserves existing rows and adds the fields required by the project rubric.

alter table public.profiles
  drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('student', 'teacher', 'admin'));
alter table public.profiles
  add column if not exists is_active boolean not null default true;

alter table public.events
  add column if not exists venue text,
  add column if not exists description text,
  add column if not exists status text not null default 'open';

alter table public.events
  drop constraint if exists events_status_check;
alter table public.events
  add constraint events_status_check check (status in ('open', 'closed'));

-- Role helper avoids querying profiles recursively from RLS policies.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid() and is_active = true
  limit 1;
$$;
revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

drop function if exists public.admin_update_profile(uuid, text, boolean);
create function public.admin_update_profile(
  target_user_id uuid,
  new_role text,
  account_active boolean,
  new_full_name text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or public.current_user_role() is distinct from 'admin' then
    raise exception 'Only administrators can manage accounts';
  end if;
  if new_role is null or new_role not in ('student', 'teacher', 'admin') then
    raise exception 'Invalid user role';
  end if;
  if target_user_id = auth.uid() and account_active = false then
    raise exception 'Administrators cannot deactivate their own account';
  end if;

  update public.profiles
  set role = new_role,
      is_active = account_active,
      full_name = coalesce(nullif(trim(new_full_name), ''), full_name)
  where id = target_user_id;

  if not found then
    raise exception 'User profile not found';
  end if;
end;
$$;
revoke all on function public.admin_update_profile(uuid, text, boolean, text) from public;
grant execute on function public.admin_update_profile(uuid, text, boolean, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'attendance'
     ) then
    alter publication supabase_realtime add table public.attendance;
  end if;
end;
$$;

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.attendance enable row level security;

-- PROFILES: users can read their own profile; admins can read/manage all profiles.
drop policy if exists "Profiles are viewable by owner" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Admins manage profiles" on public.profiles;
create policy "Profiles are viewable by owner or admin"
on public.profiles for select to authenticated
using (auth.uid() = id or public.current_user_role() = 'admin');
drop policy if exists "Teachers view attendee profiles" on public.profiles;
create policy "Teachers view attendee profiles"
on public.profiles for select to authenticated
using (
  public.current_user_role() = 'teacher'
  and exists (
    select 1
    from public.attendance a
    join public.events e on e.id = a.event_id
    where a.student_id = profiles.id and e.created_by = auth.uid()
  )
);
create policy "Admins manage profiles"
on public.profiles for all to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');
-- Do not allow client-side role escalation. Client may update only full_name.
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

-- EVENTS: authenticated users may view events. Teachers manage their own;
-- admins manage all events. Students cannot create/update/close events.
drop policy if exists "Events are readable by authenticated users" on public.events;
drop policy if exists "Users can insert events" on public.events;
drop policy if exists "Users can update their own events" on public.events;
drop policy if exists "Teachers and admins create events" on public.events;
drop policy if exists "Teachers and admins update events" on public.events;
drop policy if exists "Admins delete events" on public.events;
create policy "Authenticated users read events"
on public.events for select to authenticated using (true);
create policy "Teachers and admins create events"
on public.events for insert to authenticated
with check (
  (public.current_user_role() = 'teacher' and auth.uid() = created_by)
  or public.current_user_role() = 'admin'
);
create policy "Teachers and admins update events"
on public.events for update to authenticated
using (
  (public.current_user_role() = 'teacher' and auth.uid() = created_by)
  or public.current_user_role() = 'admin'
)
with check (
  (public.current_user_role() = 'teacher' and auth.uid() = created_by)
  or public.current_user_role() = 'admin'
);
create policy "Admins delete events"
on public.events for delete to authenticated
using (public.current_user_role() = 'admin');

-- ATTENDANCE: students can insert their own record only for an open event.
-- Students see their own history; teachers see attendance for their events;
-- admins can view and correct all records.
drop policy if exists "Students can view their own attendance" on public.attendance;
drop policy if exists "Students can insert their own attendance" on public.attendance;
drop policy if exists "Students insert own attendance for open events" on public.attendance;
drop policy if exists "Users view authorized attendance" on public.attendance;
drop policy if exists "Admins update attendance" on public.attendance;
drop policy if exists "Admins delete attendance" on public.attendance;
drop policy if exists "Admins insert attendance" on public.attendance;
create policy "Users view authorized attendance"
on public.attendance for select to authenticated
using (
  auth.uid() = student_id
  or public.current_user_role() = 'admin'
  or exists (
    select 1 from public.events e
    where e.id = attendance.event_id and e.created_by = auth.uid()
      and public.current_user_role() = 'teacher'
  )
);
create policy "Students insert own attendance for open events"
on public.attendance for insert to authenticated
with check (
  auth.uid() = student_id
  and public.current_user_role() = 'student'
  and exists (
    select 1 from public.events e
    where e.id = attendance.event_id
      and e.status = 'open'
      and (e.start_time is null or e.start_time <= now())
      and (e.end_time is null or e.end_time >= now())
  )
);
create policy "Admins update attendance"
on public.attendance for update to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');
drop policy if exists "Admins insert attendance" on public.attendance;
create policy "Admins insert attendance"
on public.attendance for insert to authenticated
with check (public.current_user_role() = 'admin');
create policy "Admins delete attendance"
on public.attendance for delete to authenticated
using (public.current_user_role() = 'admin');

-- Keep duplicate prevention at database level as well as in app feedback.
create unique index if not exists attendance_student_event_unique
on public.attendance (student_id, event_id);
