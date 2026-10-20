# QR-App improvements — read before running

This is an improved version of the existing Expo / React Native QR attendance project.

## Changes included
- Restores the saved Supabase session on app startup and listens for auth changes.
- Awaits Supabase logout and reports logout errors instead of silently ignoring them.
- Public registration creates Student accounts only; the registration form no longer allows self-selecting Teacher.
- QR attendance must match an existing event in Supabase. Scanning an unknown QR can no longer create an event.
- Attendance uses the signed-in user's ID, checks the event's database status and time window, and gives clearer duplicate/authorization messages.
- Teacher attendance reporting limits its query to the teacher's event IDs.
- Teacher/Admin event creation form includes venue and description, and new events are saved as open.
- Profile role badge supports Administrator.
- Adds `supabase/improve-qr-att.sql` to migrate the database and tighten RLS.
- Adds `.env` to `.gitignore` so local credentials are not accidentally committed.

## Before running
1. Back up your current `QR_App` folder.
2. Extract this ZIP to a separate folder first; compare it with your project before replacing anything.
3. Copy your existing local `.env` file into the extracted `QR_App` folder. This ZIP intentionally does not include `.env` or `node_modules`.
4. In Supabase Dashboard → SQL Editor, review and run `supabase/improve-qr-att.sql` against your project. Back up your database first.
5. Existing teacher/admin accounts may need their role set by a trusted administrator in Supabase SQL Editor. Do not let users select privileged roles during public sign-up. For example, after verifying the correct account email, a trusted admin can run:

```sql
update public.profiles
set role = 'teacher'
where email = 'verified-teacher@school.edu';

update public.profiles
set role = 'admin'
where email = 'verified-admin@school.edu';
```

Replace the example emails with the correct verified accounts. Never put a service-role key in the mobile app.

## Install and test
From PowerShell in the extracted `QR_App` folder:

```powershell
npm install
npx expo start --dev-client --tunnel
```

TypeScript check completed successfully with `npx tsc --noEmit` in the prepared environment. The Expo lint command could not run in this environment because the local Expo executable returned `Permission denied`; run it on your Windows machine if desired.

## Important limitation
This is an improvement pass, not a guarantee that every rubric feature is complete. The database migration must be applied before using the updated attendance flow because it adds the event `status`, `venue`, and `description` fields. Test with separate Student, Teacher, and Administrator accounts before your final presentation.
